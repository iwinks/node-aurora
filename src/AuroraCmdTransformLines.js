import Stream from "stream";
import _ from 'lodash';

export default class AuroraCmdTransformLines extends Stream.Transform {

    constructor() {

        super({objectMode: true, encoding: null});

        this._leftoverData = '';
    }

    _transform(respChunk, encoding, done) {

        respChunk = respChunk.toString();

        if (this._leftoverData) {
            respChunk = this._leftoverData + respChunk;
            this._leftoverData = '';
        }

        let lines = respChunk.split("\n");

        this._leftoverData = lines.pop();

        lines = lines.map(line => {
            return line.trim();
        });

        this.push(_.compact(lines));

        done();
    }

    _flush(done) {
        
        this._leftoverData = this._leftoverData.trim();
        if (this._leftoverData) {
            console.log(this._leftoverData);
            this.push(this._leftoverData);
            this._leftoverData = null;
        }

        done();
    }
    
}
