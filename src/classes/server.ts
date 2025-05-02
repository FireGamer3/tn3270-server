import { EventEmitter } from 'node:events';
import {
    IAC,
    DO,
    TERMINAL_TYPE,
    SB,
    SEND,
    SE,
    EOR,
    BINARY,
    WILL,
    ERASE_WRITE,
} from '@/util/constants';
import { Socket, Server as netServer, createServer } from 'node:net';

declare interface Server {
    on(event: 'connection', listener: (socket: Socket) => void): this;
    on(event: 'disconnection', listener: (socket: Socket) => void): this;
    on(event: 'data', listener: (socket: Socket, data: Buffer) => void): this;
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
        socket.write(Buffer.from([IAC, DO, EOR]));
        socket.write(Buffer.from([IAC, DO, BINARY]));
        socket.write(Buffer.from([IAC, WILL, EOR, IAC, WILL, BINARY]));
    }

    /**
     * Starts the TN3270 server on the specified port.
     * @param port The port number to listen on.
     */
    listen(port: number) {
        this.server = createServer((socket) => {
            console.log('🖧  Client connected:', socket.remoteAddress, socket.remotePort);
            this.sockets.add(socket);

            // We should negotiate telnet options here
            console.log('🖧 Negotiating telnet options...');
            this.negotiateTelnetOptions(socket);

            setTimeout(() => {
                this.emit('connection', socket);
            }, 500);

            socket.on('end', () => {
                this.sockets.delete(socket);
                this.emit('disconnection', socket);
            });

            socket.on('error', (err) => {
                console.error('Socket error:', err);
            });

            socket.on('data', (data) => {
                const convertedData = Array.from(data);
                console.log(
                    '📡 Client data:',
                    convertedData.map((b) => b.toString(16)),
                );
                this.emit('data', socket, data);
            });
        });

        this.server.listen(port, () => {
            console.log(`⚡ TN3270 server listening on port ${port}`);
        });
    }

    /**
     * Sends data to the specified socket.
     * @param socket The socket to send data to.
     * @param data The data to send as a Buffer.
     * @throws Will throw an error if the socket is not connected.
     */
    send(socket: Socket, data: Buffer) {
        if (this.sockets.has(socket)) {
            const header = Buffer.from([IAC, ERASE_WRITE, IAC]);
            const footer = Buffer.from([IAC, EOR]);
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
