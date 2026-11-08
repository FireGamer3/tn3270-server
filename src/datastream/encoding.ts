/**
 * The 3270 "6-bit" code table. Buffer addresses, the WCC and field attribute
 * bytes carry six meaningful bits; this table maps them to printable EBCDIC
 * bytes. Note that every entry's low six bits equal its index, so decoding is
 * just a mask.
 */
const SIX_BIT_CODES = [
    0x40, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f,
    0x50, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f,
    0x60, 0x61, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f,
    0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f,
];

/** Largest buffer address expressible (14-bit addressing). */
export const MAX_BUFFER_ADDRESS = 0x3fff;

export function sixBit(value: number): number {
    return SIX_BIT_CODES[value & 0x3f]!;
}

/**
 * Encode a buffer address. Addresses below 4096 use 12-bit (6-bit coded)
 * addressing, which every terminal understands; larger buffers need 14-bit.
 */
export function encodeAddress(address: number): [number, number] {
    if (!Number.isInteger(address) || address < 0 || address > MAX_BUFFER_ADDRESS) {
        throw new RangeError(`Buffer address ${address} is out of range`);
    }
    if (address < 4096) return [sixBit(address >> 6), sixBit(address)];
    return [(address >> 8) & 0x3f, address & 0xff];
}

/** Decode a buffer address sent by the terminal (12-bit or 14-bit form). */
export function decodeAddress(high: number, low: number): number {
    if ((high & 0xc0) === 0) return ((high & 0x3f) << 8) | low;
    return ((high & 0x3f) << 6) | (low & 0x3f);
}

export interface WccOptions {
    /** Sound the terminal's alarm. */
    alarm?: boolean | undefined;
    /** Unlock the keyboard. Without this the user cannot type. */
    restoreKeyboard?: boolean | undefined;
    /** Clear the modified flag on every field before applying the write. */
    resetModified?: boolean | undefined;
}

/** Build a Write Control Character. */
export function wcc(options: WccOptions = {}): number {
    let bits = 0;
    if (options.alarm) bits |= 0x04;
    if (options.restoreKeyboard) bits |= 0x02;
    if (options.resetModified) bits |= 0x01;
    return sixBit(bits);
}

export type Intensity = 'normal' | 'intense' | 'hidden';

export interface FieldAttributeOptions {
    /** Protected fields cannot be typed into. */
    protected?: boolean | undefined;
    /** Numeric-only input. Protected + numeric means "autoskip". */
    numeric?: boolean | undefined;
    intensity?: Intensity | undefined;
    /** Light-pen detectable (only meaningful at normal intensity). */
    detectable?: boolean | undefined;
    /** Modified data tag: when set the field is always returned on Read Modified. */
    modified?: boolean | undefined;
}

/** Build a basic field attribute byte, as used by SF and SFE. */
export function fieldAttribute(options: FieldAttributeOptions = {}): number {
    let bits = 0;
    if (options.protected) bits |= 0x20;
    if (options.numeric) bits |= 0x10;
    switch (options.intensity ?? 'normal') {
        case 'intense':
            bits |= 0x08;
            break;
        case 'hidden':
            bits |= 0x0c;
            break;
        default:
            if (options.detectable) bits |= 0x04;
    }
    if (options.modified) bits |= 0x01;
    return sixBit(bits);
}

export const FieldAttributeBits = {
    PROTECTED: 0x20,
    NUMERIC: 0x10,
    DISPLAY_MASK: 0x0c,
    HIDDEN: 0x0c,
    INTENSE: 0x08,
    MODIFIED: 0x01,
} as const;
