import camelCase from 'lodash/camelCase';
import zipObject from 'lodash/zipObject';
import moment from 'moment';

const ResponseStates = {

    INIT: 0,
    ARRAY: 1,
    OBJECT: 2,
    OBJECT_ARRAY: 3,
    OUTPUT: 4
};

const ResponseTableStates = {

    INIT: 0,
    COLUMNS: 2,
    HEADER: 3,
    DATA: 4
};

export default class AuroraCmdResponseParser {

    constructor() {

        this.reset();
    }

    reset() {

        this.response = null;
        this.responseNestedProp = null;
        this.responseState = ResponseStates.INIT;
        this.responseTableState = ResponseTableStates.INIT;
    }


    parseLine(line) {

        if (line.length > 128) throw new Error('Line exceeded max length of 128 bytes.');

        line = line.trim();

        if (!line.length) return;

        //if we have a nest prop, check for nest divider end
        if (this.responseNestedProp && this._isObjectNestDivider(line)){

            //edge case: if a nest was started but didn't
            //contain anything, treat it as an empty array
            if (this.responseState == ResponseStates.INIT){

                this.response[this.responseNestedProp] = [];
            }

            //this is the end of a nest
            //so reset the state back to where
            //we were before
            this.responseNestedProp = null;
            this.responseState = ResponseStates.OBJECT;

            return;
        }

        //on initial state we detect the response type
        if (this.responseState == ResponseStates.INIT){

            this.responseState = this._detectState(line);

            const initialValue = (this.responseState == ResponseStates.ARRAY || this.responseState == ResponseStates.OBJECT_ARRAY) ? [] : {};

            //set initial value accordingly
            if (this.responseNestedProp) {

                this.response[this.responseNestedProp] = initialValue;
            }
            else {

                this.response = initialValue;
            }
        }

        if (this.responseState == ResponseStates.ARRAY) {

            this._getCurrentResponse().push(this._parseValue(line));
        }
        else if (this.responseState == ResponseStates.OBJECT) {

            const [objKey, ...objValueArray] = line.split(':');
            const objValue = objValueArray.join(':');

            if (this._isObjectNestDivider(objValue)){

                if (this.responseNestedProp) throw new Error('Object nesting only supported 1 level deep.');

                this.responseNestedProp = camelCase(objKey.trim());
                this.responseState = ResponseStates.INIT;

                return;
            }

            this._getCurrentResponse()[camelCase(objKey.trim())] = this._parseValue(objValue);
        }
        else if (this.responseState == ResponseStates.OBJECT_ARRAY) {

            this._parseTable(line);
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

            //if we haven't detected a state yet, let's be extra careful
            //about the first detection and check to make sure the value
            //can't be detected as something else, i.e. first element
            //of array is a date that contains ":"
            if (this.responseState != ResponseStates.INIT || this._parseValue(line) === line){

                if (line[0] == '|' && line[line.length-1] == '|'){

                    return ResponseStates.OBJECT_ARRAY;
                }
                else if (line.indexOf(':') > 0 && line.length > 2){

                    return ResponseStates.OBJECT;
                }
            }
        }

        return ResponseStates.ARRAY;
    }

    _parseValue(value) {

        value = value.trim();

        const valWithoutNumericSymbols = value.replace(/[$%,]+/g,'');

        if (!isNaN(valWithoutNumericSymbols)) {

            return +valWithoutNumericSymbols;
        }

        let date = moment(value, [
            moment.ISO_8601,
            "YYYY-MM-DD HH:mm:ss:SSS",
            "MMM  D YYYY - HH:mm:ss",
            "MMM DD YYYY - HH:mm:ss"
        ], true);

        if (date.isValid()){

            return +date;
        }

        const valueUC = value.toUpperCase();

        if (valueUC === 'TRUE' || valueUC === 'ON' || valueUC === 'ACTIVE') {

            return true;
        }
        else if (valueUC === 'FALSE' || valueUC === 'OFF' || valueUC === 'INACTIVE') {

            return false;
        }

        return value;
    }

    _parseTable(line) {

        switch (this.responseTableState) {

            case ResponseTableStates.INIT:

                if (!this._isTableDivider(line)) throw new Error('Expected table start.');

                //get array of column lengths
                const colLengths = line.slice(1, -1).split('|').map(col => col.length);

                //always match beginning of string
                let colRegexStr = '^\\|';

                //generate regex string, accounting for column lengths
                //this allow the column values to contain "|" characters
                //without screwing anything up
                for (const colLength of colLengths) {

                    colRegexStr += `(.{${colLength}})\\|`;
                }

                //always match end of string
                colRegexStr += '$';

                this.responseTableColRegex = new RegExp(colRegexStr);

                this.responseTableState = ResponseTableStates.COLUMNS;

                break;

            case ResponseTableStates.COLUMNS:

                //the matched groups represent the column names
                const columns = line.match(this.responseTableColRegex);

                if (!columns || columns.length < 2) throw new Error('Expected table columns.');

                //and run columns through trim and camelCase
                this.responseTableCols = columns.splice(1).map(col => camelCase(col.trim()));

                this.responseTableState = ResponseTableStates.HEADER;

                break;

            case ResponseTableStates.HEADER:

                if (!this._isTableHeaderOrFooter(line)) throw new Error('Expected table header.');

                this.responseTableState = ResponseTableStates.DATA;

                break;

            case ResponseTableStates.DATA:

                if (this._isTableHeaderOrFooter(line)){

                    this.responseTableState = ResponseTableStates.INIT;
                    break;
                }

                if (this._isTableDivider(line)){

                    break;
                }

                const values = line.match(this.responseTableColRegex);

                if (!values || values.length-1 != this.responseTableCols.length) throw new Error('Expected table values.');

                this._getCurrentResponse().push(zipObject(this.responseTableCols, values.splice(1).map(this._parseValue)));

                break;
        }

    }

    _isTableDivider(line) {

        //looks for divider that consist exclusively of '|' and '-' characters
        return line.trim().match(/^[-|\|]{3,}$/) != null;
    }

    _isTableHeaderOrFooter(line) {

        //looks for divider that consist exclusively of '|' and '=' characters
        return line.trim().match(/^[=|\|]{3,}$/) != null;
    }

    _isObjectNestDivider(line) {

        //looks for divider that consist exclusively of '.' characters
        return line.trim().match(/^[\.]{3,}$/) != null;
    }
}