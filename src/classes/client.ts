import { randomUUID } from 'crypto';
import { Socket } from 'net';
import { EventEmitter } from 'events';
import {
    AID,
    BINARY,
    DO,
    EOR,
    EOR_FLAG,
    ERASE_WRITE,
    IAC,
    SB,
    SE,
    SEND,
    TERMINAL_TYPE,
    WILL,
    WRITE,
} from '../util/constants';
import { readParser } from './parsers/readParser';
import { e2a } from '../util/conversion';
import { ParsedData } from '../types';

export default class Client extends EventEmitter {
    private _id: string;
    private _socket: Socket;
    private ready: boolean = false;

    constructor(socket: Socket) {
        super();
        this._socket = socket;
        this._id = randomUUID();
        this._socket.on('end', this.handleEnd.bind(this));
        this._socket.on('data', this.handleData.bind(this));
        this._socket.on('error', this.handleError.bind(this));
    }

    get id() {
        return this._id;
    }

    /**
     * Negotiates telnet options with the client. Very Naive implementation. ignores client responses and just assumes client is a 3270.
     */
    negotiateTelnetOptions() {
        if (this.ready) return;
        this._socket.write(Buffer.from([IAC, DO, TERMINAL_TYPE]));
        this._socket.write(Buffer.from([IAC, SB, TERMINAL_TYPE, SEND, IAC, SE]));
        this._socket.write(Buffer.from([IAC, DO, EOR_FLAG]));
        this._socket.write(Buffer.from([IAC, DO, BINARY]));
        this._socket.write(Buffer.from([IAC, WILL, EOR_FLAG, IAC, WILL, BINARY]));
        setTimeout(() => {
            this.ready = true;
            this.emit('ready', this);
        }, 100);
    }

    disconnect() {
        this._socket.end();
        this._socket.off('data', this.handleData.bind(this));
        this._socket.off('end', this.handleEnd.bind(this));
        this._socket.off('error', this.handleError.bind(this));
        this.emit('disconnect', this);
    }

    /**
     * Sends data to the specified socket raw without any processing.
     * @param data The data to send as a Buffer.
     * @throws Will throw an error if the socket is not connected.
     */
    send(data: Buffer) {
        if (!this.ready) throw new Error('Client is not ready');
        this._socket.write(data);
    }
    /**
     * Sends data to the specified socket with a clear screen.
     * @param data The data to send as a Buffer.
     * @throws Will throw an error if the socket is not connected.
     */
    sendWithClear(data: Buffer) {
        if (!this.ready) throw new Error('Client is not ready');
        const header = Buffer.from([IAC, ERASE_WRITE, IAC]);
        const footer = Buffer.from([IAC, EOR]);
        this._socket.write(Buffer.concat([header, data, footer]));
    }

    /**
     * Sends data to the specified socket without clearing the screen.
     * @param data The data to send as a Buffer.
     * @throws Will throw an error if the socket is not connected.
     */
    sendWithoutClear(data: Buffer) {
        if (!this.ready) throw new Error('Client is not ready');
        const header = Buffer.from([IAC, WRITE, IAC]);
        const footer = Buffer.from([IAC, EOR]);
        this._socket.write(Buffer.concat([header, data, footer]));
    }

    private handleEnd() {
        this.emit('disconnect', this);
    }

    private handleData(data: Buffer) {
        const convertedData = Array.from(data);
        if (convertedData.length > 0) {
            if (convertedData[0] === IAC) {
                // We have a telnet command
            } else if (Object.values(AID).includes(convertedData[0]! as AID)) {
                // We have an AID, and possibly filled out screen data
                const AIDKey = convertedData[0]! as AID;
                convertedData.splice(0, 1);
                const dataPayload = {
                    aid: AIDKey,
                    data: readParser(convertedData).map((f) => {
                        return {
                            pos: f.pos,
                            bufferPos: f.posCC,
                            data: e2a(Buffer.from(f.data)),
                        };
                    }),
                };
                console.log('📡 Client data:', dataPayload);
                this.emit('data', this, dataPayload);
            }
        }
    }

    private handleError(err: Error) {
        if (err.message === 'read ECONNRESET') {
            console.log('🖧  Read Error, Likely client disconnect!');
            this.disconnect();
        } else {
            console.error('Socket error:', err);
            this.emit('error', err);
        }
    }
}
