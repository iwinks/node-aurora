import Stream from "stream";
import Aurora from "./Aurora";
import {Parser} from "binary-parser";


export default class AuroraCmdTransformReadPacket extends Stream.Transform {

    static defaultOptions = {

        parseTimeout: 500,
        packetSize: 127
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

        console.log('chunk', respChunk.toString());

        if (this.leftoverBytes.length){

            console.log('leftover bytes', this.leftoverBytes);

            respChunk = Buffer.from(this.leftoverBytes).concat(respChunk);
            this.leftoverBytes = [];
        }

        if (respChunk.length < this.options.packetSize) {

            this.leftoverBytes = respChunk.values();

            console.log('incomplete packet', respChunk);

            done();
            return;
        }

        if (respChunk.length == this.options.packetSize) {

            try {

                const packet = this.parser.parse(respChunk);

                console.log(packet);

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

        console.log('Requesting resend', e);

        if (this.numRetries >= 3){

            this.cmd.triggerError(-1, "Failed reading file.");

            return;
        }

        this.numRetries++;

        //something went wrong, request resend
        Aurora._serial.write(new Buffer([0xCC]));
    }

    _requestNextPacket() {

        console.log('requesting next packet');

        this.numRetries = 0;

        Aurora._serial.write(new Buffer([0xAA]));
    }

}
