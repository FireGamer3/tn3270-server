import { Position } from '../../types';
import { EOR, IAC } from '../../util/constants';
import { convertControlCharacterToPos } from '../../util/conversion';

export function readParser(data: number[]) {
    let skip = 2;
    let inField = false;
    let fieldData: { pos: Position; posCC: number; data: number[] } = {
        pos: { row: 1, col: 1 },
        posCC: 0,
        data: [],
    };
    let fields: (typeof fieldData)[] = [];
    for (let i = 0; i < data.length; i++) {
        if (skip > 0) {
            skip--;
            continue;
        } else if (data[i] === 0x11) {
            if (inField) {
                fields.push(fieldData);
                fieldData = {
                    pos: { row: 1, col: 1 },
                    posCC: 0,
                    data: [],
                };
            }
            let posCC = convertControlCharacterToPos(data[i + 1]!, data[i + 2]!);
            fieldData.pos.row = Math.floor(posCC % 80);
            fieldData.pos.col = Math.floor((posCC - fieldData.pos.row) / 80);
            fieldData.posCC = posCC;
            skip = 2;
            inField = true;
        } else if (data[i] === IAC && data[i + 1] === 0xef) {
            if (inField) {
                fields.push(fieldData);
                fieldData = {
                    pos: { row: 1, col: 1 },
                    posCC: 0,
                    data: [],
                };
                skip = 2;
                inField = false;
            }
        } else if (inField) {
            fieldData.data.push(data[i]!);
        }
    }
    return fields;
}
