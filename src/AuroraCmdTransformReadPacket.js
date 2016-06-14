import Stream from "stream";
import Aurora from "./Aurora";
import {Parser} from "binary-parser";


export default class AuroraCmdTransformReadPacket extends Stream.Transform {

    static defaultOptions = {

        parseTimeout: 500
    };

    constructor(cmd, options) {

        super();

        this.options = _.defaultsDeep(options, AuroraCmdTransformReadPacket.defaultOptions);

        this.cmd = cmd;

        this.leftoverBuffer = null;

        this.payloadLength = -1;

        this.headerParser = new Parser()
            .uint8('sync', {assert: 0xAA})
            .uint8('syncCheck', {assert: 0xAA})
            .uint16('payloadLength');

        this.numRetries = 0;

        this.on('finish', () => {

            clearTimeout(this.parseTimer);
        });

    }

    _transform(respChunk, encoding, done) {

        console.log('chunk', respChunk);

        if (!respChunk.length) {

            console.log('no data in packet');
            done();
            return;
        }

        if (Buffer.isBuffer(this.leftoverBuffer)){

            respChunk = Buffer.concat([this.leftoverBuffer, respChunk], this.leftoverBuffer.length + respChunk.length);
            this.leftoverBuffer = null;
        }

        //this means we haven't received the header yet
        if (this.payloadLength == -1) {

            if (respChunk.length < 4) {

                this.leftoverBuffer = respChunk;

                console.log('incomplete header', respChunk);
                done();
                return;
            }

            try
            {
                console.log('header', respChunk.slice(0, 4));
                let header = this.headerParser.parse(respChunk.slice(0, 4));

                respChunk = respChunk.slice(4);

                this.payloadLength = header.payloadLength;
            }
            catch (e)
            {
                this._requestResend('Corrupted header: ' + e);
                done();
                return;
            }
        }

        //at this point we have read the header
        //so make sure we have the entire payload
        //and the checksum before we continue
        if (respChunk.length < (this.payloadLength+2)){

            this.leftoverBuffer = respChunk;
            done();
            return;
        }

        //we now have the entire payload too, so calculate
        //checksum and send the OK if it checks out
        let payloadSum = 0;
        for (let i = 0; i < this.payloadLength; i++){

            payloadSum += respChunk[i];
        }

        const checksum = respChunk.readUIntLE(this.payloadLength-2);

        if ((~(payloadSum % (2^16)) & 0x0000FFFF) == checksum){

            this.push(respChunk.slice(0, -2)); //don't include checksum
            this._requestNextPacket();
        }
        else {

            this._requestResend('Failed checksum.');
        }


        done();
    }

    _requestResend(error) {

        console.log('Requesting resend', error);

        if (this.numRetries >= 3){

            this.cmd.triggerError(-1, "Failed reading file.");

            return;
        }

        this.payloadLength = -1;
        this.numRetries++;

        //something went wrong, request resend
        Aurora._serial.write(new Buffer([0xCC]));
        Aurora._serial.drain();
    }

    _requestNextPacket() {

        console.time('requesting next packet');

        this.payloadLength = -1;
        this.numRetries = 0;

        Aurora._serial.write(new Buffer([0xAA]));
        Aurora._serial.drain();
    }

}
