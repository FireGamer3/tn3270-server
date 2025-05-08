import { FieldControlCharacterOptions, Position } from '../../types';
import {
    BASIC_FIELD_ATTRIBUTES,
    COLOR_ATTR_TYPE,
    COLORS,
    EXTENDED_HIGHLIGHTING,
    FIELD_DISPLAY_OPTIONS,
    HIGHLIGHT_ATTR_TYPE,
    REPEAT_TO_ADDRESS,
    SET_BUFFER_ADDRESS,
    START_FIELD,
    START_FIELD_EXTENDED,
} from '../../util/constants';
import {
    a2e,
    convertPosToControlCharacter,
    startFieldControlCharacter,
} from '../../util/conversion';

export default class Field {
    private options: FieldControlCharacterOptions | undefined;
    private position: Position = { row: 1, col: 1 };
    data: number[] = [];
    private color: COLORS = COLORS.DEFAULT;
    private highlight: EXTENDED_HIGHLIGHTING = EXTENDED_HIGHLIGHTING.DEFAULT;
    private centerMode: boolean = false;
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

    setCenterMode(centerMode: boolean) {
        this.centerMode = centerMode;
        return this;
    }

    asInputString(length: number) {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        if (this.options.isProtected) this.options.isProtected = false;
        if (this.options.numeric) this.options.numeric = false;
        if (!this.options.mdt) this.options.mdt = true;
        this.applyFieldHeader();
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
        this.applyFieldHeader(string);
        this.data.push(...a2e(string));
        return;
    }

    asOutputNumber(string: string) {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        if (!this.options.isProtected) this.options.isProtected = true;
        if (!this.options.numeric) this.options.numeric = true;
        this.applyFieldHeader(string);
        this.data.push(...a2e(string));
        return;
    }

    asRepeatString(string: string, length: number) {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        if (!this.options.isProtected) this.options.isProtected = true;
        if (this.options.numeric) this.options.numeric = false;
        this.applyFieldHeader();
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

    private applyFieldHeader(data: string | null = null) {
        if (!this.options)
            throw new Error('Field options must be set before asInputString can be called');
        const isDefault =
            this.color === COLORS.DEFAULT && this.highlight === EXTENDED_HIGHLIGHTING.DEFAULT;

        if (this.centerMode && data) {
            this.position = {
                row: this.position.row,
                col: 40 - Math.floor(data.length / 2),
            };
        }
        this.data.push(
            SET_BUFFER_ADDRESS,
            ...convertPosToControlCharacter(this.position.row, this.position.col),
        );
        if (isDefault) {
            this.data.push(
                START_FIELD,
                startFieldControlCharacter(
                    this.options.isProtected,
                    this.options.numeric,
                    this.options.display,
                    this.options.mdt,
                ),
            );
        } else {
            this.data.push(START_FIELD_EXTENDED);
            let paramCount = 1;
            if (this.color !== COLORS.DEFAULT) paramCount++;
            if (this.highlight !== EXTENDED_HIGHLIGHTING.DEFAULT) paramCount++;
            this.data.push(paramCount);
            this.data.push(
                BASIC_FIELD_ATTRIBUTES,
                startFieldControlCharacter(
                    this.options.isProtected,
                    this.options.numeric,
                    this.options.display,
                    this.options.mdt,
                ),
            );
            if (this.color !== COLORS.DEFAULT) {
                this.data.push(COLOR_ATTR_TYPE, this.color);
            }
            if (this.highlight !== EXTENDED_HIGHLIGHTING.DEFAULT) {
                this.data.push(HIGHLIGHT_ATTR_TYPE, this.highlight);
            }
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
