import Stream from "stream";
import Aurora from "./Aurora";
import {Parser} from "binary-parser";


export default class AuroraCmdTransformReadPacket extends Stream.Transform {

    static defaultOptions = {

        parseTimeout: 500,
        packetSize: 128
    };

    constructor(cmd, options) {

        super();

        this.options = _.defaultsDeep(options, AuroraCmdTransformReadPacket.defaultOptions);

        this.cmd = cmd;

        this.leftoverBytes = [];

        this.parser = new Parser()
            .uint8('sync', {assert: 0xAA})
            .uint8('syncCheck', {assert: 0xAA})
            .uint8('payloadLength')
            .buffer('payload', {length: 'payloadLength'})
            .uint8('checksum');

        /*
         if ((~(this.checksum % 256) & 0x000000FF) == b) {

         }
         */

        this.numRetries = 0;

        this.on('finish', () => {
           
            clearTimeout(this.parseTimer);
        });

    }

    _transform(respChunk, encoding, done) {

        if (this.leftoverBytes.length){

            respChunk = Buffer.from(this.leftoverBytes).concat(respChunk);
            this.leftoverBytes = [];
        }

        if (respChunk.length < this.options.packetSize) {

            this.leftoverBytes = respChunk.values();

            done();
            return;
        }

        if (respChunk.length == this.options.packetSize) {

            try {

                const packet = this.parser.parse(respChunk);

                this.push(packet.payload);

                this._requestNextPacket();
            }
            catch (e) {

                this._requestResend(e);
            }
        }
        else {

            this._requestResend('Chunk size doesn\'t match packet size.');
        }

        done();
    }

    _requestResend(e) {

        if (this.numRetries >= 3){

            this.cmd.triggerError(-1, "Failed reading file.");

            return;
        }

        this.numRetries++;

        //something went wrong, request resend
        Aurora._serial.write(new Buffer([0xCC]));
    }

    _requestNextPacket() {

        this.numRetries = 0;

        Aurora._serial.write(new Buffer([0xAA]));
    }

}
