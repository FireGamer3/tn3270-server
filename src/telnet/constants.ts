/** Telnet command bytes (RFC 854, RFC 885). */
export const IAC = 0xff;
export const DONT = 0xfe;
export const DO = 0xfd;
export const WONT = 0xfc;
export const WILL = 0xfb;
export const SB = 0xfa;
export const NOP = 0xf1;
export const SE = 0xf0;
export const EOR = 0xef;

/** Telnet option codes. */
export const TelnetOption = {
    BINARY: 0, // RFC 856
    TERMINAL_TYPE: 24, // RFC 1091
    END_OF_RECORD: 25, // RFC 885
    TN3270E: 40, // RFC 2355
} as const;

/** TERMINAL-TYPE sub-negotiation verbs (RFC 1091). */
export const TERMINAL_TYPE_IS = 0;
export const TERMINAL_TYPE_SEND = 1;
