import { AID, FIELD_DISPLAY_OPTIONS } from '../util/constants';

export interface WccControlCharacterOptions {
    reset: boolean;
    alarm: boolean;
    kybRestore: boolean;
    resetMDT: boolean;
}

export interface FieldControlCharacterOptions {
    isProtected: boolean;
    numeric: boolean;
    display: FIELD_DISPLAY_OPTIONS;
    mdt: boolean;
}

export interface Position {
    row: number;
    col: number;
}

export type ParsedData = {
    aid: AID;
    data: {
        pos: Position;
        bufferPos: number;
        data: string;
    }[];
};
