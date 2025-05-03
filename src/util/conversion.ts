import { FIELD_DISPLAY_OPTIONS } from './constants';

const ebcdic = [
    0, 1, 2, 3, 55, 45, 46, 47, 22, 5, 37, 11, 12, 13, 14, 15, 16, 17, 18, 19, 60, 61, 50, 38, 24,
    25, 63, 39, 28, 29, 30, 31, 64, 90, 127, 123, 91, 108, 80, 125, 77, 93, 92, 78, 107, 96, 75, 97,
    240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 122, 94, 76, 126, 110, 111, 124, 193, 194,
    195, 196, 197, 198, 199, 200, 201, 209, 210, 211, 212, 213, 214, 215, 216, 217, 226, 227, 228,
    229, 230, 231, 232, 233, 74, 224, 90, 95, 109, 121, 129, 130, 131, 132, 133, 134, 135, 136, 137,
    145, 146, 147, 148, 149, 150, 151, 152, 153, 162, 163, 164, 165, 166, 167, 168, 169, 192, 106,
    208, 161, 7, 32, 33, 34, 35, 36, 21, 6, 23, 40, 41, 42, 43, 44, 9, 10, 27, 48, 49, 26, 51, 52,
    53, 54, 8, 56, 57, 58, 59, 4, 20, 62, 225, 65, 66, 67, 68, 69, 70, 71, 72, 73, 81, 82, 83, 84,
    85, 86, 87, 88, 89, 98, 99, 100, 101, 102, 103, 104, 105, 112, 113, 114, 115, 116, 117, 118,
    119, 120, 128, 138, 139, 140, 141, 142, 143, 144, 154, 155, 156, 157, 158, 159, 160, 170, 171,
    172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190,
    191, 202, 203, 204, 205, 206, 207, 218, 219, 220, 221, 222, 223, 234, 235, 236, 237, 238, 239,
    250, 251, 252, 253, 254, 255,
];

const ascii = [
    0, 1, 2, 3, 156, 9, 134, 127, 151, 141, 142, 11, 12, 13, 14, 15, 16, 17, 18, 19, 157, 133, 8,
    135, 24, 25, 146, 143, 28, 29, 30, 31, 128, 129, 130, 131, 132, 10, 23, 27, 136, 137, 138, 139,
    140, 5, 6, 7, 144, 145, 22, 147, 148, 149, 150, 4, 152, 153, 154, 155, 20, 21, 158, 26, 32, 160,
    161, 162, 163, 164, 165, 166, 167, 168, 91, 46, 60, 40, 43, 33, 38, 169, 170, 171, 172, 173,
    174, 175, 176, 177, 33, 36, 42, 41, 59, 94, 45, 47, 178, 179, 180, 181, 182, 183, 184, 185, 124,
    44, 37, 95, 62, 63, 186, 187, 188, 189, 190, 191, 192, 193, 194, 96, 58, 35, 64, 39, 61, 34,
    195, 97, 98, 99, 100, 101, 102, 103, 104, 105, 196, 197, 198, 199, 200, 201, 202, 106, 107, 108,
    109, 110, 111, 112, 113, 114, 203, 204, 205, 206, 207, 208, 209, 126, 115, 116, 117, 118, 119,
    120, 121, 122, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225,
    226, 227, 228, 229, 230, 231, 123, 65, 66, 67, 68, 69, 70, 71, 72, 73, 232, 233, 234, 235, 236,
    237, 125, 74, 75, 76, 77, 78, 79, 80, 81, 82, 238, 239, 240, 241, 242, 243, 92, 159, 83, 84, 85,
    86, 87, 88, 89, 90, 244, 245, 246, 247, 248, 249, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 250,
    251, 252, 253, 254, 255,
];

export const ControlCharacterIO = [
    0x40, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f,
    0x50, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f,
    0x60, 0x61, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f,
    0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f,
];

export function convertPosToControlCharacter(row: number, col: number) {
    const position = (row - 1) * 80 + (col - 1);
    const lowerSixBits = position & 0x3f;
    const upperSixBits = (position >> 6) & 0x3f;
    return [ControlCharacterIO[upperSixBits]!, ControlCharacterIO[lowerSixBits]!];
}

export function convertControlCharacterToPos(high: number, low: number) {
    let highIndex = ControlCharacterIO.indexOf(high);
    let lowIndex = ControlCharacterIO.indexOf(low);
    return (highIndex << 6) + lowIndex;
}

export function wccToControlCharacter(
    reset: boolean,
    alarm: boolean,
    kybRestore: boolean,
    resetMDT: boolean,
) {
    let flags = 0;
    if (reset) flags = flags | (1 << 6);
    if (alarm) flags = flags | (1 << 2);
    if (kybRestore) flags = flags | (1 << 1);
    if (resetMDT) flags = flags | (1 << 0);
    return ControlCharacterIO[flags]!;
}

export function startFieldControlCharacter(
    isProtected: boolean,
    numeric: boolean,
    display: FIELD_DISPLAY_OPTIONS,
    mdt: boolean,
) {
    let flags = 0;
    if (isProtected) flags = flags | (1 << 5);
    if (numeric) flags = flags | (1 << 4);
    switch (display) {
        case FIELD_DISPLAY_OPTIONS.NORMAL_LIGHT_PEN: {
            flags = flags | (1 << 2);
            break;
        }
        case FIELD_DISPLAY_OPTIONS.INTENSITY: {
            flags = flags | (1 << 3);
            break;
        }
        case FIELD_DISPLAY_OPTIONS.HIDDEN: {
            flags = flags | (1 << 3);
            flags = flags | (1 << 2);
            break;
        }
    }
    if (display === FIELD_DISPLAY_OPTIONS.INTENSITY) flags = flags | (1 << 3);
    if (mdt) flags = flags | (1 << 0);
    return ControlCharacterIO[flags]!;
}

export function a2e(input: Buffer | string): Buffer {
    const src = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
    const dst = Buffer.alloc(src.length);
    for (let i = 0; i < src.length; i++) {
        dst[i] = ebcdic[src[i] as keyof typeof ebcdic] as number;
    }
    return dst;
}

export function e2a(input: Buffer): string {
    let result = '';
    for (const b of input) {
        result += String.fromCharCode(ascii[b as keyof typeof ascii] as number);
    }
    return result;
}
