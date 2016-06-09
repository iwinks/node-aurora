import Stream from "stream";
import _ from 'lodash';
import {Parser} from "binary-parser";

export default class AuroraCmdTransformBinary extends Stream.Transform {

    constructor() {

        super();

        this.parser = new Parser();

        this.parser.array('values', {
            type: 'int16',
            readUntil: 'eof',
            formatter: function(values) {

                return values.join(',');
            }
        });
    }

    _transform(respChunk, encoding, done) {

        this.push(this.parser.parse(respChunk));

        done();
    }
    
}
