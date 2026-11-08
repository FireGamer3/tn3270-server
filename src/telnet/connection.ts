import { EventEmitter } from 'node:events';
import { DO, DONT, EOR, IAC, SB, SE, WILL, WONT } from './constants.ts';

/** Anything bytes can be written to (a net.Socket in practice). */
export interface TelnetTransport {
    write(data: Uint8Array): unknown;
}

export interface TelnetConnectionOptions {
    /** Options we allow the peer to enable on its side (peer sends WILL, we answer DO). */
    remoteOptions: readonly number[];
    /** Options we are willing to enable on our side (peer sends DO, we answer WILL). */
    localOptions: readonly number[];
    /** Largest record accepted before the connection is considered broken. */
    maxRecordSize?: number | undefined;
}

type OptionState = 'no' | 'yes' | 'wantyes';

const ParseState = {
    Data: 0,
    Iac: 1,
    Command: 2,
    Subnegotiation: 3,
    SubnegotiationIac: 4,
} as const;
type ParseState = (typeof ParseState)[keyof typeof ParseState];

const DEFAULT_MAX_RECORD = 64 * 1024;

/**
 * Telnet protocol layer: splits the inbound byte stream into IAC EOR terminated
 * records, answers option negotiation (a simplified RFC 1143 state machine that
 * never loops) and frames outbound records.
 */
