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
import Server from './classes/server';

const PORT = 2323;
const server = new Server();

const helloScreen = [
    wccToControlCharacter(false, true, true, true),
    SET_BUFFER_ADDRESS,
    ...convertPosToControlCharacter(1, 1),
    START_FIELD,
    startFieldControlCharacter(true, false, 'NORMAL', false),
    REPEAT_TO_ADDRESS,
    ...convertPosToControlCharacter(1, 80),
    ...a2e(':'),
    SET_BUFFER_ADDRESS,
    ...convertPosToControlCharacter(1, 3),
    START_FIELD,
    startFieldControlCharacter(true, false, 'NORMAL', false),
    ...a2e('MENU '),
    SET_BUFFER_ADDRESS,
    ...convertPosToControlCharacter(10, 33),
    START_FIELD,
    startFieldControlCharacter(true, false, 'INTENSITY', false),
    ...a2e('Hello World'),
    SET_BUFFER_ADDRESS,
    ...convertPosToControlCharacter(11, 8),
    START_FIELD,
    startFieldControlCharacter(true, false, 'INTENSITY', false),
    ...a2e(`Running on node ${process.version} at ${new Date().toTimeString()}`),
    SET_BUFFER_ADDRESS,
    ...convertPosToControlCharacter(24, 1),
    START_FIELD,
    startFieldControlCharacter(true, false, 'NORMAL', false),
    REPEAT_TO_ADDRESS,
    ...convertPosToControlCharacter(24, 80),
    ...a2e(':'),
];

server.listen(PORT);
server.on('connection', (s) => {
    server.send(s, Buffer.from(helloScreen));
    console.log('Sent hello screen to client:', s.remoteAddress, s.remotePort);
});
server.on('data', (s, data) => {
    server.send(s, Buffer.from(helloScreen));
});
