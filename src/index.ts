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
} from './util/constants';

import {
    a2e,
    convertPosToControlCharacter,
    startFieldControlCharacter,
    wccToControlCharacter,
} from './util/conversion';

const PORT = 2323;

const server = net.createServer((socket) => {
    console.log('🖧  Client connected:', socket.remoteAddress, socket.remotePort);

    console.log('🖧 Negotiating telnet options...');
    socket.write(Buffer.from([IAC, DO, TERMINAL_TYPE]));
    socket.write(Buffer.from([IAC, SB, TERMINAL_TYPE, SEND, IAC, SE]));
    socket.write(Buffer.from([IAC, DO, EOR]));
    socket.write(Buffer.from([IAC, DO, BINARY]));
    socket.write(Buffer.from([IAC, WILL, EOR, IAC, WILL, BINARY]));
    console.log('🖧 Sending Initial Hello World Field Data...');
    const helloScreen = [
        wccToControlCharacter(false, false, true, true),
        SET_BUFFER_ADDRESS,
        ...convertPosToControlCharacter(1, 1),
        START_FIELD,
        startFieldControlCharacter(true, false, 'NORMAL', false),
        REPEAT_TO_ADDRESS,
        ...convertPosToControlCharacter(1, 80),
        ...a2e(':')
            .split('')
            .map((c) => c.charCodeAt(0)),
        SET_BUFFER_ADDRESS,
        ...convertPosToControlCharacter(2, 33),
        START_FIELD,
        startFieldControlCharacter(true, false, 'INTENSITY', false),
        ...a2e('Hello World')
            .split('')
            .map((c) => c.charCodeAt(0)),
        SET_BUFFER_ADDRESS,
        ...convertPosToControlCharacter(3, 1),
        START_FIELD,
        startFieldControlCharacter(true, false, 'NORMAL', false),
        REPEAT_TO_ADDRESS,
        ...convertPosToControlCharacter(3, 80),
        ...a2e(':')
            .split('')
            .map((c) => c.charCodeAt(0)),
    ];
    console.log(helloScreen);
    socket.write(Buffer.from(helloScreen));
    let connected = false;
    setTimeout(() => {
        connected = true;
    }, 500);

    socket.on('data', (data) => {
        const convertedData = Array.from(data);
        if (connected) {
            console.log('📡 Client data:', Array.from(data));
            console.log(convertedData.map((b) => b.toString(16)));
            console.log('📡 Client data ascii:', data);
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
