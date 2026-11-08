import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseStructuredFields, summarizeQueryReplies } from '../src/datastream/inbound.ts';
import { applyQueryReply, parseTerminalType } from '../src/terminal.ts';

describe('parseTerminalType', () => {
    it('maps 3278/3279 models to screen sizes', () => {
        const cases: Array<[string, number, number]> = [
            ['IBM-3278-2', 24, 80],
            ['IBM-3278-3', 32, 80],
            ['IBM-3279-4-E', 43, 80],
            ['IBM-3278-5-E', 27, 132],
        ];
        for (const [name, rows, cols] of cases) {
            const info = parseTerminalType(name);
            assert.deepEqual(info.alternateSize, { rows, cols }, name);
            assert.deepEqual(info.defaultSize, { rows: 24, cols: 80 }, name);
        }
    });

    it('detects extended data stream and color', () => {
        assert.equal(parseTerminalType('IBM-3278-2').extended, false);
        assert.equal(parseTerminalType('IBM-3278-2').color, false);
        assert.equal(parseTerminalType('IBM-3278-2-E').extended, true);
        assert.equal(parseTerminalType('IBM-3279-2-E').color, true);
        assert.equal(parseTerminalType('ibm-3279-2-e').terminalType, 'IBM-3279-2-E');
        assert.equal(parseTerminalType('IBM-DYNAMIC').extended, true);
    });

    it('falls back to 24x80 for unknown types', () => {
        assert.deepEqual(parseTerminalType('VT100').alternateSize, { rows: 24, cols: 80 });
    });
});

describe('query replies', () => {
    const sf = (data: number[]) => [(data.length + 2) >> 8, (data.length + 2) & 0xff, ...data];

    it('reads the implicit partition sizes and capabilities', () => {
        const bytes = Uint8Array.from([
            ...sf([0x81, 0x81, 0x01, 0x00, 0x00, 0x50, 0x00, 0x18, 0x00]),
            ...sf([
                0x81, 0xa6, 0x00, 0x00, 0x0b, 0x01, 0x00, 0x00, 80, 0x00, 24, 0x00, 132, 0x00, 27,
            ]),
            ...sf([0x81, 0x86, 0x00, 0x08]),
            ...sf([0x81, 0x87, 0x04]),
        ]);
        const summary = summarizeQueryReplies(parseStructuredFields(bytes));
        assert.deepEqual(summary.defaultSize, { rows: 24, cols: 80 });
        assert.deepEqual(summary.alternateSize, { rows: 27, cols: 132 });
        assert.equal(summary.color, true);
        assert.equal(summary.highlighting, true);
    });

    it('falls back to the usable area when there is no implicit partition reply', () => {
        const bytes = Uint8Array.from(sf([0x81, 0x81, 0x01, 0x00, 0x00, 100, 0x00, 50, 0x00]));
        const summary = summarizeQueryReplies(parseStructuredFields(bytes));
        assert.deepEqual(summary.alternateSize, { rows: 50, cols: 100 });
        assert.equal(summary.color, false);
    });

    it('ignores sizes too large for 14-bit addressing', () => {
        const info = applyQueryReply(parseTerminalType('IBM-DYNAMIC'), {
            alternateSize: { rows: 200, cols: 200 },
            color: true,
            highlighting: true,
            codes: [],
        });
        assert.deepEqual(info.alternateSize, { rows: 24, cols: 80 });
        assert.equal(info.queried, true);
    });

    it('stops at a truncated structured field', () => {
        assert.deepEqual(parseStructuredFields(Uint8Array.from([0x00, 0x10, 0x81, 0x81])), []);
    });
});
