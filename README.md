# tn3270-server

A TN3270 server written in TypeScript. Inspired by [go3270 (A Go 3270 Server implementation by Matthew R. Wilson)](https://github.com/racingmars/go3270/).

The goal of this project is a lot simpler than the original with the goal of making a MVP implementation of a TN3270 server. Abstractions are left to your discretion. I will get to making my own abstractions later in a separate project.

## Installation

```bash
npm install tn3270-server
```

## Usage

```ts
import { Server, Constants, ScreenBuilder } from 'tn3270-server';

const server = new Server();

server.listen(2323);

let sampleScreen = new ScreenBuilder({
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
            .asOutputString('Hello World!');
    })
    .addField((f) => {
        f.setPosition({ row: 2, col: 1 })
            .setOptions({
                isProtected: true,
                display: Constants.FIELD_DISPLAY_OPTIONS.NORMAL,
                mdt: false,
                numeric: false,
            })
            .setColor(Constants.COLORS.YELLOW)
            .asRepeatString(':', 78);
    })
    .build();

server.on('connection', (client) => {
    client.sendWithClear(Buffer.from(sampleScreen));
});

server.on('data', (client, data) => {
    if (data.aid === Constants.AID.PF3) {
        // Disconnect on PF3
        client.disconnect();
        return;
    }
});
```
