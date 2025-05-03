import { FieldControlCharacterOptions, Position } from '../../types';
import {
    COLOR_ATTR_TYPE,
    COLORS,
    EXTENDED_HIGHLIGHTING,
    FIELD_DISPLAY_OPTIONS,
    HIGHLIGHT_ATTR_TYPE,
    REPEAT_TO_ADDRESS,
    SET_ATTRIBUTE,
    SET_BUFFER_ADDRESS,
    START_FIELD,
} from '../../util/constants';
import {
    a2e,
    convertPosToControlCharacter,
    startFieldControlCharacter,
} from '../../util/conversion';

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

    setColor(color: COLORS) {
        this.color = color;
        return this;
    }

    setHighlight(highlight: EXTENDED_HIGHLIGHTING) {
        this.highlight = highlight;
        return this;
    }

    setPosition(position: Position) {
        this.position = position;
        return this;
    }

    asInputString(length: number) {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        if (this.options.isProtected) this.options.isProtected = false;
        if (this.options.numeric) this.options.numeric = false;
        if (!this.options.mdt) this.options.mdt = true;
        this.applyFieldHeader();
        this.applyAttributeOptions();
        const end = this.position;
        end.col += length + 1;
        while (end.col > 80) {
            end.col -= 80;
            end.row++;
        }
        this.endInputField(end);
        return;
    }

    asInputNumber(length: number) {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        if (this.options.isProtected) this.options.isProtected = false;
        if (!this.options.numeric) this.options.numeric = true;
        if (!this.options.mdt) this.options.mdt = true;
        this.applyFieldHeader();
        this.applyAttributeOptions();
        const end = this.position;
        end.col += length + 1;
        while (end.col > 80) {
            end.col -= 80;
            end.row++;
        }
        this.endInputField(end);
        return;
    }

    asOutputString(string: string) {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        if (!this.options.isProtected) this.options.isProtected = true;
        if (this.options.numeric) this.options.numeric = false;
        this.applyFieldHeader();
        this.applyAttributeOptions();
        this.data.push(...a2e(string));
        return;
    }

    asOutputNumber(string: string) {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        if (!this.options.isProtected) this.options.isProtected = true;
        if (!this.options.numeric) this.options.numeric = true;
        this.applyFieldHeader();
        this.applyAttributeOptions();
        this.data.push(...a2e(string));
        return;
    }

    asRepeatString(string: string, length: number) {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        if (!this.options.isProtected) this.options.isProtected = true;
        if (this.options.numeric) this.options.numeric = false;
        this.applyFieldHeader();
        this.applyAttributeOptions();
        const end = this.position;
        end.col += length + 1;
        while (end.col > 80) {
            end.col -= 80;
            end.row++;
        }
        this.data.push(
            REPEAT_TO_ADDRESS,
            ...convertPosToControlCharacter(end.row, end.col),
            ...a2e(string),
        );
    }

    private applyFieldHeader() {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        this.data.push(
            SET_BUFFER_ADDRESS,
            ...convertPosToControlCharacter(this.position.row, this.position.col),
            START_FIELD,
            startFieldControlCharacter(
                this.options.isProtected,
                this.options.numeric,
                this.options.display,
                this.options.mdt,
            ),
        );
    }

    private applyAttributeOptions() {
        if (this.color) {
            this.data.push(SET_ATTRIBUTE, COLOR_ATTR_TYPE, this.color);
        }

        if (this.highlight) {
            this.data.push(SET_ATTRIBUTE, HIGHLIGHT_ATTR_TYPE, this.highlight);
        }
    }

    private endInputField(end: Position) {
        this.data.push(
            SET_BUFFER_ADDRESS,
            ...convertPosToControlCharacter(end.row, end.col),
            START_FIELD,
            startFieldControlCharacter(true, false, FIELD_DISPLAY_OPTIONS.NORMAL, false),
        );
    }
}
