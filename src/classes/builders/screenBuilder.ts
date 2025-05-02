import { Position, WccControlCharacterOptions } from '../../types';
import { INSERT_CURSOR, SET_BUFFER_ADDRESS } from '../../util/constants';
import { convertPosToControlCharacter, wccToControlCharacter } from '../../util/conversion';
import Field from './field';

export default class ScreenBuilder {
    wccOptions: WccControlCharacterOptions;
    startPosition: Position = { row: 1, col: 1 };
    _fields: Field[] = [];

    constructor(wccOptions: WccControlCharacterOptions) {
        this.wccOptions = wccOptions;
    }

    setWccOptions(wccOptions: WccControlCharacterOptions) {
        this.wccOptions = wccOptions;
        return this;
    }

    addField(cb: (builder: Field) => void) {
        const field = new Field();
        cb(field);
        this._fields.push(field);
        return this;
    }

    setStartPosition(position: Position) {
        this.startPosition = position;
        return this;
    }

    build() {
        const final: number[] = [];
        final.push(
            wccToControlCharacter(
                this.wccOptions.reset,
                this.wccOptions.alarm,
                this.wccOptions.kybRestore,
                this.wccOptions.resetMDT,
            ),
        );
        this._fields.forEach((f) => {
            final.push(...f.data);
        });
        final.push(
            SET_BUFFER_ADDRESS,
            ...convertPosToControlCharacter(this.startPosition.row, this.startPosition.col),
            INSERT_CURSOR,
        );
        return final;
    }
}
