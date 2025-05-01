// Telnet command codes (RFC-1091 & IANA Telnet Options)
export const IAC = 255; // "Interpret As Command"
export const DO = 253;
export const SEND = 242;
export const WILL = 251;
export const SB = 250;
export const SE = 240;

// Telnet option codes
export const BINARY = 0;
export const EOR = 25;
export const TERMINAL_TYPE = 24;
export const TN3270E = 40;

// 3270 Commands
export const START_FIELD = 0x1d;
export const START_FIELD_EXTENDED = 0x29;
export const SET_BUFFER_ADDRESS = 0x11;
export const INSERT_CURSOR = 0x13;
export const PROGRAM_TAB = 0x05;
export const REPEAT_TO_ADDRESS = 0x3c;
export const ERASE_UNPROTECTED_TO_ADDRESS = 0x12;

export const EXTENDED_HIGHLIGHTING = {
    DEFAULT: 0x00,
    BLINK: 0xf1,
    REVERSE_VIDEO: 0xf2,
    UNDERSCORE: 0xf3,
} as const;

export type ExtendedHighlighting =
    (typeof EXTENDED_HIGHLIGHTING)[keyof typeof EXTENDED_HIGHLIGHTING];

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

export type Colors = (typeof COLORS)[keyof typeof COLORS];