export class TelnetConnection extends EventEmitter<{
    /** A complete record (the bytes before IAC EOR), with IAC IAC unescaped. */
    record: [Buffer];
    /** Any option changed state or a negotiation message arrived. */
    option: [];
    /** A sub-negotiation block: option code and its payload. */
    subnegotiation: [number, Buffer];
    /** Protocol violation; the caller should drop the connection. */
    error: [Error];
}> {
    private state: ParseState = ParseState.Data;
    private command = 0;
    private record: number[] = [];
    private subBuffer: number[] = [];
    private readonly remote = new Map<number, OptionState>();
    private readonly local = new Map<number, OptionState>();
    private readonly remoteAllowed: Set<number>;
    private readonly localAllowed: Set<number>;
    private readonly maxRecordSize: number;
    private readonly transport: TelnetTransport;

    constructor(transport: TelnetTransport, options: TelnetConnectionOptions) {
        super();
        this.transport = transport;
        this.remoteAllowed = new Set(options.remoteOptions);
        this.localAllowed = new Set(options.localOptions);
        this.maxRecordSize = options.maxRecordSize ?? DEFAULT_MAX_RECORD;
    }

    /** Ask the peer to enable an option on its side (sends DO). */
    requestRemote(option: number): void {
        if ((this.remote.get(option) ?? 'no') !== 'no') return;
        this.remoteAllowed.add(option);
        this.remote.set(option, 'wantyes');
        this.sendCommand(DO, option);
    }

    /** Offer to enable an option on our side (sends WILL). */
    offerLocal(option: number): void {
        if ((this.local.get(option) ?? 'no') !== 'no') return;
        this.localAllowed.add(option);
        this.local.set(option, 'wantyes');
        this.sendCommand(WILL, option);
    }

    isRemoteEnabled(option: number): boolean {
        return this.remote.get(option) === 'yes';
    }

    isLocalEnabled(option: number): boolean {
        return this.local.get(option) === 'yes';
    }

    /** True while a DO or WILL we sent for this option is still unanswered. */
    isPending(option: number): boolean {
        return this.remote.get(option) === 'wantyes' || this.local.get(option) === 'wantyes';
    }

    sendSubnegotiation(option: number, payload: ArrayLike<number>): void {
        this.transport.write(Buffer.from([IAC, SB, option, ...escapeIac(payload), IAC, SE]));
    }

    /** Send one record: IAC bytes are doubled and IAC EOR is appended. */
    sendRecord(data: ArrayLike<number>): void {
        this.transport.write(Buffer.from([...escapeIac(data), IAC, EOR]));
    }

    /** Write bytes with no telnet processing at all. */
    sendRaw(data: Uint8Array): void {
        this.transport.write(data);
    }

    /** Feed bytes received from the peer. */
    feed(chunk: Uint8Array): void {
        for (const byte of chunk) {
            switch (this.state) {
                case ParseState.Data:
                    if (byte === IAC) this.state = ParseState.Iac;
                    else this.pushRecordByte(byte);
                    break;

                case ParseState.Iac:
                    this.state = ParseState.Data;
                    if (byte === IAC) {
                        this.pushRecordByte(IAC);
                    } else if (byte === DO || byte === DONT || byte === WILL || byte === WONT) {
                        this.command = byte;
                        this.state = ParseState.Command;
                    } else if (byte === SB) {
                        this.subBuffer = [];
                        this.state = ParseState.Subnegotiation;
                    } else if (byte === EOR) {
                        const record = Buffer.from(this.record);
                        this.record = [];
                        this.emit('record', record);
                    }
                    // NOP, GA, AYT and friends are ignored.
                    break;

                case ParseState.Command:
                    this.state = ParseState.Data;
                    this.handleNegotiation(this.command, byte);
                    break;

                case ParseState.Subnegotiation:
                    if (byte === IAC) this.state = ParseState.SubnegotiationIac;
                    else this.pushSubByte(byte);
                    break;

                case ParseState.SubnegotiationIac:
                    if (byte === SE) {
                        this.state = ParseState.Data;
                        const [option, ...payload] = this.subBuffer;
                        this.subBuffer = [];
                        if (option !== undefined) {
                            this.emit('subnegotiation', option, Buffer.from(payload));
                        }
                    } else {
                        // IAC IAC is a literal 255; anything else is malformed and dropped.
                        if (byte === IAC) this.pushSubByte(IAC);
                        this.state = ParseState.Subnegotiation;
                    }
                    break;
            }
        }
    }

    private pushRecordByte(byte: number) {
        if (this.record.length >= this.maxRecordSize) {
            this.record = [];
            this.emit('error', new Error(`Inbound record exceeded ${this.maxRecordSize} bytes`));
            return;
        }
        this.record.push(byte);
    }

    private pushSubByte(byte: number) {
        if (this.subBuffer.length >= this.maxRecordSize) {
            this.subBuffer = [];
            this.emit('error', new Error('Sub-negotiation exceeded maximum size'));
            return;
        }
        this.subBuffer.push(byte);
    }

    private handleNegotiation(command: number, option: number) {
        if (command === WILL || command === WONT) {
            this.updateSide(this.remote, this.remoteAllowed, command === WILL, option, DO, DONT);
        } else {
            this.updateSide(this.local, this.localAllowed, command === DO, option, WILL, WONT);
        }
        this.emit('option');
    }

    /**
     * One side of the option table. `enable` is the peer's request (WILL/DO);
     * `yes`/`no` are the replies we send (DO/DONT or WILL/WONT). We only reply
     * when our state actually changes, which is what prevents negotiation loops.
     */
    private updateSide(
        table: Map<number, OptionState>,
        allowed: Set<number>,
        enable: boolean,
        option: number,
        yes: number,
        no: number,
    ) {
        const state = table.get(option) ?? 'no';
        if (enable) {
            if (state === 'wantyes') {
                table.set(option, 'yes');
            } else if (state === 'no') {
                if (allowed.has(option)) {
                    table.set(option, 'yes');
                    this.sendCommand(yes, option);
                } else {
                    this.sendCommand(no, option);
                }
            }
        } else if (state === 'yes') {
            table.set(option, 'no');
            this.sendCommand(no, option);
        } else if (state === 'wantyes') {
            table.set(option, 'no');
        }
    }

    private sendCommand(command: number, option: number) {
        this.transport.write(Buffer.from([IAC, command, option]));
    }
}

function escapeIac(data: ArrayLike<number>): number[] {
    const out: number[] = [];
    for (let i = 0; i < data.length; i++) {
        const byte = data[i]!;
        out.push(byte);
        if (byte === IAC) out.push(IAC);
    }
    return out;
}
