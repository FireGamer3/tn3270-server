// src/server.ts
import net from 'net';
import {
    IAC,
    DO,
    SEND,
    WILL,
    SB,
    SE,
    EOR,
    BINARY,
    TERMINAL_TYPE,
    SET_BUFFER_ADDRESS,
    START_FIELD,
    REPEAT_TO_ADDRESS,
    ESCAPE_CHAR,
    ERASE_WRITE,
    TN3270E,
    DATA_TYPE,
    REQUEST_FLAG,
    RESPONSE_FLAG,
    SEQ_HIGH,
    SEQ_LOW,
} from './util/constants';

import {
    a2e,
    convertPosToControlCharacter,
    startFieldControlCharacter,
    wccToControlCharacter,
} from './util/conversion';

const PORT = 2323;

const server = net.createServer((socket) => {
    let n = 0;
    console.log('🖧  Client connected:', socket.remoteAddress, socket.remotePort);

    console.log('🖧 Negotiating telnet options...');
    socket.write(Buffer.from([IAC, DO, TERMINAL_TYPE]));
    socket.write(Buffer.from([IAC, SB, TERMINAL_TYPE, SEND, IAC, SE]));
    socket.write(Buffer.from([IAC, DO, EOR]));
    socket.write(Buffer.from([IAC, DO, BINARY]));
    socket.write(Buffer.from([IAC, WILL, EOR, IAC, WILL, BINARY]));
    let connected = false;
    setTimeout(() => {
        connected = true;
        console.log('🖧 Sending Initial Hello World Field Data...');
        send3270Packet(socket, Buffer.from(HelloWorldScreen(n++)));
    }, 500);

    socket.on('data', (data) => {
        const convertedData = Array.from(data);
        console.log('📡 Client data:', Array.from(data));
        console.log(convertedData.map((b) => b.toString(16)));
        if (connected) {
            setTimeout(() => {
                send3270Packet(socket, Buffer.from(HelloWorldScreen(n++)));
            }, 10);
        }
    });

    socket.on('end', () => console.log('🔌 Client disconnected'));
    socket.on('close', () => console.log('🔌 Client disconnected'));
    socket.on('error', (err) => {
        if (err.message === 'read ECONNRESET') {
            console.log('Client disconnected');
        } else console.error(err);
    });
});

server.listen(PORT, () => {
    console.log(`⚡ TN3270 server listening on port ${PORT}`);
});

function send3270Packet(socket: net.Socket, ds: Buffer) {
    const header = Buffer.from([IAC, ERASE_WRITE, IAC]);
    const footer = Buffer.from([IAC, EOR]);
    console.log('Sending 3270 packet');
    console.log(header);
    console.log(ds);
    console.log(footer);
    socket.write(Buffer.concat([header, ds, footer]));
}

function HelloWorldScreen(n: number) {
    return [
        wccToControlCharacter(false, false, true, true),
        SET_BUFFER_ADDRESS,
        ...convertPosToControlCharacter(1, 1),
        START_FIELD,
        startFieldControlCharacter(true, false, 'NORMAL', false),
        REPEAT_TO_ADDRESS,
        ...convertPosToControlCharacter(1, 80),
        ...a2e(':'),
        SET_BUFFER_ADDRESS,
        ...convertPosToControlCharacter(10, 33),
        START_FIELD,
        startFieldControlCharacter(true, false, 'INTENSITY', false),
        ...a2e(`Hello World ${n}`),
        SET_BUFFER_ADDRESS,
        ...convertPosToControlCharacter(24, 1),
        START_FIELD,
        startFieldControlCharacter(true, false, 'NORMAL', false),
        REPEAT_TO_ADDRESS,
        ...convertPosToControlCharacter(24, 80),
        ...a2e(':'),
    ];
}
