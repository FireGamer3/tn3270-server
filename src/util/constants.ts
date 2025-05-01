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
export const SET_BUFFER_ADDRESS = 0x11;
export const INSERT_CURSOR = 0x13;
export const PROGRAM_TAB = 0x05;
export const REPEAT_TO_ADDRESS = 0x3c;
export const ERASE_UNPROTECTED_TO_ADDRESS = 0x12;
