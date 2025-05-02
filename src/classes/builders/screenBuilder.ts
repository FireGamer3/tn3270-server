import { WccControlCharacterOptions } from '../../types';
import { wccToControlCharacter } from '../../util/conversion';
import Field from './field';

export default class ScreenBuilder {
    wccOptions: WccControlCharacterOptions;
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
        return final;
    }
}
