import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Socket } from 'node:net';
import { Aid, Command, StructuredField } from './datastream/constants.ts';
import { parseInbound, summarizeQueryReplies, type QueryReplySummary } from './datastream/inbound.ts';
import {
    mapResponse,
    renderScreen,
    type RenderedScreen,
    type Screen,
    type ScreenResponse,
    type WriteOptions,
} from './screen.ts';
import { TERMINAL_TYPE_IS, TERMINAL_TYPE_SEND, TelnetOption } from './telnet/constants.ts';
import { TelnetConnection } from './telnet/connection.ts';
import { applyQueryReply, parseTerminalType, type ScreenSize, type TerminalInfo } from './terminal.ts';

/** Thrown by pending reads when the terminal disconnects. */
export class SessionClosedError extends Error {
    constructor() {
        super('The terminal session is closed');
        this.name = 'SessionClosedError';
    }
}

export interface SessionOptions {
    /** Milliseconds allowed for telnet negotiation. */
    handshakeTimeout: number;
    /** Milliseconds to wait for a Read Partition Query reply. */
    queryTimeout: number;
    /** Query extended terminals for their real screen size and capabilities. */
    query: boolean;
}

const MAX_QUEUED_INPUTS = 32;
const CLOSE_GRACE_MS = 1000;

/**
 * One connected 3270 terminal. Sessions are handed to your code by the
 * `Server` once negotiation has finished.
 */
