import { EventEmitter } from 'node:events';
import { createServer, type AddressInfo, type Server as NetServer, type Socket } from 'node:net';
import { Session, SessionClosedError, type SessionOptions } from './session.ts';

export type SessionHandler = (session: Session) => void | Promise<void>;

export interface Logger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string, error?: unknown): void;
}

export interface ServerOptions {
    /** Milliseconds allowed for telnet negotiation. Default 5000. */
    handshakeTimeout?: number | undefined;
    /** Milliseconds to wait for the terminal's query reply. Default 2000. */
    queryTimeout?: number | undefined;
    /** Query extended (-E) terminals for screen size and colors. Default true. */
    query?: boolean | undefined;
    /** Plain-text message sent to clients that are not 3270 terminals. */
    rejectMessage?: string | undefined;
    /** Receives connection lifecycle messages. Silent by default. */
    logger?: Logger | undefined;
}

const DEFAULT_REJECT_MESSAGE =
    'This is a TN3270 server. Please connect with a 3270 terminal emulator ' +
    '(x3270, wc3270, c3270, ...).\r\n';

/**
 * TN3270 server.
 *
 * Pass a handler to run one async flow per terminal: the session is closed
 * when the handler returns, and a disconnect while it awaits input simply
 * ends it.
 *
 * ```ts
 * const server = new Server(async (session) => {
 *     const reply = await session.show({ fields: [{ row: 1, col: 1, text: 'Hello!' }] });
 * });
 * await server.listen(3270);
 * ```
 */
export class Server extends EventEmitter<{
    /** A terminal finished negotiation. */
    session: [Session];
    /** The session handler threw something other than SessionClosedError. */
    sessionError: [Session, unknown];
    error: [Error];
}> {
    private readonly net: NetServer;
    private readonly handler: SessionHandler | undefined;
    private readonly options: {
        [K in Exclude<keyof ServerOptions, 'logger'>]-?: NonNullable<ServerOptions[K]>;
    } & { logger: Logger | undefined };
    private readonly _sessions = new Set<Session>();

    constructor(options?: ServerOptions);
    constructor(handler: SessionHandler, options?: ServerOptions);
    constructor(handlerOrOptions?: SessionHandler | ServerOptions, maybeOptions?: ServerOptions) {
        super();
        const options =
            (typeof handlerOrOptions === 'function' ? maybeOptions : handlerOrOptions) ?? {};
        this.handler = typeof handlerOrOptions === 'function' ? handlerOrOptions : undefined;
        this.options = {
            handshakeTimeout: options.handshakeTimeout ?? 5000,
            queryTimeout: options.queryTimeout ?? 2000,
            query: options.query ?? true,
            rejectMessage: options.rejectMessage ?? DEFAULT_REJECT_MESSAGE,
            logger: options.logger,
        };
        this.net = createServer((socket) => void this.accept(socket));
        this.net.on('error', (err) => this.emit('error', err));
    }

    /** Sessions that finished negotiation and are still connected. */
    get sessions(): ReadonlySet<Session> {
        return this._sessions;
    }

    /** Start listening. Resolves with the bound address (useful with port 0). */
    listen(port: number, host?: string): Promise<AddressInfo> {
        return new Promise((resolve, reject) => {
            const onError = (err: Error) => reject(err);
            this.net.once('error', onError);
            this.net.listen(port, host, () => {
                this.net.off('error', onError);
                const address = this.net.address() as AddressInfo;
                this.options.logger?.info(
                    `TN3270 server listening on ${address.address}:${address.port}`,
                );
                resolve(address);
            });
        });
    }

    /** Stop accepting connections and disconnect every terminal. */
    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.net.close((err) => (err ? reject(err) : resolve()));
            for (const session of this._sessions) session.close();
        });
    }

    private async accept(socket: Socket) {
        const log = this.options.logger;
        const peer = `${socket.remoteAddress}:${socket.remotePort}`;
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 60_000);

        const sessionOptions: SessionOptions = {
            handshakeTimeout: this.options.handshakeTimeout,
            queryTimeout: this.options.queryTimeout,
            query: this.options.query,
        };
        const session = new Session(socket, sessionOptions);

        if (!(await session.negotiate())) {
            log?.warn(`${peer} is not a TN3270 client; disconnecting`);
            session.reject(this.options.rejectMessage);
            return;
        }

        const { terminalType, alternateSize: size } = session.terminal;
        log?.info(`${peer} connected as ${terminalType} (${size.rows}x${size.cols})`);
        this._sessions.add(session);
        session.once('close', () => {
            this._sessions.delete(session);
            log?.info(`${peer} disconnected`);
        });

        this.emit('session', session);
        if (!this.handler) return;

        try {
            await this.handler(session);
        } catch (err) {
            if (!(err instanceof SessionClosedError)) {
                if (this.listenerCount('sessionError') > 0) this.emit('sessionError', session, err);
                else (log ?? console).error(`Session handler for ${peer} failed`, err);
            }
        } finally {
            session.close();
        }
    }
}
