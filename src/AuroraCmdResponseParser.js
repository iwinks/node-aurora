import camelCase from 'lodash/camelCase';
import zipObject from 'lodash/zipObject';
import {parseValueString} from './util';

const ResponseStates = {

    INIT: 0,
    OBJECT: 1,
    TABLE: 2,
    OUTPUT: 3
};

export default class AuroraCmdResponseParser {

    constructor() {

        this.reset();
    }

    reset() {

        this.response = null;
        this.responseState = ResponseStates.INIT;
        this.responseTableCols = [];
    }

    parseObject(line)
    {
        if (line.length > 120) throw new Error('Line exceeded max length of 120 bytes.');

        line = line.trim();

        if (!line.length) return;

        if (this.responseState == ResponseStates.INIT) {

            this.response = {};
            this.responseState = ResponseStates.OBJECT;
        }

        if (this.responseState != ResponseStates.OBJECT) throw new Error('Invalid response state to parse an object.');

        const [objKey, ...objValueArray] = line.split(':');
        const objValue = objValueArray.join(':');

        this.response[camelCase(objKey.trim())] = parseValueString(objValue);
    }

    parseTable(line){

        if (line.length > 120) throw new Error('Line exceeded max length of 120 bytes.');

        line = line.trim();

        if (!line.length) return;

        if (this._isTableDivider(line)) return;

        if (line[0] == '|' && line[line.length-1] == '|'){

            line = line.slice(1,-1);
        }

        //this must be the columns
        if (this.responseState == ResponseStates.INIT){

            this.response = [];
            this.responseTableCols = line.split('|').map(col => camelCase(col.trim()));
            this.responseState = ResponseStates.TABLE;

            return;
        }

        if (this.responseState != ResponseStates.TABLE) throw new Error('Invalid response state to parse a table.');

        this.response.push(zipObject(this.responseTableCols, line.split('|').map(parseValueString)));

    }

    parseDetect(line) {

        if (line.length > 120) throw new Error('Line exceeded max length of 120 bytes.');

        line = line.trim();

        if (!line.length) return;

        //on initial state we detect the response type
        if (this.responseState == ResponseStates.INIT){

            const detectedState = this._detectState(line);

            if (detectedState == ResponseStates.OBJECT) {

                this.parseObject(line);
            }
            else if (detectedState == ResponseStates.TABLE) {

                this.parseTable(line);
            }
        }
        else if (this.responseState == ResponseStates.OBJECT) {

            this.parseObject(line);
        }
        else if (this.responseState == ResponseStates.TABLE) {

            this.parseTable(line);
        }
    }

    getResponse() {

        return this.response;
    }

    _getCurrentResponse() {

        if (this.responseNestedProp) {

            return this.response[this.responseNestedProp];
        }

        return this.response;
    }

    _detectState(line) {

        if (line.length > 2){

            if (line[0] == '|' && line[line.length-1] == '|'){

                return ResponseStates.TABLE;
            }
            else if (line.indexOf(':') > 0){

                return ResponseStates.OBJECT;
            }
        }

        return ResponseStates.INIT;
    }


    _isTableDivider(line) {

        //looks for divider that starts/ends with '|' and consists exclusively of '|' and '-', or '=' characters
        return line.trim().match(/^\|[-|=]{3,}\|$/) != null;
    }

}