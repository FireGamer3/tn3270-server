import { DataStream } from './datastream/builder.ts';
import { decodeEbcdic } from './datastream/codepage.ts';
import {
    aidName,
    AttributeType,
    Color,
    Command,
    Highlight,
    type AidName,
    type ColorName,
    type HighlightName,
} from './datastream/constants.ts';
import { fieldAttribute, wcc } from './datastream/encoding.ts';
import type { InboundRecord } from './datastream/inbound.ts';
import type { ScreenSize, TerminalInfo } from './terminal.ts';

export interface Position {
    row: number;
    col: number;
}

/**
 * One field on a screen.
 *
 * As on a real 3270, the field attribute occupies the cell at `row`/`col`
 * (it shows as a blank) and the content starts in the next column.
 */
export interface Field {
    /** 1-based row of the attribute byte. */
    row: number;
    /** 1-based column of the attribute byte. */
    col: number;
    /** Text shown in the field. For input fields this is the initial value. */
    text?: string | undefined;
    /** Key used for this field in `values` (input fields). */
    name?: string | undefined;
    /** Let the user type into this field. */
    input?: boolean | undefined;
    /**
     * Content length. For input fields an autoskip attribute is placed right
     * after the content so the field is exactly this long. Without it the
     * field runs until the next field on the screen.
     */
    length?: number | undefined;
    /** Numeric-only input. */
    numeric?: boolean | undefined;
    /** High intensity. */
    intense?: boolean | undefined;
    /** Not displayed (passwords). */
    hidden?: boolean | undefined;
    /** Extended color; ignored on terminals without color support. */
    color?: ColorName | undefined;
    /** Extended highlighting; ignored on terminals without support. */
    highlight?: HighlightName | undefined;
}

export interface Screen {
    fields: Field[];
    /**
     * Where to put the cursor: an input field's name or a position. Defaults to
     * the first input field.
     */
    cursor?: string | Position | undefined;
}

export interface WriteOptions {
    /** Values for named input fields, overriding their `text`. */
    values?: Record<string, string> | undefined;
    /** Overrides `screen.cursor`. */
    cursor?: string | Position | undefined;
    /** Sound the terminal alarm. */
    alarm?: boolean | undefined;
    /**
     * Clear the screen first (Erase/Write). With `false` the fields are drawn
     * over what is already displayed (Write). Default `true`.
     */
    erase?: boolean | undefined;
}

export interface ScreenResponse {
    /** The key the user pressed. */
    aid: AidName | 'UNKNOWN';
    /** Raw AID byte. */
    aidCode: number;
    /** Cursor position when the key was pressed (absent for CLEAR and PA keys). */
    cursor?: Position | undefined;
    /** Every named input field of the screen with its current content. */
    values: Record<string, string>;
}

interface InputSlot {
    name?: string | undefined;
    /** Address of the first content character. */
    address: number;
    initial: string;
}

/** A screen turned into bytes, plus what is needed to read the reply. */
export interface RenderedScreen {
    bytes: Buffer;
    size: ScreenSize;
    inputs: InputSlot[];
}

export interface RenderTarget {
    terminal: TerminalInfo;
    /** Size of the screen currently shown; used when `erase` is false. */
    currentSize: ScreenSize;
}

