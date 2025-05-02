import { EventEmitter } from 'node:events';
import {
    IAC,
    DO,
    TERMINAL_TYPE,
    SB,
    SEND,
    SE,
    EOR_FLAG,
    BINARY,
    WILL,
    ERASE_WRITE,
    AID,
    Aid,
    WRITE,
} from '@/util/constants';
import { Socket, Server as netServer, createServer } from 'node:net';
import { readParser } from './parsers/readParser';
import { e2a } from '../util/conversion';
import { Position } from '../types';

export type ParsedData = {
    aid: Aid;
    data: {
        pos: Position;
        posCC: number;
        data: string;
    }[];
};
declare interface Server {
    on(event: 'connection', listener: (socket: Socket) => void): this;
    on(event: 'disconnection', listener: (socket: Socket) => void): this;
    on(event: 'data', listener: (socket: Socket, data: ParsedData) => void): this;
}

class Server extends EventEmitter {
    private server: netServer | null = null;
    private sockets: Set<Socket> = new Set();

    constructor() {
        super();
    }

    /**
     * Negotiates telnet options with the client.
     * @param socket The socket to negotiate options with.
     */
    private negotiateTelnetOptions(socket: Socket) {
        socket.write(Buffer.from([IAC, DO, TERMINAL_TYPE]));
        socket.write(Buffer.from([IAC, SB, TERMINAL_TYPE, SEND, IAC, SE]));
        socket.write(Buffer.from([IAC, DO, EOR_FLAG]));
        socket.write(Buffer.from([IAC, DO, BINARY]));
        socket.write(Buffer.from([IAC, WILL, EOR_FLAG, IAC, WILL, BINARY]));
    }

    /**
     * Starts the TN3270 server on the specified port.
     * @param port The port number to listen on.
     */
    listen(port: number) {
        this.server = createServer((socket) => {
            console.log('🖧  Client Connection Requested:', socket.remoteAddress, socket.remotePort);
            this.sockets.add(socket);

            console.log('🖧 Negotiating telnet options...');
            this.negotiateTelnetOptions(socket);

            setTimeout(() => {
                console.log('🖧 Client Connected!');
                this.emit('connection', socket);
            }, 100);

            socket.on('end', () => {
                this.sockets.delete(socket);
                this.emit('disconnection', socket);
            });

            socket.on('error', (err) => {
                console.error('Socket error:', err);
            });

            socket.on('data', (data) => {
                const convertedData = Array.from(data);
                if (convertedData.length > 0) {
                    if (convertedData[0] === IAC) {
                        // We have a telnet command
                    } else if (Object.values(AID).includes(convertedData[0]! as Aid)) {
                        // We have an AID, and possibly filled out screen data
                        const AIDKey = convertedData[0]! as Aid;
                        convertedData.splice(0, 1);
                        const dataPacket = convertedData.map((b) => b.toString(16));
                        const dataPayload = {
                            aid: AIDKey,
                            data: readParser(convertedData).map((f) => {
                                return {
                                    pos: f.pos,
                                    posCC: f.posCC,
                                    data: e2a(Buffer.from(f.data)),
                                };
                            }),
                        };
                        console.log('📡 Client data:', dataPayload);
                        this.emit('data', socket, dataPayload);
                    }
                }
            });
        });

        this.server.listen(port, () => {
            console.log(`⚡ TN3270 server listening on port ${port}`);
        });
    }

    /**
     * Sends data to the specified socket raw without any processing.
     * @param socket The socket to send data to.
     * @param data The data to send as a Buffer.
     * @throws Will throw an error if the socket is not connected.
     */
    send(socket: Socket, data: Buffer) {
        if (this.sockets.has(socket)) {
            socket.write(data);
        } else {
            throw new Error('Socket is not connected');
        }
    }
    /**
     * Sends data to the specified socket with a clear screen.
     * @param socket The socket to send data to.
     * @param data The data to send as a Buffer.
     * @throws Will throw an error if the socket is not connected.
     */
    sendWithClear(socket: Socket, data: Buffer) {
        if (this.sockets.has(socket)) {
            const header = Buffer.from([IAC, ERASE_WRITE, IAC]);
            const footer = Buffer.from([IAC, EOR_FLAG]);
            socket.write(Buffer.concat([header, data, footer]));
        } else {
            throw new Error('Socket is not connected');
        }
    }

    /**
     * Sends data to the specified socket without clearing the screen.
     * @param socket The socket to send data to.
     * @param data The data to send as a Buffer.
     * @throws Will throw an error if the socket is not connected.
     */
    sendWithoutClear(socket: Socket, data: Buffer) {
        if (this.sockets.has(socket)) {
            const header = Buffer.from([IAC, WRITE, IAC]);
            const footer = Buffer.from([IAC, EOR_FLAG]);
            socket.write(Buffer.concat([header, data, footer]));
        } else {
            throw new Error('Socket is not connected');
        }
    }

    /**
     * Disconnects the specified socket.
     * @param socket The socket to disconnect.
     */
    disconnect(socket: Socket) {
        if (this.sockets.has(socket)) {
            socket.end();
            this.sockets.delete(socket);
            this.emit('disconnection', socket);
        } else {
            throw new Error('Socket is not connected');
        }
    }

    /**
     * Closes the server and all connected sockets.
     * @throws Will throw an error if the server is not running.
     */
    close() {
        if (this.server) {
            this.server.close(() => {
                console.log('⚡ TN3270 server closed');
            });
        } else {
            throw new Error('Server is not running');
        }
    }
}

export default Server;
