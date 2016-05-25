import Stream from "stream";
import Aurora from "./Aurora";

const PacketParseState = {

    SYNC: 0,
    SYNC_CHECK: 1,
    PAYLOAD_LENGTH: 2,
    PAYLOAD: 3,
    CHECKSUM: 4
};

export default class AuroraCmdTransformReadPacket extends Stream.Transform {

    static defaultOptions = {

        parseTimeout: 500
    };

    constructor(cmd, options) {

        super();

        this.options = _.defaultsDeep(options, AuroraCmdTransformReadPacket.defaultOptions);

        this.cmd = cmd;

        this.parseState = PacketParseState.SYNC;
        this.packetsReceived = 0;

        this.on('finish', () => {
           
            clearTimeout(this.parseTimer);
        });

    }

    _transform(respBufferChunk, encoding, done) {

        for (let b of respBufferChunk) {

            this._parseByte(b);
        }

        done();
    }

    _parseByte(b) {

        let byteExpected = true;

        switch (this.parseState) {

            case PacketParseState.SYNC:

                byteExpected = (b == 0xAA);

                if (byteExpected) {

                    this.parseState = PacketParseState.SYNC_CHECK;

                    if (this.options.parseTimeout) {

                        clearTimeout(this.parseTimer);
                        this.parseTimer = setTimeout(() => {

                            this.parseState = PacketParseState.SYNC;

                            if (this.numRetries){

                                if (this.numRetries > 3){
                                    this.cmd.triggerError(-1, "Failed reading file.");
                                    return;
                                }

                                Aurora._serial.write(new Buffer([0xCC]));
                                this.numRetries++;
                            }
                            else {

                                Aurora._serial.write(new Buffer([0xAA]));
                            }

                        }, this.options.parseTimeout);
                    }
                }

                break;

            case PacketParseState.SYNC_CHECK:

                byteExpected = (b == 0xAA);

                if (byteExpected) {

                    this.parseState = PacketParseState.PAYLOAD_LENGTH;
                }

                break;

            case PacketParseState.PAYLOAD_LENGTH:

                this.payloadLength = b;
                this.payload = new Buffer(b);
                this.parseState = PacketParseState.PAYLOAD;
                this.bytesReceived = 0;
                this.checksum = 0;
                break;

            case PacketParseState.PAYLOAD:

                this.payload[this.bytesReceived++] = b;
                this.checksum += b;

                if (this.bytesReceived == this.payloadLength) {
                    
                    this.parseState = PacketParseState.CHECKSUM;
                }
                break;

            case PacketParseState.CHECKSUM:


                if ((~(this.checksum % 256) & 0x000000FF) == b) {

                    this.push(this.payload);
                    Aurora._serial.write(new Buffer([0xAA]));
                    this.packetsReceived++;
                    this.numRetries = 0;
                }
                else {
                    console.log('checksum failed. requesting resend...');
                    Aurora._serial.write(new Buffer([0xCC]));
                    this.numRetries++;
                }

                this.parseState = PacketParseState.SYNC;
                break;
        }

        if (!byteExpected) {

            console.log('unexpected byte: ' + b + ' state: ' + this.parseState);
            this.parseState = PacketParseState.SYNC;
        }

    }

    
}