export class Session extends EventEmitter<{
    /** The user pressed an AID key (Enter, PF/PA keys, Clear...). */
    input: [ScreenResponse];
    close: [];
}> {
    readonly id: string = randomUUID();
    readonly remoteAddress: string | undefined;

    private readonly telnet: TelnetConnection;
    private phase: 'negotiating' | 'ready' | 'closed' = 'negotiating';
    private _terminal: TerminalInfo | undefined;
    private terminalTypeName: string | undefined;
    private queryReply: QueryReplySummary | undefined;
    private readonly negotiationWatchers = new Set<() => void>();

    private lastScreen: RenderedScreen | undefined;
    private shownSize: ScreenSize = { rows: 24, cols: 80 };
    private queued: ScreenResponse[] = [];
    private readonly waiters: Array<{
        resolve: (response: ScreenResponse) => void;
        reject: (err: Error) => void;
    }> = [];

    private readonly socket: Socket;
    private readonly options: SessionOptions;

    /** @internal Sessions are created by `Server`. */
    constructor(socket: Socket, options: SessionOptions) {
        super();
        this.socket = socket;
        this.options = options;
        this.remoteAddress = socket.remoteAddress;
        this.telnet = new TelnetConnection(socket, {
            remoteOptions: [
                TelnetOption.TERMINAL_TYPE,
                TelnetOption.END_OF_RECORD,
                TelnetOption.BINARY,
            ],
            localOptions: [TelnetOption.END_OF_RECORD, TelnetOption.BINARY],
        });

        socket.on('data', (chunk) => this.telnet.feed(chunk));
        socket.on('close', () => this.handleClose());
        socket.on('error', () => {
            // 'close' always follows; ECONNRESET and friends are routine for terminals.
        });

        this.telnet.on('record', (record) => this.handleRecord(record));
        this.telnet.on('option', () => this.notifyNegotiation());
        this.telnet.on('subnegotiation', (option, payload) => {
            if (option === TelnetOption.TERMINAL_TYPE && payload[0] === TERMINAL_TYPE_IS) {
                this.terminalTypeName = payload.subarray(1).toString('latin1');
            }
            this.notifyNegotiation();
        });
        this.telnet.on('error', (err) => socket.destroy(err));
    }

    /** Capabilities of the connected terminal. */
    get terminal(): TerminalInfo {
        if (!this._terminal) throw new Error('Terminal negotiation has not finished');
        return this._terminal;
    }

    /** Size full-screen writes are drawn at (the terminal's largest screen). */
    get size(): ScreenSize {
        return this.terminal.alternateSize;
    }

    get closed(): boolean {
        return this.phase === 'closed';
    }

    /** Draw a screen and wait for the user to press an AID key. */
    async show(screen: Screen, options?: WriteOptions): Promise<ScreenResponse> {
        this.write(screen, options);
        return this.read();
    }

    /** Draw a screen without waiting for input. */
    write(screen: Screen, options?: WriteOptions): void {
        this.assertReady();
        const rendered = renderScreen(
            screen,
            { terminal: this.terminal, currentSize: this.shownSize },
            options,
        );
        this.lastScreen = rendered;
        this.shownSize = rendered.size;
        this.queued = [];
        this.telnet.sendRecord(rendered.bytes);
    }

    /**
     * Send a raw outbound data stream (command byte first, e.g. built with
     * `DataStream`). Responses to it carry no named values.
     */
    sendDataStream(data: Uint8Array): void {
        this.assertReady();
        if (data[0] === Command.ERASE_WRITE) this.shownSize = this.terminal.defaultSize;
        if (data[0] === Command.ERASE_WRITE_ALTERNATE) this.shownSize = this.terminal.alternateSize;
        this.lastScreen = undefined;
        this.queued = [];
        this.telnet.sendRecord(data);
    }

    /**
     * Wait for the next AID key. Input that arrived since the last write and was
     * not read yet is returned first.
     */
    read(): Promise<ScreenResponse> {
        if (this.phase === 'closed') return Promise.reject(new SessionClosedError());
        const next = this.queued.shift();
        if (next) return Promise.resolve(next);
        return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
    }

    /** Disconnect the terminal. */
    close(): void {
        if (this.socket.destroyed) return;
        this.socket.end();
        setTimeout(() => this.socket.destroy(), CLOSE_GRACE_MS).unref();
    }

    /**
     * @internal Run telnet negotiation. Resolves false when the peer is not a
     * TN3270 client or did not answer in time.
     */
    async negotiate(): Promise<boolean> {
        const telnet = this.telnet;
        const deadline = Date.now() + this.options.handshakeTimeout;
        const TT = TelnetOption.TERMINAL_TYPE;

        telnet.requestRemote(TT);
        const hasTerminalType = await this.waitFor(
            () => (telnet.isPending(TT) ? undefined : telnet.isRemoteEnabled(TT)),
            deadline,
        );
        if (!hasTerminalType) return false;

        telnet.sendSubnegotiation(TT, [TERMINAL_TYPE_SEND]);
        const terminalType = await this.waitFor(() => this.terminalTypeName, deadline);
        if (terminalType === undefined) return false;

        const binaryOptions = [TelnetOption.END_OF_RECORD, TelnetOption.BINARY];
        for (const option of binaryOptions) {
            telnet.requestRemote(option);
            telnet.offerLocal(option);
        }
        const binaryMode = await this.waitFor(
            () =>
                binaryOptions.some((o) => telnet.isPending(o))
                    ? undefined
                    : binaryOptions.every(
                          (o) => telnet.isRemoteEnabled(o) && telnet.isLocalEnabled(o),
                      ),
            deadline,
        );
        if (!binaryMode) return false;

        let terminal = parseTerminalType(terminalType);
        if (terminal.extended && this.options.query) {
            // Write Structured Field: Read Partition, partition FF, type Query.
            telnet.sendRecord([
                Command.WRITE_STRUCTURED_FIELD,
                0x00,
                0x05,
                StructuredField.READ_PARTITION,
                0xff,
                0x02,
            ]);
            const reply = await this.waitFor(
                () => this.queryReply,
                Date.now() + this.options.queryTimeout,
            );
            if (reply) terminal = applyQueryReply(terminal, reply);
        }
        if (this.phase === 'closed') return false;

        this._terminal = terminal;
        this.shownSize = terminal.defaultSize;
        this.phase = 'ready';
        return true;
    }

    /** @internal Tell a non-3270 client why it is being dropped, then disconnect. */
    reject(message: string): void {
        if (this.socket.destroyed) return;
        this.telnet.sendRaw(Buffer.from(message, 'latin1'));
        this.close();
    }

    private handleRecord(record: Buffer) {
        if (this.phase === 'negotiating') {
            if (record[0] === Aid.STRUCTURED_FIELD) {
                this.queryReply = summarizeQueryReplies(
                    parseInbound(record).structuredFields ?? [],
                );
                this.notifyNegotiation();
            }
            return;
        }
        if (this.phase !== 'ready') return;

        const inbound = parseInbound(record);
        if (inbound.aid === Aid.STRUCTURED_FIELD) return; // late query reply

        const response = mapResponse(inbound, this.lastScreen, this.shownSize);
        this.emit('input', response);

        const waiter = this.waiters.shift();
        if (waiter) {
            waiter.resolve(response);
        } else {
            this.queued.push(response);
            if (this.queued.length > MAX_QUEUED_INPUTS) this.queued.shift();
        }
    }

    private handleClose() {
        if (this.phase === 'closed') return;
        this.phase = 'closed';
        for (const waiter of this.waiters.splice(0)) waiter.reject(new SessionClosedError());
        this.notifyNegotiation();
        this.emit('close');
    }

    private assertReady() {
        if (this.phase === 'closed') throw new SessionClosedError();
        if (this.phase !== 'ready') throw new Error('Terminal negotiation has not finished');
    }

    /** Resolve with check()'s value once it is defined; undefined on timeout or close. */
    private waitFor<T>(check: () => T | undefined, deadline: number): Promise<T | undefined> {
        return new Promise((resolve) => {
            const finish = (value: T | undefined) => {
                clearTimeout(timer);
                this.negotiationWatchers.delete(poll);
                resolve(value);
            };
            const poll = () => {
                if (this.phase === 'closed') return finish(undefined);
                const value = check();
                if (value !== undefined) finish(value);
            };
            const timer = setTimeout(() => finish(undefined), Math.max(0, deadline - Date.now()));
            this.negotiationWatchers.add(poll);
            poll();
        });
    }

    private notifyNegotiation() {
        for (const watcher of [...this.negotiationWatchers]) watcher();
    }
}
