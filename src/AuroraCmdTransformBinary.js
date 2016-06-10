import Stream from "stream";
import _ from 'lodash';
import {Parser} from "binary-parser";
import AuroraConstants from './AuroraConstants';

export default class AuroraCmdTransformBinary extends Stream.Transform {

    static defaultOptions = {
        dataType: AuroraConstants.DataTypes.UINT8,
        parseType: undefined,
        parseTypeLength: undefined
    };


    constructor(options) {

        super();

        this.options = _.defaultsDeep(options, AuroraCmdTransformBinary.defaultOptions);

        if (typeof this.options.parseType == 'undefined') {

            this.options.parseType = this._getParseTypeFromDataType(this.options.dataType);
        }

        if (typeof this.options.parseTypeLength == 'undefined') {

            this.options.parseTypeLength = this._getParseTypeLengthFromDataType(this.options.dataType);
        }

        console.log('parsing types', this.options.parseType, this.options.parseTypeLength);

        this.parser = new Parser();

        this.leftoverBuffer = null;
        this.hasData = false;

        this.parser.array('values', {
            type: this.options.parseType,
            readUntil: 'eof',
            formatter: function(values) {
                console.log('parse', values).join(',');
                return values.join(',');
            }
        });
    }

    _transform(respChunk, encoding, done) {

        console.log('chunk', respChunk);

        if (Buffer.isBuffer(this.leftoverBuffer)){

            respChunk = Buffer.concat([this.leftoverBuffer, respChunk], this.leftoverBuffer.length + respChunk.length);
            this.leftoverBuffer = null;
        }

        if (respChunk.length < this.options.parseTypeLength) {

            this.leftoverBuffer = respChunk;
            done();
            return;
        }

        

        const numBytesLeftover = respChunk.length % this.options.parseTypeLength;

        console.log('bytes leftover', numBytesLeftover);

        let parsedChunk;

        if (numBytesLeftover) {

            parsedChunk = this.parser.parse(respChunk.slice(0, -numBytesLeftover));

            this.leftoverBuffer = respChunk.slice(-numBytesLeftover);

        } else {

            parsedChunk = this.parser.parse(respChunk);
        }

        this.push((this.hasData ? ',' : '') + parsedChunk.values);

        this.hasData = true;

        done();
    }

    _flush(done) {

        if (this.leftoverBuffer) {
            console.log("Unparsed binary buffer: ", this.leftoverBuffer);
        }

        this.hasData = false;

        done();
    }

    _getParseTypeFromDataType(dataType) {

        switch(dataType){

            case AuroraConstants.DataTypes.INT8 :
                return 'int8';

            case AuroraConstants.DataTypes.UINT16 :
                return 'uint16le';

            case AuroraConstants.DataTypes.INT16 :
                return 'int16le';

            case AuroraConstants.DataTypes.FLOAT :
                return 'floatle';

            case AuroraConstants.DataTypes.UINT32 :
            case AuroraConstants.DataTypes.STR :
            case AuroraConstants.DataTypes.PTR :

                return 'uint32le';

            case AuroraConstants.DataTypes.INT32 :
                return 'int32le';

            case AuroraConstants.DataTypes.UINT8 :
            case AuroraConstants.DataTypes.CHAR :
            default:
                return 'uint8';

        }
    }

    _getParseTypeLengthFromDataType(dataType) {

        switch(dataType){

            case AuroraConstants.DataTypes.UINT16 :
            case AuroraConstants.DataTypes.INT16 :
                return 2;

            case AuroraConstants.DataTypes.UINT32 :
            case AuroraConstants.DataTypes.FLOAT :
            case AuroraConstants.DataTypes.STR :
            case AuroraConstants.DataTypes.PTR :
            case AuroraConstants.DataTypes.INT32 :
                return 4;

            case AuroraConstants.DataTypes.UINT8 :
            case AuroraConstants.DataTypes.CHAR :
            case AuroraConstants.DataTypes.INT8 :
            default:
                return 1;

        }
    }
    
}