// Telnet command codes (RFC-1091 & IANA Telnet Options)
export const IAC = 255; // "Interpret As Command"
export const DO = 253;
export const SEND = 242;
export const WILL = 251;
export const SB = 250;
export const SE = 240;
export const EOR = 0xf1;

// Telnet option codes
export const BINARY = 0;
export const EOR_FLAG = 25;
export const TERMINAL_TYPE = 24;

// 3270 Commands
export const START_FIELD = 0x1d;
export const START_FIELD_EXTENDED = 0x29;
export const SET_BUFFER_ADDRESS = 0x11;
export const BASIC_FIELD_ATTRIBUTES = 0xc0;
export const INSERT_CURSOR = 0x13;
export const REPEAT_TO_ADDRESS = 0x3c;
export const ERASE_UNPROTECTED_TO_ADDRESS = 0x12;
export const WRITE = 0xf1;
export const ERASE_WRITE = 0xf5;

export const HIGHLIGHT_ATTR_TYPE = 0x41;
export const COLOR_ATTR_TYPE = 0x42;

export const EXTENDED_HIGHLIGHTING = {
    DEFAULT: 0x00,
    BLINK: 0xf1,
    REVERSE_VIDEO: 0xf2,
    UNDERSCORE: 0xf4,
} as const;

export type EXTENDED_HIGHLIGHTING =
    (typeof EXTENDED_HIGHLIGHTING)[keyof typeof EXTENDED_HIGHLIGHTING];

export const FIELD_DISPLAY_OPTIONS = {
    NORMAL: 0x00,
    NORMAL_LIGHT_PEN: 0x01,
    INTENSITY: 0x02,
    HIDDEN: 0x03,
};

export type FIELD_DISPLAY_OPTIONS =
    (typeof FIELD_DISPLAY_OPTIONS)[keyof typeof FIELD_DISPLAY_OPTIONS];

export const COLORS = {
    DEFAULT: 0x00,
    BLUE: 0xf1,
    RED: 0xf2,
    PINK: 0xf3,
    GREEN: 0xf4,
    TURQUOISE: 0xf5,
    YELLOW: 0xf6,
    WHITE: 0xf7,
} as const;

export type COLORS = (typeof COLORS)[keyof typeof COLORS];

export const AID = {
    NONE: 0x60,
    ENTER: 0x7d,
    PF1: 0xf1,
    PF2: 0xf2,
    PF3: 0xf3,
    PF4: 0xf4,
    PF5: 0xf5,
    PF6: 0xf6,
    PF7: 0xf7,
    PF8: 0xf8,
    PF9: 0xf9,
    PF10: 0xf10,
    PF11: 0xf11,
    PF12: 0xf12,
    PF13: 0xf13,
    PF14: 0xf14,
    PF15: 0xf15,
    PF16: 0xf16,
    PF17: 0xf17,
    PF18: 0xf18,
    PF19: 0xf19,
    PF20: 0xf20,
    PF21: 0xf21,
    PF22: 0xf22,
    PF23: 0xf23,
    PF24: 0xf24,
    PA1: 0x6c,
    PA2: 0x6e,
    PA3: 0x6b,
    CLEAR: 0x6d,
} as const;

export type AID = (typeof AID)[keyof typeof AID];
