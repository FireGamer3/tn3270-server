import { EventEmitter } from 'node:events';
import { IAC, ERASE_WRITE, WRITE, EOR } from '@/util/constants';
import { Socket, Server as netServer, createServer } from 'node:net';
import Client from './client';
import { ParsedData } from '../types';

declare interface Server {
    on(event: 'connection', listener: (client: Client) => void): this;
    on(event: 'disconnection', listener: (client: Client) => void): this;
    on(event: 'data', listener: (client: Client, data: ParsedData) => void): this;
    on(event: 'error', listener: (client: Client, err: Error) => void): this;
}

class Server extends EventEmitter {
    private server: netServer | null = null;
    private clients: Set<Client> = new Set();

    constructor() {
        super();
    }

    /**
     * Starts the TN3270 server on the specified port.
     * @param port The port number to listen on.
     */
    listen(port: number) {
        this.server = createServer((socket) => {
            console.log('🖧  Client Connection Requested:', socket.remoteAddress, socket.remotePort);
            const client = new Client(socket);

            this.clients.add(client);

            console.log('🖧  Negotiating telnet options...');
            client.negotiateTelnetOptions();

            console.log('🖧  Client Connected!');

            client.on('ready', () => {
                console.log(`🖧  Client ${client.id} Ready!`);
                this.emit('connection', client);
            });

            client.on('disconnect', () => {
                console.log(`🖧  Client ${client.id} Disconnected!`);
                this.clients.delete(client);
                this.emit('disconnection', client);
            });
            client.on('error', (err) => {
                this.emit('error', client, err);
            });

            client.on('data', (data) => {
                this.emit('data', client, data);
            });
        });

        this.server.listen(port, () => {
            console.log(`⚡ TN3270 server listening on port ${port}`);
        });
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
