/**
 * A small 3270 terminal emulator used to drive the server in tests. It
 * implements enough of the data stream to render screens, type into fields
 * and send Read Modified replies the way x3270 does.
 */
import { connect, type Socket } from 'node:net';
import { decodeEbcdic, encodeEbcdic } from '../../src/datastream/codepage.ts';
import { Aid, Command, Order, SHORT_READ_AIDS, type AidName } from '../../src/datastream/constants.ts';
import { decodeAddress, encodeAddress, FieldAttributeBits } from '../../src/datastream/encoding.ts';
import { TERMINAL_TYPE_IS, TERMINAL_TYPE_SEND, TelnetOption } from '../../src/telnet/constants.ts';
import { TelnetConnection } from '../../src/telnet/connection.ts';
import type { ScreenSize } from '../../src/terminal.ts';

interface CellAttribute {
    fa: number;
    color: number;
    highlight: number;
}

/** The terminal's display buffer and the data stream interpreter. */
export class ScreenBuffer {
    size: ScreenSize = { rows: 24, cols: 80 };
    chars: number[] = new Array(24 * 80).fill(0);
    attributes = new Map<number, CellAttribute>();
    cursor = 0;
    keyboardLocked = true;
    lastCommand: number | undefined;
    alternateSize: ScreenSize;

    constructor(alternateSize: ScreenSize = { rows: 24, cols: 80 }) {
        this.alternateSize = alternateSize;
    }

    get length() {
        return this.size.rows * this.size.cols;
    }

    address(row: number, col: number) {
        return (row - 1) * this.size.cols + (col - 1);
    }

    /** Apply a Write / Erase-Write / Erase-Write-Alternate record. */
    applyWrite(record: Uint8Array) {
        const command = record[0]!;
        this.lastCommand = command;
        let address = this.cursor;

        if (command === Command.ERASE_WRITE || command === Command.ERASE_WRITE_ALTERNATE) {
            this.size =
                command === Command.ERASE_WRITE ? { rows: 24, cols: 80 } : this.alternateSize;
            this.chars = new Array(this.length).fill(0);
            this.attributes.clear();
            this.cursor = 0;
            address = 0;
        } else if (command !== Command.WRITE) {
            throw new Error(`Unsupported command 0x${command.toString(16)}`);
        }

        const wcc = record[1] ?? 0;
        if (wcc & 0x01) for (const attr of this.attributes.values()) attr.fa &= ~0x01;

        const advance = () => (address = (address + 1) % this.length);
        for (let i = 2; i < record.length; i++) {
            const byte = record[i]!;
            switch (byte) {
                case Order.SET_BUFFER_ADDRESS:
                    address = decodeAddress(record[i + 1]!, record[i + 2]!);
                    i += 2;
                    break;
                case Order.START_FIELD:
                    this.attributes.set(address, { fa: record[++i]!, color: 0, highlight: 0 });
                    this.chars[address] = 0;
                    advance();
                    break;
                case Order.START_FIELD_EXTENDED: {
                    const attr: CellAttribute = { fa: 0, color: 0, highlight: 0 };
                    const count = record[++i]!;
                    for (let n = 0; n < count; n++) {
                        const type = record[++i]!;
                        const value = record[++i]!;
                        if (type === 0xc0) attr.fa = value;
                        if (type === 0x42) attr.color = value;
                        if (type === 0x41) attr.highlight = value;
                    }
                    this.attributes.set(address, attr);
                    this.chars[address] = 0;
                    advance();
                    break;
                }
                case Order.SET_ATTRIBUTE:
                    i += 2;
                    break;
                case Order.INSERT_CURSOR:
                    this.cursor = address;
                    break;
                case Order.REPEAT_TO_ADDRESS: {
                    const stop = decodeAddress(record[i + 1]!, record[i + 2]!);
                    const char = record[i + 3]!;
                    i += 3;
                    do {
                        this.chars[address] = char;
                        advance();
                    } while (address !== stop);
                    break;
                }
                case Order.PROGRAM_TAB:
                case Order.ERASE_UNPROTECTED_TO_ADDRESS:
                case Order.MODIFY_FIELD:
                case Order.GRAPHIC_ESCAPE:
                    throw new Error(`Order 0x${byte.toString(16)} not supported by test terminal`);
                default:
                    this.attributes.delete(address);
                    this.chars[address] = byte;
                    advance();
            }
        }

        if (wcc & 0x02) this.keyboardLocked = false;
    }

