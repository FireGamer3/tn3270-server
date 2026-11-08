import { encodeDisplayText } from './codepage.ts';
import { AttributeType, Order } from './constants.ts';
import { encodeAddress } from './encoding.ts';

/**
 * Low-level builder for an outbound 3270 data stream. Positions are 1-based
 * (row 1, col 1 is the top-left corner). The result is a raw record; send it
 * with `Session.sendDataStream`, which adds the telnet framing.
 *
 * ```ts
 * const ds = new DataStream(24, 80)
 *     .command(Command.ERASE_WRITE, wcc({ restoreKeyboard: true }))
 *     .at(1, 1).startField(fieldAttribute({ protected: true }))
 *     .text('Hello');
 * ```
 */
export class DataStream {
    readonly rows: number;
    readonly cols: number;
    private readonly bytes: number[] = [];

    constructor(rows = 24, cols = 80) {
        this.rows = rows;
        this.cols = cols;
    }

    get size(): number {
        return this.rows * this.cols;
    }

    /** Convert a 1-based row/col to a buffer address. */
    address(row: number, col: number): number {
        if (!Number.isInteger(row) || row < 1 || row > this.rows) {
            throw new RangeError(`Row ${row} is outside the ${this.rows}x${this.cols} screen`);
        }
        if (!Number.isInteger(col) || col < 1 || col > this.cols) {
            throw new RangeError(`Column ${col} is outside the ${this.rows}x${this.cols} screen`);
        }
        return (row - 1) * this.cols + (col - 1);
    }

    /** A command byte, followed by the WCC for write-type commands. */
    command(command: number, wcc?: number): this {
        this.bytes.push(command);
        if (wcc !== undefined) this.bytes.push(wcc);
        return this;
    }

    /** Set Buffer Address to a 1-based row/col. */
    at(row: number, col: number): this {
        return this.setBufferAddress(this.address(row, col));
    }

    setBufferAddress(address: number): this {
        this.bytes.push(Order.SET_BUFFER_ADDRESS, ...encodeAddress(address));
        return this;
    }

    /** Start Field with a basic attribute byte (see `fieldAttribute`). */
    startField(attribute: number): this {
        this.bytes.push(Order.START_FIELD, attribute);
        return this;
    }

    /**
     * Start Field Extended. Pairs are [attribute type, value], e.g.
     * `[[AttributeType.FIELD, attr], [AttributeType.COLOR, Color.red]]`.
     */
    startFieldExtended(pairs: ReadonlyArray<readonly [number, number]>): this {
        this.bytes.push(Order.START_FIELD_EXTENDED, pairs.length);
        for (const [type, value] of pairs) this.bytes.push(type, value);
        return this;
    }

    /** Set Attribute: applies to the characters that follow (extended terminals only). */
    setAttribute(type: number, value: number): this {
        this.bytes.push(Order.SET_ATTRIBUTE, type, value);
        return this;
    }

    /** Reset all character attributes set with `setAttribute`. */
    resetAttributes(): this {
        return this.setAttribute(AttributeType.ALL, 0x00);
    }

    insertCursor(): this {
        this.bytes.push(Order.INSERT_CURSOR);
        return this;
    }

    programTab(): this {
        this.bytes.push(Order.PROGRAM_TAB);
        return this;
    }

    /** Fill with `char` from the current address up to (not including) `address`. */
    repeatToAddress(address: number, char: string): this {
        const encoded = encodeDisplayText(char.slice(0, 1) || ' ');
        this.bytes.push(Order.REPEAT_TO_ADDRESS, ...encodeAddress(address), encoded[0]!);
        return this;
    }

    eraseUnprotectedToAddress(address: number): this {
        this.bytes.push(Order.ERASE_UNPROTECTED_TO_ADDRESS, ...encodeAddress(address));
        return this;
    }

    /** Text at the current buffer address, converted to EBCDIC. */
    text(text: string): this {
        this.bytes.push(...encodeDisplayText(text));
        return this;
    }

    raw(bytes: ArrayLike<number>): this {
        for (let i = 0; i < bytes.length; i++) this.bytes.push(bytes[i]!);
        return this;
    }

    toBuffer(): Buffer {
        return Buffer.from(this.bytes);
    }
}
