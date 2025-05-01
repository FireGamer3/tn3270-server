import { WccControlCharacterOptions } from '../types';
import { convertPosToControlCharacter } from '../util/conversion';
import Field from './field';

export default class Screen {
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
}
