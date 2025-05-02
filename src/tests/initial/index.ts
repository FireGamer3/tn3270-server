import { ScreenBuilder, Server, Constants } from '../..';

const PORT = 2323;
const server = new Server();

const goodbyeScreen = new ScreenBuilder({
    reset: false,
    alarm: false,
    kybRestore: true,
    resetMDT: true,
})
    .addField((f) => {
        f.setPosition({ row: 1, col: 1 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(Constants.COLORS.YELLOW)
            .asRepeatString(':', 78);
    })
    .addField((f) => {
        f.setPosition({ row: 1, col: 3 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(Constants.COLORS.YELLOW)
            .asOutputString('MENU ');
    })
    .addField((f) => {
        f.setPosition({ row: 1, col: 10 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(Constants.COLORS.YELLOW)
            .asOutputString(`NODE VER: ${process.version} `);
    })
    .addField((f) => {
        f.setPosition({ row: 2, col: 1 })
            .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
            .setColor(Constants.COLORS.BLUE)
            .asOutputString('Goodbye!');
    })
    .build();

server.listen(PORT);
server.on('connection', (s) => {
    server.sendWithClear(s, Buffer.from(buildHelloScreen()));
    console.log('Sent hello screen to client:', s.remoteAddress, s.remotePort);
});
server.on('data', (s, data) => {
    if (data.aid === Constants.AID.PF3) {
        server.sendWithClear(s, Buffer.from(goodbyeScreen));
        setTimeout(() => {
            server.disconnect(s);
        }, 2000);
        return;
    }
    server.sendWithClear(s, Buffer.from(buildHelloScreen()));
});

function buildHelloScreen() {
    return new ScreenBuilder({ reset: false, alarm: false, kybRestore: true, resetMDT: true })
        .addField((f) => {
            f.setPosition({ row: 1, col: 1 })
                .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.YELLOW)
                .asRepeatString(':', 78);
        })
        .addField((f) => {
            f.setPosition({ row: 1, col: 3 })
                .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.YELLOW)
                .asOutputString('MENU ');
        })
        .addField((f) => {
            f.setPosition({ row: 1, col: 10 })
                .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.YELLOW)
                .asOutputString(`NODE VER: ${process.version} `);
        })
        .addField((f) => {
            f.setPosition({ row: 2, col: 1 })
                .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.BLUE)
                .asOutputString(new Date().toTimeString());
        })
        .addField((f) => {
            f.setPosition({ row: 24, col: 1 })
                .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.YELLOW)
                .asRepeatString(':', 78);
        })
        .addField((f) => {
            f.setPosition({ row: 10, col: 10 })
                .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.WHITE)
                .asOutputString('Name . . . .');
        })
        .addField((f) => {
            f.setPosition({ row: 11, col: 10 })
                .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.WHITE)
                .asOutputString('Age  . . . . .');
        })
        .addField((f) => {
            f.setPosition({ row: 12, col: 10 })
                .setOptions({ isProtected: true, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.WHITE)
                .asOutputString('Gender . . .');
        })
        .addField((f) => {
            f.setPosition({ row: 10, col: 24 })
                .setOptions({ isProtected: false, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.YELLOW)
                .asInputString(20);
        })
        .addField((f) => {
            f.setPosition({ row: 11, col: 24 })
                .setOptions({ isProtected: false, display: 'NORMAL', mdt: false, numeric: true })
                .setColor(Constants.COLORS.YELLOW)
                .asInputNumber(3);
        })
        .addField((f) => {
            f.setPosition({ row: 12, col: 24 })
                .setOptions({ isProtected: false, display: 'NORMAL', mdt: false, numeric: false })
                .setColor(Constants.COLORS.YELLOW)
                .asInputString(10);
        })
        .setStartPosition({ row: 10, col: 25 })
        .build();
}
