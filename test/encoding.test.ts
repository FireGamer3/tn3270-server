import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeEbcdic, encodeDisplayText, encodeEbcdic } from '../src/datastream/codepage.ts';
import { decodeAddress, encodeAddress, fieldAttribute, wcc } from '../src/datastream/encoding.ts';
import { parseInbound } from '../src/datastream/inbound.ts';

describe('CP037 code page', () => {
    it('encodes well-known characters', () => {
        const pairs: Array<[string, number]> = [
            [' ', 0x40],
            ['A', 0xc1],
            ['Z', 0xe9],
            ['a', 0x81],
            ['z', 0xa9],
            ['0', 0xf0],
            ['9', 0xf9],
            ['[', 0xba],
            [']', 0xbb],
            ['!', 0x5a],
            ['|', 0x4f],
            ['¬', 0x5f],
            ['¢', 0x4a],
            ['@', 0x7c],
        ];
        for (const [char, byte] of pairs) {
            assert.deepEqual([...encodeEbcdic(char)], [byte], `encoding ${char}`);
            assert.equal(decodeEbcdic([byte]), char, `decoding 0x${byte.toString(16)}`);
        }
    });

    it('round-trips every Latin-1 character', () => {
        const all = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join('');
        assert.equal(decodeEbcdic(encodeEbcdic(all)), all);
    });

    it('replaces characters outside Latin-1 with ?', () => {
        assert.equal(decodeEbcdic(encodeEbcdic('a€b😀')), 'a?b?');
    });

    it('keeps control characters out of display text', () => {
        const bytes = encodeDisplayText('a\nb\u0011c');
        assert.deepEqual([...bytes], [0x81, 0x40, 0x82, 0x40, 0x83]);
    });
});

describe('buffer addresses', () => {
    it('uses 12-bit coded addresses below 4096', () => {
        assert.deepEqual(encodeAddress(0), [0x40, 0x40]);
        assert.deepEqual(encodeAddress(80), [0xc1, 0x50]); // row 2, col 1
        assert.deepEqual(encodeAddress(1919), [0x5d, 0x7f]); // last cell of 24x80
    });

    it('round-trips every address', () => {
        for (let a = 0; a <= 0x3fff; a++) {
            const [hi, lo] = encodeAddress(a);
            assert.equal(decodeAddress(hi, lo), a);
        }
    });

    it('rejects addresses out of range', () => {
        assert.throws(() => encodeAddress(-1), RangeError);
        assert.throws(() => encodeAddress(0x4000), RangeError);
    });
});

describe('control bytes', () => {
    it('builds the WCC', () => {
        assert.equal(wcc({}), 0x40);
        assert.equal(wcc({ restoreKeyboard: true, resetModified: true }), 0xc3);
        assert.equal(wcc({ alarm: true, restoreKeyboard: true }), 0xc6);
    });

    it('builds field attributes', () => {
        assert.equal(fieldAttribute({}), 0x40); // unprotected, normal
        assert.equal(fieldAttribute({ protected: true }), 0x60);
        assert.equal(fieldAttribute({ protected: true, numeric: true }), 0xf0); // autoskip
        assert.equal(fieldAttribute({ intensity: 'hidden' }), 0x4c);
        assert.equal(fieldAttribute({ intensity: 'intense', modified: true }), 0xc9);
    });
});

describe('parseInbound', () => {
    it('parses AID, cursor and modified fields', () => {
        // ENTER, cursor at 81, field at 1 = "AB", field at 161 = "9"
        const record = Uint8Array.from([
            0x7d,
            ...encodeAddress(81),
            0x11,
            ...encodeAddress(1),
            0xc1,
            0xc2,
            0x11,
            ...encodeAddress(161),
            0xf9,
        ]);
        const parsed = parseInbound(record);
        assert.equal(parsed.aid, 0x7d);
        assert.equal(parsed.cursor, 81);
        assert.deepEqual(
            parsed.fields.map((f) => [f.address, [...f.data]]),
            [
                [1, [0xc1, 0xc2]],
                [161, [0xf9]],
            ],
        );
    });

    it('handles short reads', () => {
        const parsed = parseInbound(Uint8Array.from([0x6d]));
        assert.equal(parsed.aid, 0x6d);
        assert.equal(parsed.cursor, undefined);
        assert.deepEqual(parsed.fields, []);
    });

    it('decodes 14-bit addresses', () => {
        const record = Uint8Array.from([
            0x7d,
            ...encodeAddress(4500),
            0x11,
            ...encodeAddress(4400),
            0xc1,
        ]);
        const parsed = parseInbound(record);
        assert.equal(parsed.cursor, 4500);
        assert.equal(parsed.fields[0]!.address, 4400);
    });
});