    /** Address of the attribute governing `address`, or undefined on an unformatted screen. */
    fieldStart(address: number): number | undefined {
        for (let n = 0; n < this.length; n++) {
            const a = (address - n + this.length) % this.length;
            if (this.attributes.has(a)) return a;
        }
        return undefined;
    }

    /** Screen contents as text, one string per row. Hidden fields render blank. */
    text(): string[] {
        const rows: string[] = [];
        for (let r = 0; r < this.size.rows; r++) {
            let line = '';
            for (let c = 0; c < this.size.cols; c++) {
                const a = r * this.size.cols + c;
                const start = this.fieldStart(a);
                const hidden =
                    start !== undefined &&
                    (this.attributes.get(start)!.fa & FieldAttributeBits.DISPLAY_MASK) ===
                        FieldAttributeBits.HIDDEN;
                const char = this.chars[a]!;
                line += this.attributes.has(a) || hidden || char === 0 ? ' ' : decodeEbcdic([char]);
            }
            rows.push(line);
        }
        return rows;
    }

    /** Text of one row with trailing blanks removed. */
    row(row: number) {
        return this.text()[row - 1]!.trimEnd();
    }

    attributeAt(row: number, col: number) {
        return this.attributes.get(this.address(row, col));
    }

    /** Type at the cursor, or at row/col, like a user would. */
    type(text: string, row?: number, col?: number) {
        if (this.keyboardLocked) throw new Error('Keyboard is locked');
        let address = row !== undefined && col !== undefined ? this.address(row, col) : this.cursor;
        const start = this.fieldStart(address);
        if (start === undefined || start === address) throw new Error('Not in a field');
        const attr = this.attributes.get(start)!;
        if (attr.fa & FieldAttributeBits.PROTECTED) throw new Error('Field is protected');

        for (const byte of encodeEbcdic(text)) {
            if (this.attributes.has(address)) throw new Error('Typed past the end of the field');
            this.chars[address] = byte;
            address = (address + 1) % this.length;
        }
        attr.fa |= FieldAttributeBits.MODIFIED;
        this.cursor = address;
    }

    /** Erase to end of field, like the EOF key. */
    eraseField(row: number, col: number) {
        let address = this.address(row, col);
        const attr = this.attributes.get(this.fieldStart(address)!)!;
        while (!this.attributes.has(address)) {
            this.chars[address] = 0;
            address = (address + 1) % this.length;
        }
        attr.fa |= FieldAttributeBits.MODIFIED;
    }

    /** Build the inbound record for an AID key (Read Modified format). */
    readModified(aid: AidName): number[] {
        const code = Aid[aid];
        this.keyboardLocked = true;
        if (SHORT_READ_AIDS.has(code)) return [code];

        const out = [code, ...encodeAddress(this.cursor)];
        const starts = [...this.attributes.keys()].sort((a, b) => a - b);
        for (const start of starts) {
            if (!(this.attributes.get(start)!.fa & FieldAttributeBits.MODIFIED)) continue;
            const first = (start + 1) % this.length;
            out.push(Order.SET_BUFFER_ADDRESS, ...encodeAddress(first));
            for (let a = first; !this.attributes.has(a); a = (a + 1) % this.length) {
                if (this.chars[a] !== 0) out.push(this.chars[a]!);
            }
        }
        return out;
    }
}

export interface TestTerminalOptions {
    terminalType?: string;
    /**
     * How to answer the server's Read Partition Query. Defaults to the model's
     * size (with color) for extended terminals; `null` ignores the query.
     */
    queryReply?: { rows: number; cols: number; color?: boolean } | null;
}

const MODEL_SIZES: Record<string, ScreenSize> = {
    '2': { rows: 24, cols: 80 },
    '3': { rows: 32, cols: 80 },
    '4': { rows: 43, cols: 80 },
    '5': { rows: 27, cols: 132 },
};

/** A TN3270 client connected over TCP. */
export class TestTerminal {
    readonly screen: ScreenBuffer;
    /** Number of Read Partition Queries received. */
    queriesReceived = 0;
    readonly closed: Promise<void>;

    private readonly socket: Socket;
    private readonly telnet: TelnetConnection;
    private unreadWrites = 0;
    private writeWaiters: Array<() => void> = [];

    private readonly queryReply: { rows: number; cols: number; color?: boolean } | null;

