# tn3270-server

A TN3270 server written in TypeScript. 3270 terminal emulators (x3270, wc3270, c3270, Vista, ...) connect to it and are shown screens your code defines. Inspired by [go3270 (A Go 3270 Server implementation by Matthew R. Wilson)](https://github.com/racingmars/go3270/).

> This branch is the rewrite and a WIP.

## Usage

```ts
import { Server } from 'tn3270-server';

const server = new Server(async (session) => {
    const reply = await session.show({
        fields: [
            { row: 1, col: 1, text: 'WHAT IS YOUR NAME?', intense: true, color: 'yellow' },
            { row: 3, col: 1, text: 'Name ===>' },
            { row: 3, col: 11, name: 'name', input: true, length: 20, highlight: 'underscore' },
            { row: 24, col: 1, text: 'PF3=Exit', color: 'turquoise' },
        ],
    });

    if (reply.aid === 'PF3') return; // returning from the handler disconnects the terminal

    await session.show({
        fields: [{ row: 1, col: 1, text: `Hello, ${reply.values.name?.trim()}!` }],
    });
});

await server.listen(3270);
```

Then connect with an emulator, e.g. `c3270 localhost:3270`.

Run the bundled demo (sign-on, menu, terminal info) with `pnpm dev`.

### Screens and fields

A `Screen` is a list of `Field`s. As on a real 3270, each field starts with an attribute byte at `row`/`col` (shown as a blank). The field's content starts one column to the right. Rows and columns are 1-based.

| Field option | Meaning                                                                         |
| ------------ | ------------------------------------------------------------------------------- |
| `text`       | Content. For input fields, the initial value.                                   |
| `input`      | The user can type into it.                                                      |
| `name`       | Key in `reply.values` (and in the `values` option).                             |
| `length`     | Input fields: exact length; an autoskip field is added right after the content. |
| `numeric`    | Numeric-only input.                                                             |
| `intense`    | High intensity.                                                                 |
| `hidden`     | Not displayed (passwords).                                                      |
| `color`      | `blue` `red` `pink` `green` `turquoise` `yellow` `white`                        |
| `highlight`  | `blink` `reverse` `underscore` `intensify`                                      |

A field with no `length` runs until the next field starts, as it would on a real 3270.

`color` and `highlight` are left out automatically on terminals that don't support them.

`screen.cursor` takes an input field's name or a `{ row, col }`. It defaults to the first input field.

### Session API

- `session.show(screen, options?)` draws the screen and resolves with the next key press: `{ aid, aidCode, cursor, values }`. `values` holds every named input field.
- `session.write(screen, options?)` draws without waiting. `session.read()` waits for the next key.
- Options: `values` (initial field contents), `cursor`, `alarm`, and `erase: false`, which draws over the current screen instead of clearing it.
- `session.terminal` reports the terminal type, model, screen sizes, and color / highlighting / extended data stream support.
- `session.size` is the size screens are drawn at.
- `session.sendDataStream(bytes)` sends a raw outbound data stream; build one with `DataStream`.
- `session.close()` disconnects the terminal.
- Events: `input` (every key press) and `close`.

If the terminal disconnects while a handler is waiting, the pending `show`/`read` rejects with `SessionClosedError`. The server swallows that error. Any other error thrown by the handler is emitted as `sessionError`, or logged to the console if nothing listens.

### Server options

```ts
new Server(handler, {
    handshakeTimeout: 5000, // ms allowed for telnet negotiation
    queryTimeout: 2000, // ms to wait for the terminal's query reply
    query: true, // ask extended terminals for their real size and capabilities
    rejectMessage: '...', // text sent to clients that are not 3270 terminals
    logger: console, // connection lifecycle logging (silent by default)
});
```

## How it works

- **Telnet negotiation:** TERMINAL-TYPE, then BINARY and END-OF-RECORD in both directions, following RFC 1143 rules so negotiation can't loop. Clients that refuse are sent `rejectMessage` and disconnected.
- **Screen sizes:** model 2/3/4/5 sizes come from the terminal type (`IBM-3279-4-E` → 43×80). Extended (`-E`, `IBM-DYNAMIC`) terminals also get a Read Partition Query, and the reply's real size and color support take precedence. Larger screens are drawn with Erase/Write Alternate. Buffers larger than 4096 cells use 14-bit addressing.
- **Code page:** text is converted with CP037.
- **Not supported:** TN3270E (RFC 2355), printer sessions, and code pages other than CP037. Clients that offer TN3270E fall back to plain TN3270.

## Development

Requires Node 22.18 or newer: tests and the demo run the TypeScript sources directly with Node's built-in type stripping. `tsc` only typechecks; `tsdown` produces the published ESM/CJS bundles and declarations.

```bash
pnpm install
pnpm test        # unit tests + end-to-end tests against a built-in test terminal
pnpm typecheck
pnpm build
```

`test/support/terminal.ts` contains a small 3270 terminal emulator. The end-to-end tests use it to connect to a real server socket, render screens, type into fields and press keys.
