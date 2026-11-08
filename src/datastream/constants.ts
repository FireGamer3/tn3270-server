/** 3270 commands, in the EBCDIC form used over TN3270 (non-SNA). */
export const Command = {
    WRITE: 0xf1,
    ERASE_WRITE: 0xf5,
    ERASE_WRITE_ALTERNATE: 0x7e,
    READ_BUFFER: 0xf2,
    READ_MODIFIED: 0xf6,
    READ_MODIFIED_ALL: 0x6e,
    ERASE_ALL_UNPROTECTED: 0x6f,
    WRITE_STRUCTURED_FIELD: 0xf3,
} as const;

/** Orders that may appear inside a write data stream. */
export const Order = {
    START_FIELD: 0x1d,
    START_FIELD_EXTENDED: 0x29,
    SET_BUFFER_ADDRESS: 0x11,
    SET_ATTRIBUTE: 0x28,
    MODIFY_FIELD: 0x2c,
    INSERT_CURSOR: 0x13,
    PROGRAM_TAB: 0x05,
    REPEAT_TO_ADDRESS: 0x3c,
    ERASE_UNPROTECTED_TO_ADDRESS: 0x12,
    GRAPHIC_ESCAPE: 0x08,
} as const;

/** Attention identifiers: the first byte of every inbound record. */
export const Aid = {
    NONE: 0x60,
    STRUCTURED_FIELD: 0x88,
    ENTER: 0x7d,
    CLEAR: 0x6d,
    SYSREQ: 0xf0,
    PEN: 0x7e,
    PA1: 0x6c,
    PA2: 0x6e,
    PA3: 0x6b,
    PF1: 0xf1,
    PF2: 0xf2,
    PF3: 0xf3,
    PF4: 0xf4,
    PF5: 0xf5,
    PF6: 0xf6,
    PF7: 0xf7,
    PF8: 0xf8,
    PF9: 0xf9,
    PF10: 0x7a,
    PF11: 0x7b,
    PF12: 0x7c,
    PF13: 0xc1,
    PF14: 0xc2,
    PF15: 0xc3,
    PF16: 0xc4,
    PF17: 0xc5,
    PF18: 0xc6,
    PF19: 0xc7,
    PF20: 0xc8,
    PF21: 0xc9,
    PF22: 0x4a,
    PF23: 0x4b,
    PF24: 0x4c,
} as const;

export type AidName = keyof typeof Aid;

const AID_NAMES = new Map<number, AidName>(
    Object.entries(Aid).map(([name, code]) => [code, name as AidName]),
);

export function aidName(code: number): AidName | 'UNKNOWN' {
    return AID_NAMES.get(code) ?? 'UNKNOWN';
}

/** AIDs that only send the AID byte back (a "short read"); no field data. */
export const SHORT_READ_AIDS: ReadonlySet<number> = new Set([Aid.CLEAR, Aid.PA1, Aid.PA2, Aid.PA3]);

/** Attribute types used with SFE / SA / MF. */
export const AttributeType = {
    ALL: 0x00,
    FIELD: 0xc0,
    HIGHLIGHT: 0x41,
    COLOR: 0x42,
} as const;

export const Color = {
    default: 0x00,
    blue: 0xf1,
    red: 0xf2,
    pink: 0xf3,
    green: 0xf4,
    turquoise: 0xf5,
    yellow: 0xf6,
    white: 0xf7,
} as const;

export type ColorName = keyof typeof Color;

export const Highlight = {
    default: 0x00,
    blink: 0xf1,
    reverse: 0xf2,
    underscore: 0xf4,
    intensify: 0xf8,
} as const;

export type HighlightName = keyof typeof Highlight;

/** Structured field IDs used for terminal queries. */
export const StructuredField = {
    READ_PARTITION: 0x01,
    QUERY_REPLY: 0x81,
} as const;

export const QueryCode = {
    USABLE_AREA: 0x81,
    COLOR: 0x86,
    HIGHLIGHT: 0x87,
    IMPLICIT_PARTITION: 0xa6,
} as const;
