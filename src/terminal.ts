import { MAX_BUFFER_ADDRESS } from './datastream/encoding.ts';
import type { QueryReplySummary } from './datastream/inbound.ts';

export interface ScreenSize {
    rows: number;
    cols: number;
}

/** What we know about the connected terminal. */
export interface TerminalInfo {
    /** The terminal type the client reported, e.g. "IBM-3279-4-E". */
    terminalType: string;
    /** 3278/3279 model number, when the terminal type includes one. */
    model?: number | undefined;
    /** Screen size used by Erase/Write. Always 24x80 on real models. */
    defaultSize: ScreenSize;
    /** Largest screen size, used by Erase/Write Alternate. */
    alternateSize: ScreenSize;
    /** Supports the extended data stream (SFE, SA, structured fields). */
    extended: boolean;
    /** Supports extended colors. */
    color: boolean;
    /** Supports extended highlighting (blink, reverse, underscore). */
    highlighting: boolean;
    /** True when the values above were confirmed by a Read Partition Query. */
    queried: boolean;
}

const DEFAULT_SIZE: ScreenSize = { rows: 24, cols: 80 };

const MODEL_SIZES: Record<number, ScreenSize> = {
    2: { rows: 24, cols: 80 },
    3: { rows: 32, cols: 80 },
    4: { rows: 43, cols: 80 },
    5: { rows: 27, cols: 132 },
};

/** Derive terminal capabilities from the TERMINAL-TYPE string. */
export function parseTerminalType(terminalType: string): TerminalInfo {
    const name = terminalType.trim().toUpperCase();
    const match = /^IBM-(\d{4})-(\d)(-E)?$/.exec(name);
    const model = match ? Number(match[2]) : undefined;
    const extended = name.endsWith('-E') || name === 'IBM-DYNAMIC';
    const color = match?.[1] === '3279' || name === 'IBM-DYNAMIC';

    return {
        terminalType: name,
        model,
        defaultSize: DEFAULT_SIZE,
        alternateSize: (model !== undefined ? MODEL_SIZES[model] : undefined) ?? DEFAULT_SIZE,
        extended,
        color,
        highlighting: extended,
        queried: false,
    };
}

/** Refine terminal info with the answer to a Read Partition Query. */
export function applyQueryReply(info: TerminalInfo, reply: QueryReplySummary): TerminalInfo {
    return {
        ...info,
        defaultSize: isUsable(reply.defaultSize) ? reply.defaultSize : info.defaultSize,
        alternateSize: isUsable(reply.alternateSize) ? reply.alternateSize : info.alternateSize,
        color: reply.color,
        highlighting: reply.highlighting,
        queried: true,
    };
}

function isUsable(size: ScreenSize | undefined): size is ScreenSize {
    return (
        size !== undefined &&
        size.rows >= 1 &&
        size.cols >= 1 &&
        size.rows * size.cols - 1 <= MAX_BUFFER_ADDRESS
    );
}
