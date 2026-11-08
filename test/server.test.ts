import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { afterEach, describe, it } from 'node:test';
import { Server, type ServerOptions, type SessionHandler } from '../src/index.ts';
import { DO, IAC, WONT } from '../src/telnet/constants.ts';
import { TestTerminal } from './support/terminal.ts';

let server: Server | undefined;

async function start(handler: SessionHandler, options: ServerOptions = {}) {
    server = new Server(handler, { queryTimeout: 200, handshakeTimeout: 1000, ...options });
    const { port } = await server.listen(0, '127.0.0.1');
    return port;
}

afterEach(async () => {
    await server?.close();
    server = undefined;
});

describe('Server end to end', () => {
    it('shows a screen and returns what the user typed', async () => {
        let received: unknown;
        const port = await start(async (session) => {
            const reply = await session.show({
                fields: [
                    { row: 1, col: 1, text: 'Name:' },
                    { row: 1, col: 8, name: 'name', input: true, length: 10 },
                ],
            });
            received = reply;
            await session.show({
                fields: [{ row: 1, col: 1, text: `Hello ${reply.values.name}` }],
            });
        });

        const terminal = await TestTerminal.connect(port);
        const screen = await terminal.nextScreen();
        assert.equal(screen.row(1), ' Name:');

        terminal.type('Ada').press('ENTER');
        assert.equal((await terminal.nextScreen()).row(1), ' Hello Ada');
        assert.deepEqual(received, {
            aid: 'ENTER',
            aidCode: 0x7d,
            cursor: { row: 1, col: 12 },
            values: { name: 'Ada' },
        });
        await terminal.close();
    });

    it('closes the terminal when the handler returns', async () => {
        const port = await start(async (session) => {
            await session.show({ fields: [{ row: 1, col: 1, text: 'Bye' }] });
        });
        const terminal = await TestTerminal.connect(port);
        await terminal.nextScreen();
        terminal.press('PF3');
        await terminal.closed;
    });

    it('rejects pending reads with SessionClosedError when the terminal disconnects', async () => {
        let error: unknown;
        const port = await start(async (session) => {
            try {
                await session.show({ fields: [{ row: 1, col: 1, text: 'waiting' }] });
            } catch (err) {
                error = err;
            }
        });
        const terminal = await TestTerminal.connect(port);
        await terminal.nextScreen();
        await terminal.close();
        await new Promise((r) => setTimeout(r, 50));
        assert.equal((error as Error)?.name, 'SessionClosedError');
    });

    it('uses the model size from the terminal type', async () => {
        let size: unknown;
        const port = await start(async (session) => {
            size = session.size;
            await session.show({ fields: [{ row: 43, col: 1, text: 'last row' }] });
        });
        const terminal = await TestTerminal.connect(port, { terminalType: 'IBM-3279-4-E' });
        const screen = await terminal.nextScreen();
        assert.deepEqual(size, { rows: 43, cols: 80 });
        assert.equal(screen.row(43), ' last row');
        assert.equal(terminal.queriesReceived, 1);
        await terminal.close();
    });

    it('uses the size from the query reply, with 14-bit addressing when needed', async () => {
        let info: unknown;
        const port = await start(async (session) => {
            info = session.terminal;
            await session.show({
                fields: [
                    { row: 62, col: 1, text: 'Input:' },
                    { row: 62, col: 10, name: 'x', input: true, length: 5 },
                ],
            });
        });
        const terminal = await TestTerminal.connect(port, {
            terminalType: 'IBM-DYNAMIC',
            queryReply: { rows: 62, cols: 160, color: true },
        });
        const screen = await terminal.nextScreen();
        assert.deepEqual((info as { alternateSize: unknown }).alternateSize, {
            rows: 62,
            cols: 160,
        });
        assert.equal((info as { queried: boolean }).queried, true);
        assert.equal(screen.row(62), ' Input:');
        assert.equal(screen.cursor, screen.address(62, 11));
        await terminal.close();
    });

    it('falls back to the terminal type when the query goes unanswered', async () => {
        let info: unknown;
        const port = await start(async (session) => {
            info = session.terminal;
            await session.show({ fields: [{ row: 32, col: 1, text: 'model 3' }] });
        });
        const terminal = await TestTerminal.connect(port, {
            terminalType: 'IBM-3278-3-E',
            queryReply: null,
        });
        const screen = await terminal.nextScreen();
        assert.equal(screen.row(32), ' model 3');
        assert.equal((info as { queried: boolean }).queried, false);
        await terminal.close();
    });

    it('skips the query for non-extended terminals', async () => {
        const port = await start(async (session) => {
            await session.show({ fields: [{ row: 1, col: 1, text: 'plain' }] });
        });
        const terminal = await TestTerminal.connect(port, { terminalType: 'IBM-3278-2' });
        await terminal.nextScreen();
        assert.equal(terminal.queriesReceived, 0);
        await terminal.close();
    });

    it('sends a message to clients that refuse TN3270 negotiation', async () => {
        let handlerRan = false;
        const port = await start(() => {
            handlerRan = true;
        });
        const received: Buffer[] = [];
        await new Promise<void>((resolve) => {
            const socket = connect(port, '127.0.0.1');
            socket.on('data', (chunk) => {
                received.push(chunk);
                // A plain telnet client that declines everything.
                for (let i = 0; i + 2 < chunk.length; i++) {
                    if (chunk[i] === IAC && chunk[i + 1] === DO) {
                        socket.write(Buffer.from([IAC, WONT, chunk[i + 2]!]));
                    }
                }
            });
            socket.on('end', () => socket.end());
            socket.on('close', () => resolve());
        });
        assert.match(Buffer.concat(received).toString('latin1'), /3270 terminal emulator/);
        assert.equal(handlerRan, false);
    });

    it('reports handler errors through sessionError', async () => {
        const port = await start(async () => {
            throw new Error('boom');
        });
        const failed = new Promise<unknown>((resolve) =>
            server!.on('sessionError', (_session, err) => resolve(err)),
        );
        const terminal = await TestTerminal.connect(port);
        assert.equal(((await failed) as Error).message, 'boom');
        await terminal.closed;
    });
});
