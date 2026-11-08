import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DO, DONT, EOR, IAC, SB, SE, WILL, WONT } from '../src/telnet/constants.ts';
import { TelnetConnection } from '../src/telnet/connection.ts';

function setup() {
    const written: number[][] = [];
    const telnet = new TelnetConnection(
        { write: (data) => written.push([...data]) },
        { remoteOptions: [24, 25, 0], localOptions: [25, 0] },
    );
    const records: number[][] = [];
    telnet.on('record', (r) => records.push([...r]));
    return { telnet, written, records };
}

describe('TelnetConnection', () => {
    it('splits records on IAC EOR, even across chunks', () => {
        const { telnet, records } = setup();
        telnet.feed(Uint8Array.from([0x7d, 0x40]));
        telnet.feed(Uint8Array.from([0x40, IAC]));
        telnet.feed(Uint8Array.from([EOR, 0x6d, IAC, EOR]));
        assert.deepEqual(records, [[0x7d, 0x40, 0x40], [0x6d]]);
    });

    it('unescapes IAC IAC inside records', () => {
        const { telnet, records } = setup();
        telnet.feed(Uint8Array.from([0x01, IAC, IAC, 0x02, IAC, EOR]));
        assert.deepEqual(records, [[0x01, 0xff, 0x02]]);
    });

    it('escapes IAC and appends IAC EOR on outbound records', () => {
        const { telnet, written } = setup();
        telnet.sendRecord([0xf5, 0xff, 0x40]);
        assert.deepEqual(written, [[0xf5, 0xff, 0xff, 0x40, IAC, EOR]]);
    });

    it('parses sub-negotiation', () => {
        const { telnet } = setup();
        const seen: Array<[number, number[]]> = [];
        telnet.on('subnegotiation', (opt, data) => seen.push([opt, [...data]]));
        telnet.feed(Uint8Array.from([IAC, SB, 24, 0, ...Buffer.from('IBM-3278-2'), IAC, SE]));
        assert.deepEqual(seen, [[24, [0, ...Buffer.from('IBM-3278-2')]]]);
    });

    it('completes options we requested without replying again', () => {
        const { telnet, written } = setup();
        telnet.requestRemote(24);
        assert.deepEqual(written, [[IAC, DO, 24]]);
        assert.equal(telnet.isPending(24), true);
        telnet.feed(Uint8Array.from([IAC, WILL, 24]));
        assert.equal(telnet.isRemoteEnabled(24), true);
        assert.equal(telnet.isPending(24), false);
        assert.equal(written.length, 1);
    });

    it('records a refusal', () => {
        const { telnet } = setup();
        telnet.requestRemote(24);
        telnet.feed(Uint8Array.from([IAC, WONT, 24]));
        assert.equal(telnet.isRemoteEnabled(24), false);
        assert.equal(telnet.isPending(24), false);
    });

    it('accepts supported options offered by the peer', () => {
        const { telnet, written } = setup();
        telnet.feed(Uint8Array.from([IAC, DO, 0]));
        assert.deepEqual(written, [[IAC, WILL, 0]]);
        assert.equal(telnet.isLocalEnabled(0), true);
    });

    it('refuses unsupported options such as TN3270E', () => {
        const { telnet, written } = setup();
        telnet.feed(Uint8Array.from([IAC, WILL, 40, IAC, DO, 40]));
        assert.deepEqual(written, [
            [IAC, DONT, 40],
            [IAC, WONT, 40],
        ]);
    });

    it('does not loop when the peer repeats itself', () => {
        const { telnet, written } = setup();
        telnet.feed(Uint8Array.from([IAC, WILL, 25, IAC, WILL, 25, IAC, WILL, 25]));
        assert.deepEqual(written, [[IAC, DO, 25]]);
    });

    it('reports oversized records', () => {
        const telnet = new TelnetConnection(
            { write: () => {} },
            { remoteOptions: [], localOptions: [], maxRecordSize: 4 },
        );
        let error: Error | undefined;
        telnet.on('error', (e) => (error = e));
        telnet.feed(Uint8Array.from([1, 2, 3, 4, 5]));
        assert.match(error?.message ?? '', /exceeded/);
    });
});
