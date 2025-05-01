import { FieldControlCharacterOptions, Position } from '../types';
import { Colors, ExtendedHighlighting } from '../util/constants';

export default class Field {
    options: FieldControlCharacterOptions | undefined;
    position: Position = { row: 1, col: 1 };
    data: number[] = [];
    color: number | undefined;
    highlight: number | undefined;
    constructor() {}

    setOptions(options: FieldControlCharacterOptions) {
        this.options = options;
        return this;
    }

    setColor(color: Colors) {
        this.color = color;
        return this;
    }

    setHighlight(highlight: ExtendedHighlighting) {
        this.highlight = highlight;
        return this;
    }

    setPosition(position: Position) {
        this.position = position;
        return this;
    }

    asInputString(length: number) {}

    asOutputString(string: string) {}
}
