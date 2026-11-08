import { Aid, Order, QueryCode, StructuredField as SF } from './constants.ts';
import { decodeAddress } from './encoding.ts';

export interface InboundField {
    /** Buffer address of the first data character (the byte after the attribute). */
    address: number;
    data: Uint8Array;
}

export interface StructuredField {
    id: number;
    data: Uint8Array;
}

export interface InboundRecord {
    aid: number;
    /** Cursor buffer address, absent on short reads (CLEAR, PA keys). */
    cursor?: number | undefined;
    fields: InboundField[];
    /** Present when `aid` is STRUCTURED_FIELD (e.g. a query reply). */
    structuredFields?: StructuredField[] | undefined;
}

/** Parse a record sent by the terminal in response to an AID key or a read command. */
export function parseInbound(record: Uint8Array): InboundRecord {
    const aid = record[0] ?? Aid.NONE;

    if (aid === Aid.STRUCTURED_FIELD) {
        return { aid, fields: [], structuredFields: parseStructuredFields(record.subarray(1)) };
    }
    if (record.length < 3) return { aid, fields: [] };

    const cursor = decodeAddress(record[1]!, record[2]!);
    const fields: InboundField[] = [];
    let current: { address: number; data: number[] } | undefined;
    const flush = () => {
        if (current) fields.push({ address: current.address, data: Uint8Array.from(current.data) });
    };

    for (let i = 3; i < record.length; i++) {
        const byte = record[i]!;
        if (byte === Order.SET_BUFFER_ADDRESS && i + 2 < record.length) {
            flush();
            current = { address: decodeAddress(record[i + 1]!, record[i + 2]!), data: [] };
            i += 2;
        } else if (byte === Order.GRAPHIC_ESCAPE) {
            // Next byte is from the alternate character set; keep it as-is.
        } else {
            // Data before any SBA comes from an unformatted screen and starts at address 0.
            current ??= { address: 0, data: [] };
            current.data.push(byte);
        }
    }
    flush();

    return { aid, cursor, fields };
}

/** Split a structured field stream. Each field: 2-byte length (inclusive), 1-byte ID, data. */
export function parseStructuredFields(bytes: Uint8Array): StructuredField[] {
    const fields: StructuredField[] = [];
    let i = 0;
    while (i + 3 <= bytes.length) {
        let length = (bytes[i]! << 8) | bytes[i + 1]!;
        if (length === 0) length = bytes.length - i; // zero means "to the end"
        if (length < 3 || i + length > bytes.length) break;
        fields.push({ id: bytes[i + 2]!, data: bytes.subarray(i + 3, i + length) });
        i += length;
    }
    return fields;
}

export interface QueryReplySummary {
    /** Default (Erase/Write) screen size, from the Implicit Partition reply. */
    defaultSize?: { rows: number; cols: number } | undefined;
    /** Alternate (Erase/Write Alternate) screen size. */
    alternateSize?: { rows: number; cols: number } | undefined;
    color: boolean;
    highlighting: boolean;
    /** Every query reply code received. */
    codes: number[];
}

/** Interpret the replies to a Read Partition Query. */
export function summarizeQueryReplies(fields: StructuredField[]): QueryReplySummary {
    const summary: QueryReplySummary = { color: false, highlighting: false, codes: [] };
    let usableArea: { rows: number; cols: number } | undefined;

    for (const field of fields) {
        if (field.id !== SF.QUERY_REPLY || field.data.length < 1) continue;
        const code = field.data[0]!;
        const body = field.data.subarray(1);
        summary.codes.push(code);

        switch (code) {
            case QueryCode.USABLE_AREA:
                // flags(2) width(2) height(2) ...
                if (body.length >= 6) {
                    usableArea = { cols: u16(body, 2), rows: u16(body, 4) };
                }
                break;
            case QueryCode.IMPLICIT_PARTITION: {
                // reserved(2), then self-defining parameters: len, id, ...
                let j = 2;
                while (j + 1 < body.length) {
                    const len = body[j]!;
                    if (len < 2) break;
                    if (body[j + 1] === 0x01 && len >= 11 && j + 11 <= body.length) {
                        summary.defaultSize = { cols: u16(body, j + 3), rows: u16(body, j + 5) };
                        summary.alternateSize = { cols: u16(body, j + 7), rows: u16(body, j + 9) };
                    }
                    j += len;
                }
                break;
            }
            case QueryCode.COLOR:
                summary.color = true;
                break;
            case QueryCode.HIGHLIGHT:
                summary.highlighting = true;
                break;
        }
    }

    summary.alternateSize ??= usableArea;
    return summary;
}

function u16(bytes: Uint8Array, offset: number) {
    return (bytes[offset]! << 8) | bytes[offset + 1]!;
}
