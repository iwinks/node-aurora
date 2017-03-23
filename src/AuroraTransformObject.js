import Stream from 'stream';
import Flat from 'flat';
import {parseValueString, camelCaseObjectKeys} from './util';

export default class AuroraTransformObject extends Stream.Transform {

    constructor() {

        super({objectMode: true, encoding: null});

        this._leftoverData = '';
        this._transformedObject = {};
    }

    _transform(chunk, encoding, done) {

        chunk = chunk.toString();

        if (this._leftoverData) {
            chunk = this._leftoverData + chunk;
            this._leftoverData = '';
        }

        let lines = chunk.split('\n');

        this._leftoverData = lines.pop();

        lines = lines.map(line => line.trim()).filter(String);

        for (let line of lines) {

            this._processLine(line);
        }

        done();
    }

    _flush(done) {

        this._leftoverData = this._leftoverData.trim();

        if (this._leftoverData) {

            this._processLine(this._leftoverData);
        }

        this.push(camelCaseObjectKeys(Flat.unflatten(this._transformedObject)));

        done();
    }

    _processLine(line) {

        var key_value = line.split(':');

        if (key_value.length >= 2) {

            let key = key_value.shift().trim();

            this._transformedObject[key] = parseValueString(key_value.join(':'));
        }
    }
}

