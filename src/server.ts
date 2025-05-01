import EventEmitter from 'events';
import { Socket } from 'net';

declare interface Server {
    on(event: 'connection', listener: (socket: Socket) => void): this;
}

class Server extends EventEmitter {
    constructor() {
        super();
    }

    listen(port: number) {}
}

export default Server;
