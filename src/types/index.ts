export interface WccControlCharacterOptions {
    reset: boolean;
    alarm: boolean;
    kybRestore: boolean;
    resetMDT: boolean;
}

export interface FieldControlCharacterOptions {
    isProtected: boolean;
    numeric: boolean;
    display: 'NORMAL' | 'INTENSITY';
    mdt: boolean;
}

export interface Position {
    row: number;
    col: number;
}
