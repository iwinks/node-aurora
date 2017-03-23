import EventEmitter from 'events';
import {BleCmdStates, DataTypes, STREAM_ID_MAX, EVENT_ID_MAX, StreamIdsToNames, EventIdsToNames} from './AuroraConstants';
import AuroraCmdResponseParser from './AuroraCmdResponseParser';


export default class AuroraBluetoothParser extends EventEmitter {

    constructor() {

        super();

        this._cmdResponseParser = new AuroraCmdResponseParser();

        this.reset();
    }

    reset() {

        clearTimeout(this._cmdWatchdogTimer);

        this._cmd = null;
        this._cmdResponseParser.reset();
        this._cmdState = BleCmdStates.IDLE;
    }

    setCmd(cmd) {

        if (this._cmdState != BleCmdStates.IDLE) throw new Error('Parser command state not idle.');

        this.reset();

        this._cmd = {
            command: cmd
        };

        this._cmdWatchdogTimer = setTimeout(this._onCmdTimeout, 2000);
    }

    onStreamDataCharNotification(dataBuffer) {

        let stream = null;
        let streamDataType = DataTypes.UNKNOWN;
        let streamDataLength = 0;

        for (let i = 0; i < dataBuffer.length; i++){

            if (!stream){

                const streamId = dataBuffer[i];

                if (streamId > STREAM_ID_MAX) {

                    this.emit('parseError', 'Invalid stream id: ' + streamId);
                    continue;
                }

                i++;

                if (i < dataBuffer.length) {

                    streamDataType = dataBuffer[i] >> 4;
                    streamDataLength = dataBuffer[i] & 0x0F;

                    if (i+streamDataLength <= dataBuffer.length) {

                        stream = {
                            streamId,
                            stream: StreamIdsToNames[streamId],
                            data: [],
                            time: Date.now()
                        };

                        continue;
                    }
                }

                this.emit('parseError', 'Incomplete stream packet.');
            }
            else {

                switch (streamDataType){

                    case DataTypes.BOOL:
                    case DataTypes.UINT8:
                        stream.data.push(dataBuffer.readUInt8(i));
                        break;

                    case DataTypes.INT8:
                        stream.data.push(dataBuffer.readInt8(i));
                        break;

                    case DataTypes.UINT16:
                        stream.data.push(dataBuffer.readUInt16LE(i));
                        i+=1;
                        break;

                    case DataTypes.INT16:
                        stream.data.push(dataBuffer.readInt16LE(i));
                        i+=1;
                        break;

                    case DataTypes.UINT32:
                    case DataTypes.PTR:
                        stream.data.push(dataBuffer.readUInt32LE(i));
                        i+=3;
                        break;

                    case DataTypes.INT32:
                        stream.data.push(dataBuffer.readInt32LE(i));
                        i+=3;
                        break;

                    case DataTypes.FLOAT:
                        stream.data.push(dataBuffer.readFloatLE(i));
                        i+=3;
                        break;

                    case DataTypes.UNKNOWN:
                    case DataTypes.STR:
                    case DataTypes.CHAR:
                    default:
                        this.emit('parseError', 'Invalid or unsupported stream data type: ' + streamDataType);
                }

                streamDataLength--;

                if (!streamDataLength){

                    this.emit('streamData', stream);
                    stream = null;
                }

            }
        }
    }

    onAuroraEventCharNotification(eventBuffer) {

        if (eventBuffer.length != 5) {

            this.emit('parseError', 'Incomplete event packet.');
            return;
        }

        const eventId = eventBuffer[0];

        if (eventId > EVENT_ID_MAX) {

            this.emit('parseError', 'Invalid event id.');
            return;
        }

        this.emit('auroraEvent', {

            eventId,
            event: EventIdsToNames[eventId],
            flags: eventBuffer.readUInt32LE(1),
            time: Date.now()
        });

    }

    onCmdStatusCharNotification(statusBuffer) {

        this._cmdState = statusBuffer[0];

        clearTimeout(this._cmdWatchdogTimer);

        this._cmdWatchdogTimer = setTimeout(this._onCmdTimeout, 2000);

        if (this._cmdState != BleCmdStates.IDLE && !this._cmd){

            this.emit('parseError', 'Invalid status change. No command set.');
            return;
        }

        switch (this._cmdState) {

            //is this the end of a command? i.e now idle
            case BleCmdStates.IDLE:

                if (this._cmd) {

                    this._cmd.response = this._cmdResponseParser.getResponse();
                    this._cmd.error = statusBuffer[1] !== 0;

                    this.emit('cmdResponse', this._cmd);
                }

                this.reset();

                break;

            //do we have a response to receive
            case BleCmdStates.CMD_RESP_OBJECT_READY:

                //second statusBuffer byte is number of bytes available to read
                this.emit('cmdResponseRead', statusBuffer[1], this._cmdDataReceiveResponseObject);

                break;

            case BleCmdStates.CMD_RESP_TABLE_READY:

                //second statusBuffer byte is number of bytes available to read
                this.emit('cmdResponseRead', statusBuffer[1], this._cmdDataReceiveResponseTable);

                break;

            //command waiting for input
            case BleCmdStates.CMD_INPUT_REQUESTED:

                this.emit('cmdInputRequested');
                clearTimeout(this._cmdWatchdogTimer);

                break;

            default:

                this.emit('parseError', 'Unknown command state: ' + statusBuffer[0]);
                break;
        }

    }

    onCmdOutputCharNotification(output){

        this.emit('cmdOutputReady', output);

        clearTimeout(this._cmdWatchdogTimer);
        this._cmdWatchdogTimer = setTimeout(this._onCmdTimeout, 2000);
    }

    _cmdDataReceiveResponseObject = (buffer) => {

        if (this._cmdState != BleCmdStates.CMD_RESP_OBJECT_READY) throw new Error('Invalid state to receive object response.');

        try {
            this._cmdResponseParser.parseObject(buffer.toString('ascii'));
        }
        catch (error) {

            this.emit('parseError', `Failed parsing object: ${error}`);
        }

    };

    _cmdDataReceiveResponseTable = (buffer) => {

        if (this._cmdState != BleCmdStates.CMD_RESP_TABLE_READY) throw new Error('Invalid state to receive table response.');

        try {
            this._cmdResponseParser.parseTable(buffer.toString('ascii'));
        }
        catch (error){

            this.emit('parseError', `Failed parsing table: ${error}`);
        }
    };

    _triggerCmdError = (message) => {

        this._cmd.error = true;
        this._cmd.response = {
            error: -64,
            message
        };

        this.emit('cmdResponse', this._cmd);

        this.reset();
    };

    _onCmdTimeout = () => {

        this._triggerCmdError('Command timed out.');
    };

}