import Stream from "stream";
import _ from 'lodash';
import {Parser} from "binary-parser";

export default class AuroraCmdTransformBinary extends Stream.Transform {

    constructor() {

        super();

        this.parser = new Parser();

        this.leftoverBytes = [];

        this.parser.array('values', {
            type: 'int16le',
            readUntil: 'eof',
            formatter: function(values) {

                return values.join(',');
            }
        });
    }

    _transform(respChunk, encoding, done) {

        if (this.leftoverBytes.length){

            respChunk = Buffer.from(this.leftoverBytes).concat(respChunk);
            this.leftoverBytes = [];
        }

        if (respChunk.length < 2) {

            this.leftoverBytes = respChunk.values();
            done();
        }

        const numBytesLeftover = respChunk.length % 2;

        if (numBytesLeftover) {

            this.push(this.parser.parse(respChunk.slice(0, -numBytesLeftover)));
            this.leftoverBytes = respChunk.slice(-numBytesLeftover).values();
        }
        else {
            this.push(this.parser.parse(respChunk));
        }

        done();
    }

    _flush(done) {

        if (this.leftoverBytes.length) {
            console.log("Unparsed binary bytes: ", this.leftoverBytes);
        }

        done();
    }
    
}
