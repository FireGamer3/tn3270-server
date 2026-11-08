import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Command } from '../src/datastream/constants.ts';
import { parseInbound } from '../src/datastream/inbound.ts';
import { mapResponse, renderScreen, type Screen } from '../src/screen.ts';
import { parseTerminalType } from '../src/terminal.ts';
import { ScreenBuffer } from './support/terminal.ts';

const login: Screen = {
    fields: [
        { row: 1, col: 1, text: 'SIGN ON', intense: true, color: 'yellow' },
        { row: 3, col: 1, text: 'User:' },
        { row: 3, col: 12, name: 'user', input: true, length: 8, highlight: 'underscore' },
        { row: 4, col: 1, text: 'Password:' },
        { row: 4, col: 12, name: 'password', input: true, length: 8, hidden: true },
    ],
};

function draw(screen: Screen, terminalType = 'IBM-3279-2-E', values?: Record<string, string>) {
    const terminal = parseTerminalType(terminalType);
    const rendered = renderScreen(
        screen,
        { terminal, currentSize: terminal.defaultSize },
        { values },
    );
    const buffer = new ScreenBuffer(terminal.alternateSize);
    buffer.applyWrite(rendered.bytes);
    return { rendered, buffer, terminal };
}

describe('renderScreen', () => {
    it('places text one column after the attribute', () => {
        const { buffer } = draw(login);
        assert.equal(buffer.row(1), ' SIGN ON');
        assert.equal(buffer.row(3), ' User:');
    });

    it('puts the cursor in the first input field and unlocks the keyboard', () => {
        const { buffer } = draw(login);
        assert.equal(buffer.cursor, buffer.address(3, 13));
        assert.equal(buffer.keyboardLocked, false);
    });

    it('closes fixed-length input fields with an autoskip attribute', () => {
        const { buffer } = draw(login);
        const end = buffer.attributeAt(3, 21);
        assert.ok(end, 'expected an attribute after the 8 character field');
        assert.equal(end.fa & 0x30, 0x30); // protected + numeric = autoskip
    });

    it('uses extended attributes only when the terminal supports them', () => {
        const color = draw(login, 'IBM-3279-2-E').buffer;
        assert.equal(color.attributeAt(1, 1)!.color, 0xf6);
        assert.equal(color.attributeAt(3, 12)!.highlight, 0xf4);

        const mono = draw(login, 'IBM-3278-2').buffer;
        assert.equal(mono.attributeAt(1, 1)!.color, 0);
        assert.equal(mono.attributeAt(1, 1)!.fa & 0x0c, 0x08); // still intense
    });

    it('fills input fields from values and hides password fields', () => {
        const { buffer } = draw(login, undefined, { user: 'ALICE', password: 'secret' });
        assert.equal(buffer.row(3), ' User:      ALICE');
        assert.equal(buffer.row(4), ' Password:');
    });

    it('uses Erase/Write Alternate on larger models', () => {
        const { rendered, buffer } = draw(
            { fields: [{ row: 43, col: 1, text: 'bottom line' }] },
            'IBM-3278-4',
        );
        assert.equal(rendered.bytes[0], Command.ERASE_WRITE_ALTERNATE);
        assert.equal(buffer.size.rows, 43);
        assert.equal(buffer.row(43), ' bottom line');
    });

    it('rejects positions outside the screen', () => {
        assert.throws(() => draw({ fields: [{ row: 25, col: 1, text: 'x' }] }), RangeError);
        assert.throws(() => draw({ fields: [{ row: 1, col: 81, text: 'x' }] }), RangeError);
    });

    it('rejects duplicate field names and unknown cursor fields', () => {
        assert.throws(() =>
            draw({
                fields: [
                    { row: 1, col: 1, name: 'a', input: true },
                    { row: 2, col: 1, name: 'a', input: true },
                ],
            }),
        );
        assert.throws(() => draw({ fields: [{ row: 1, col: 1, text: 'x' }], cursor: 'nope' }));
    });
});

describe('mapResponse', () => {
    it('returns typed values keyed by name', () => {
        const { rendered, buffer } = draw(login);
        buffer.type('BOB');
        buffer.type('hunter2', 4, 13);
        const response = mapResponse(
            parseInbound(Uint8Array.from(buffer.readModified('ENTER'))),
            rendered,
            buffer.size,
        );
        assert.equal(response.aid, 'ENTER');
        assert.deepEqual(response.values, { user: 'BOB', password: 'hunter2' });
        assert.deepEqual(response.cursor, { row: 4, col: 20 });
    });

    it('includes untouched fields with their initial value', () => {
        const { rendered, buffer } = draw(login, undefined, { user: 'ALICE' });
        const response = mapResponse(
            parseInbound(Uint8Array.from(buffer.readModified('PF3'))),
            rendered,
            buffer.size,
        );
        assert.equal(response.aid, 'PF3');
        assert.deepEqual(response.values, { user: 'ALICE', password: '' });
    });

    it('reports a cleared field as empty', () => {
        const { rendered, buffer } = draw(login, undefined, { user: 'ALICE' });
        buffer.eraseField(3, 13);
        const response = mapResponse(
            parseInbound(Uint8Array.from(buffer.readModified('ENTER'))),
            rendered,
            buffer.size,
        );
        assert.equal(response.values.user, '');
    });
});