export function renderScreen(
    screen: Screen,
    target: RenderTarget,
    options: WriteOptions = {},
): RenderedScreen {
    const { terminal } = target;
    const erase = options.erase ?? true;
    const values = options.values ?? {};

    const useAlternate = !sameSize(terminal.alternateSize, terminal.defaultSize);
    const size = erase
        ? useAlternate
            ? terminal.alternateSize
            : terminal.defaultSize
        : target.currentSize;
    const command = !erase
        ? Command.WRITE
        : useAlternate
          ? Command.ERASE_WRITE_ALTERNATE
          : Command.ERASE_WRITE;

    const ds = new DataStream(size.rows, size.cols);
    ds.command(command, wcc({ restoreKeyboard: true, resetModified: true, alarm: options.alarm }));

    const names = new Set<string>();
    for (const field of screen.fields) {
        if (field.name === undefined) continue;
        if (names.has(field.name)) throw new Error(`Duplicate field name "${field.name}"`);
        names.add(field.name);
    }

    const attributeAddresses = new Set(screen.fields.map((f) => ds.address(f.row, f.col)));
    const inputs: InputSlot[] = [];

    for (const field of screen.fields) {
        const address = ds.address(field.row, field.col);
        const isInput = field.input === true;

        const attribute = fieldAttribute({
            protected: !isInput,
            numeric: field.numeric,
            intensity: field.hidden ? 'hidden' : field.intense ? 'intense' : 'normal',
            // MDT on input fields makes the terminal always send them back, so
            // `values` is complete even for fields the user did not touch.
            modified: isInput,
        });

        const extended: Array<[number, number]> = [];
        if (terminal.extended && terminal.color && field.color && field.color !== 'default') {
            extended.push([AttributeType.COLOR, Color[field.color]]);
        }
        if (
            terminal.extended &&
            terminal.highlighting &&
            field.highlight &&
            field.highlight !== 'default'
        ) {
            extended.push([AttributeType.HIGHLIGHT, Highlight[field.highlight]]);
        }

        ds.setBufferAddress(address);
        if (extended.length > 0) {
            ds.startFieldExtended([[AttributeType.FIELD, attribute], ...extended]);
        } else {
            ds.startField(attribute);
        }

        let content =
            isInput && field.name !== undefined && values[field.name] !== undefined
                ? values[field.name]!
                : (field.text ?? '');
        if (field.length !== undefined) content = content.slice(0, field.length);
        ds.text(content);

        const contentAddress = (address + 1) % ds.size;
        if (isInput) {
            inputs.push({ name: field.name, address: contentAddress, initial: content });

            if (field.length !== undefined) {
                const end = (address + 1 + field.length) % ds.size;
                if (!attributeAddresses.has(end)) {
                    ds.setBufferAddress(end).startField(
                        fieldAttribute({ protected: true, numeric: true }),
                    );
                }
            }
        }
    }

    const cursor = resolveCursor(options.cursor ?? screen.cursor, inputs, ds);
    if (cursor !== undefined) ds.setBufferAddress(cursor).insertCursor();

    return { bytes: ds.toBuffer(), size, inputs };
}

function resolveCursor(
    cursor: string | Position | undefined,
    inputs: InputSlot[],
    ds: DataStream,
): number | undefined {
    if (typeof cursor === 'string') {
        const slot = inputs.find((i) => i.name === cursor);
        if (!slot) throw new Error(`Cursor field "${cursor}" is not an input field`);
        return slot.address;
    }
    if (cursor) return ds.address(cursor.row, cursor.col);
    return inputs[0]?.address;
}

/** Turn a parsed inbound record into values keyed by field name. */
export function mapResponse(
    record: InboundRecord,
    rendered: RenderedScreen | undefined,
    size: ScreenSize,
): ScreenResponse {
    const values: Record<string, string> = {};
    const byAddress = new Map<number, InputSlot>();

    for (const slot of rendered?.inputs ?? []) {
        byAddress.set(slot.address, slot);
        if (slot.name !== undefined) values[slot.name] = slot.initial;
    }
    for (const field of record.fields) {
        const slot = byAddress.get(field.address);
        if (slot?.name === undefined) continue;
        values[slot.name] = decodeEbcdic(field.data.filter((b) => b !== 0x00));
    }

    return {
        aid: aidName(record.aid),
        aidCode: record.aid,
        cursor:
            record.cursor === undefined
                ? undefined
                : {
                      row: Math.floor(record.cursor / size.cols) + 1,
                      col: (record.cursor % size.cols) + 1,
                  },
        values,
    };
}

function sameSize(a: ScreenSize, b: ScreenSize) {
    return a.rows === b.rows && a.cols === b.cols;
}
