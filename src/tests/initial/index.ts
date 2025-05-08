import { ScreenBuilder, Server, Constants, VERSION } from '../..';

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
            .setOptions({
                isProtected: true,
                display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                mdt: false,
                numeric: false,
            })
            .setColor(Constants.COLORS.YELLOW)
            .asRepeatString(':', 78);
    })
    .addField((f) => {
        f.setPosition({ row: 1, col: 3 })
            .setOptions({
                isProtected: true,
                display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                mdt: false,
                numeric: false,
            })
            .setColor(Constants.COLORS.YELLOW)
            .setCenterMode(true)
            .asOutputString('MENU ');
    })
    .addField((f) => {
        f.setPosition({ row: 1, col: 10 })
            .setOptions({
                isProtected: true,
                display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                mdt: false,
                numeric: false,
            })
            .setColor(Constants.COLORS.YELLOW)
            .asOutputString(`NODE VER: ${process.version} `);
    })
    .addField((f) => {
        f.setPosition({ row: 2, col: 1 })
            .setOptions({
                isProtected: true,
                display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                mdt: false,
                numeric: false,
            })
            .setColor(Constants.COLORS.BLUE)
            .asOutputString('Goodbye!');
    })
    .build();

server.listen(PORT);
server.on('connection', (client) => {
    client.sendWithClear(Buffer.from(buildHelloScreen()));
    console.log('Sent hello screen to client:', client.id);
});
server.on('data', (client, data) => {
    // console.log('Received data from client:', client.id, data);
    if (data.aid === Constants.AID.PF3) {
        client.sendWithClear(Buffer.from(goodbyeScreen));
        setTimeout(() => {
            client.disconnect();
        }, 2000);
        return;
    }
    client.sendWithClear(Buffer.from(buildHelloScreen()));
});

function buildHelloScreen() {
    return new ScreenBuilder({ reset: false, alarm: false, kybRestore: true, resetMDT: true })
        .addField((f) => {
            f.setPosition({ row: 1, col: 1 })
                .setOptions({
                    isProtected: true,
                    display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                    mdt: false,
                    numeric: false,
                })
                .setColor(Constants.COLORS.YELLOW)
                .asRepeatString(':', 78);
        })
        .addField((f) => {
            f.setPosition({ row: 1, col: 3 })
                .setOptions({
                    isProtected: true,
                    display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                    mdt: false,
                    numeric: false,
                })
                .setColor(Constants.COLORS.YELLOW)
                .asOutputString('TESTSCR ');
        })
        .addField((f) => {
            f.setPosition({ row: 2, col: 1 })
                .setOptions({
                    isProtected: true,
                    display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                    mdt: false,
                    numeric: false,
                })
                .setColor(Constants.COLORS.BLUE)
                .setCenterMode(true)
                .asOutputString(new Date().toTimeString());
        })
        .addField((f) => {
            f.setPosition({ row: 4, col: 1 })
                .setOptions({
                    isProtected: true,
                    display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                    mdt: false,
                    numeric: false,
                })
                .setColor(Constants.COLORS.GREEN)
                .setCenterMode(true)
                .asOutputString('Welcome to the TN3270 Testing Screen!');
        })
        .addField((f) => {
            f.setPosition({ row: 24, col: 1 })
                .setOptions({
                    isProtected: true,
                    display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                    mdt: false,
                    numeric: false,
                })
                .setColor(Constants.COLORS.YELLOW)
                .asRepeatString(':', 78);
        })
        .addField((f) => {
            f.setPosition({ row: 24, col: 3 })
                .setOptions({
                    isProtected: true,
                    display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                    mdt: false,
                    numeric: false,
                })
                .setColor(Constants.COLORS.YELLOW)
                .asOutputString(`TN3270 Server v${VERSION} `);
        })
        .addField((f) => {
            f.setPosition({ row: 24, col: 26 })
                .setOptions({
                    isProtected: true,
                    display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                    mdt: false,
                    numeric: false,
                })
                .setColor(Constants.COLORS.YELLOW)
                .asOutputString(`NODE VER: ${process.version} `);
        })
        .build();
}