    private constructor(socket: Socket, options: TestTerminalOptions) {
        this.socket = socket;
        const terminalType = options.terminalType ?? 'IBM-3279-2-E';
        const model = /^IBM-\d{4}-(\d)/.exec(terminalType)?.[1];
        const modelSize = MODEL_SIZES[model ?? '2'] ?? MODEL_SIZES['2']!;
        this.queryReply =
            options.queryReply === undefined ? { ...modelSize, color: true } : options.queryReply;
        const alternate = this.queryReply ?? modelSize;
        this.screen = new ScreenBuffer({ rows: alternate.rows, cols: alternate.cols });

        this.telnet = new TelnetConnection(socket, {
            remoteOptions: [TelnetOption.END_OF_RECORD, TelnetOption.BINARY],
            localOptions: [
                TelnetOption.TERMINAL_TYPE,
                TelnetOption.END_OF_RECORD,
                TelnetOption.BINARY,
            ],
        });
        this.telnet.on('subnegotiation', (option, payload) => {
            if (option === TelnetOption.TERMINAL_TYPE && payload[0] === TERMINAL_TYPE_SEND) {
                this.telnet.sendSubnegotiation(TelnetOption.TERMINAL_TYPE, [
                    TERMINAL_TYPE_IS,
                    ...Buffer.from(terminalType, 'latin1'),
                ]);
            }
        });
        this.telnet.on('record', (record) => this.handleRecord(record));
        socket.on('data', (chunk) => this.telnet.feed(chunk));
        socket.on('end', () => socket.end());
        this.closed = new Promise((resolve) => socket.on('close', () => resolve()));
    }

    static connect(port: number, options: TestTerminalOptions = {}): Promise<TestTerminal> {
        return new Promise((resolve, reject) => {
            const socket = connect(port, '127.0.0.1');
            socket.once('error', reject);
            socket.once('connect', () => resolve(new TestTerminal(socket, options)));
        });
    }

    /** Resolve when the next screen write arrives (or one already arrived unread). */
    nextScreen(timeoutMs = 2000): Promise<ScreenBuffer> {
        if (this.unreadWrites > 0) {
            this.unreadWrites--;
            return Promise.resolve(this.screen);
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error('Timed out waiting for a screen')),
                timeoutMs,
            );
            this.writeWaiters.push(() => {
                clearTimeout(timer);
                resolve(this.screen);
            });
        });
    }

    type(text: string, row?: number, col?: number) {
        this.screen.type(text, row, col);
        return this;
    }

    press(aid: AidName) {
        this.telnet.sendRecord(this.screen.readModified(aid));
    }

    close() {
        this.socket.end();
        return this.closed;
    }

    private handleRecord(record: Buffer) {
        if (record[0] === Command.WRITE_STRUCTURED_FIELD) {
            if (record[3] === 0x01 && record[5] === 0x02) {
                this.queriesReceived++;
                if (this.queryReply) this.telnet.sendRecord(this.buildQueryReply());
            }
            return;
        }
        this.screen.applyWrite(record);
        const waiter = this.writeWaiters.shift();
        if (waiter) waiter();
        else this.unreadWrites++;
    }

    private buildQueryReply(): number[] {
        const { rows, cols, color } = this.queryReply!;
        const sf = (data: number[]) => [
            ((data.length + 2) >> 8) & 0xff,
            (data.length + 2) & 0xff,
            ...data,
        ];
        const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
        const out: number[] = [Aid.STRUCTURED_FIELD];
        // Usable area: flags, flags, width, height, ...
        out.push(...sf([0x81, 0x81, 0x01, 0x00, ...u16(cols), ...u16(rows), 0x00]));
        // Implicit partition: reserved(2), SDP len 0x0B id 0x01 flags, default w/h, alternate w/h.
        out.push(
            ...sf([
                0x81,
                0xa6,
                0x00,
                0x00,
                0x0b,
                0x01,
                0x00,
                ...u16(80),
                ...u16(24),
                ...u16(cols),
                ...u16(rows),
            ]),
        );
        if (color) out.push(...sf([0x81, 0x86, 0x00, 0x08, 0x00, 0xf4, 0xf1, 0xf1, 0xf2, 0xf2]));
        out.push(...sf([0x81, 0x87, 0x04, 0x00, 0xf0, 0xf1, 0xf1, 0xf2, 0xf2, 0xf4, 0xf4]));
        return out;
    }
}
