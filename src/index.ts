import {
    SET_BUFFER_ADDRESS,
    START_FIELD,
    REPEAT_TO_ADDRESS,
    Colors,
    COLORS,
    EXTENDED_HIGHLIGHTING,
} from './util/constants';
import Screen from './classes/screen';

import {
    a2e,
    convertPosToControlCharacter,
    startFieldControlCharacter,
    wccToControlCharacter,
} from './util/conversion';
import Server from './classes/server';

const PORT = 2323;
const server = new Server();
const newHello = new Screen({ reset: false, alarm: false, kybRestore: true, resetMDT: true })
    .addField((f) => {
        f.setPosition({ row: 1, col: 1 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.YELLOW)
            .asRepeatString(':', 79);
    })
    .addField((f) => {
        f.setPosition({ row: 1, col: 3 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.YELLOW)
            .asOutputString('MENU ');
    })
    .addField((f) => {
        f.setPosition({ row: 1, col: 10 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.YELLOW)
            .asOutputString(`NODE VER: ${process.version} `);
    })
    .addField((f) => {
        f.setPosition({ row: 2, col: 1 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.BLUE)
            .asOutputString(new Date().toTimeString());
    })
    .addField((f) => {
        f.setPosition({ row: 24, col: 1 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.YELLOW)
            .asRepeatString(':', 79);
    })
    .addField((f) => {
        f.setPosition({ row: 10, col: 10 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.WHITE)
            .asOutputString('Name . . . .');
    })
    .addField((f) => {
        f.setPosition({ row: 11, col: 10 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.WHITE)
            .asOutputString('Age  . . . . .');
    })
    .addField((f) => {
        f.setPosition({ row: 12, col: 10 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.WHITE)
            .asOutputString('Gender . . .');
    })
    .addField((f) => {
        f.setPosition({ row: 10, col: 24 })
            .setOptions({ isProtected: false, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.YELLOW)
            .setHighlight(EXTENDED_HIGHLIGHTING.UNDERSCORE)
            .asInputString(20);
    })
    .addField((f) => {
        f.setPosition({ row: 11, col: 24 })
            .setOptions({ isProtected: false, display: 'NORMAL', mdt: false, numeric: true })
            .setColor(COLORS.YELLOW)
            .setHighlight(EXTENDED_HIGHLIGHTING.UNDERSCORE)
            .asInputNumber(20);
    })
    .addField((f) => {
        f.setPosition({ row: 12, col: 24 })
            .setOptions({ isProtected: false, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(COLORS.YELLOW)
            .setHighlight(EXTENDED_HIGHLIGHTING.UNDERSCORE)
            .asInputString(10);
    })
    .build();

server.listen(PORT);
server.on('connection', (s) => {
    console.log(newHello.map((b) => b.toString(16)));
    server.send(s, Buffer.from(newHello));
    console.log('Sent hello screen to client:', s.remoteAddress, s.remotePort);
});
server.on('data', (s, data) => {
    server.send(s, Buffer.from(newHello));
});
