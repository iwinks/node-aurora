import EventEmitter from 'events';
import AuroraConstants from './AuroraConstants';
import moment from 'moment';

class AuroraResponseSerialParser extends EventEmitter {

    static logTypesToEvents = {

        INFO: 'responseLogInfo',
        WARN: 'responseLogWarning',
        ERRO: 'responseLogError',
        DATA: 'responseLogData',
        EVNT: 'responseLogEvent'
    };

    constructor() {

        super();

        this.reset();
    }

    reset() {

        this.unparsedBuffer = null;
        this.responseState = AuroraConstants.ResponseStates.NO_COMMAND;
    }

    parseChunk(chunk) {

        //don't do anything if chunk is empty
        if (!chunk.length) {
            return;
        }

        //pick up where we left off
        this.unparsedBuffer = Buffer.isBuffer(this.unparsedBuffer) ? Buffer.concat([this.unparsedBuffer, chunk]) : chunk;

        while (this.unparsedBuffer && this.unparsedBuffer.length) {

            //if we aren't in the middle of processing a response
            if (this.responseState == AuroraConstants.ResponseStates.NO_COMMAND || this.responseState == AuroraConstants.ResponseStates.COMMAND_HEADER){

                //look for first newline
                const newlineIndex = this.unparsedBuffer.indexOf('\n');

                //no newline, so wait for the next chunk
                if (newlineIndex == -1) {

                    return;
                }

                //we must have a newline now so grab the line
                let bufferLine = this.unparsedBuffer.slice(0, newlineIndex).toString().trim();

                //and remove it from the unparsed buffer
                this.unparsedBuffer = this.unparsedBuffer.slice(newlineIndex+1);

                //after trim, if no data is in line, bail
                if (!bufferLine.length){
                    continue;
                }

                if (this.responseState == AuroraConstants.ResponseStates.NO_COMMAND){

                    const cmdPromptIndex = bufferLine.indexOf(AuroraConstants.COMMAND_PROMPT);

                    //is the line a command prompt?
                    if (cmdPromptIndex != -1) {

                        this.responseState = AuroraConstants.ResponseStates.COMMAND_HEADER;

                        if (cmdPromptIndex) {

                            this._parseNonCommandResponseLine(bufferLine.slice(0, cmdPromptIndex));

                            bufferLine = bufferLine.slice(cmdPromptIndex);
                        }

                        this.emit('commandBegin', bufferLine.slice(AuroraConstants.COMMAND_PROMPT.length));
                    }
                    else {

                        this._parseNonCommandResponseLine(bufferLine);
                    }
                }
                else if (bufferLine.indexOf(AuroraConstants.COMMAND_DIVIDER_SUCCESS_STRING) === 0) {

                    this.responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE_SUCCESS;
                }
                //is the line an error header?
                else if (bufferLine.indexOf(AuroraConstants.COMMAND_DIVIDER_ERROR_STRING) === 0) {

                    this.responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE_ERROR;
                }
            }
            else {

                //we need at least 4 characters to find out
                //what the buffer contains
                if (this.unparsedBuffer.length < 4) {
                    return;
                }

                //if we are processing success response,
                //check for sync bytes which indicates "packet mode"
                if (this.responseState == AuroraConstants.ResponseStates.COMMAND_RESPONSE_SUCCESS &&
                    this.unparsedBuffer[0] == AuroraConstants.AURORA_PACKET_SYNC_BYTE &&
                    this.unparsedBuffer[1] == AuroraConstants.AURORA_PACKET_SYNC_BYTE) {

                    const payloadLength = this.unparsedBuffer.readUInt16LE(2);

                    //at this point we have read the header
                    //so make sure we have the entire payload
                    //and the checksum before we continue
                    if (this.unparsedBuffer.length < (payloadLength + 8)) {

                        return;
                    }

                    //remove header from buffer since we have enough data now
                    this.unparsedBuffer = this.unparsedBuffer.slice(4);

                    //we now have the entire payload too, so calculate
                    //checksum and send the OK if it checks out
                    let payloadSum = 0;
                    for (let i = 0; i < payloadLength; i++) {

                        payloadSum += this.unparsedBuffer[i];
                    }

                    const checksum = this.unparsedBuffer.readInt32LE(payloadLength);

                    if (~payloadSum == checksum) {

                        this.emit('packetSuccess', this.unparsedBuffer.slice(0, payloadLength));
                    }
                    else {

                        this.emit('packetError', 'Failed checksum.');
                    }

                    this.unparsedBuffer = this.unparsedBuffer.slice(payloadLength+4); //skip the checkum

                    continue;
                }

                //if we haven't seen the footer yet, look for the beginning of it
                if (this.responseState != AuroraConstants.ResponseStates.COMMAND_FOOTER_SUCCESS &&
                    this.responseState != AuroraConstants.ResponseStates.COMMAND_FOOTER_ERROR) {

                    const isSuccessResponse = this.responseState == AuroraConstants.ResponseStates.COMMAND_RESPONSE_SUCCESS;

                    const responseEvent = isSuccessResponse ? 'responseSuccess' : 'responseError';
                    const footerSearch = '\r\n' + (isSuccessResponse ? AuroraConstants.COMMAND_DIVIDER_SUCCESS_STRING : AuroraConstants.COMMAND_DIVIDER_ERROR_STRING);

                    const footerStartIndex = this.unparsedBuffer.indexOf(footerSearch);

                    //if we haven't seen the beginning of the footer yet,
                    //nothing to do
                    if (footerStartIndex == -1) {

                        return;
                    }

                    this.responseState = isSuccessResponse ? AuroraConstants.ResponseStates.COMMAND_FOOTER_SUCCESS : AuroraConstants.ResponseStates.COMMAND_FOOTER_ERROR;

                    //is there data before the footer?
                    if (footerStartIndex) {

                        this.emit(responseEvent, this.unparsedBuffer.slice(0, footerStartIndex));

                        //remove anything before footer, including preceeding carriage and newline
                        this.unparsedBuffer = this.unparsedBuffer.slice(footerStartIndex+2);
                    }
                }

                //we need to perform check again, since it might have changed in the last IF block
                if (this.responseState == AuroraConstants.ResponseStates.COMMAND_FOOTER_SUCCESS ||
                    this.responseState == AuroraConstants.ResponseStates.COMMAND_FOOTER_ERROR) {

                    //we just need to find end of footer
                    const footerEndIndex = this.unparsedBuffer.indexOf('\r\n');

                    //don't have it yet, so wait
                    if (footerEndIndex == -1) {

                        return;
                    }

                    //we've found the end of the footer!

                    //remove the entire response and footer from the unparsed buffer
                    this.unparsedBuffer = this.unparsedBuffer.slice(footerEndIndex + 2);

                    this.emit('commandEnd', this.responseState == AuroraConstants.ResponseStates.COMMAND_FOOTER_ERROR);

                    //reset response state
                    this.responseState = AuroraConstants.ResponseStates.NO_COMMAND;
                }
            }
        }
    }

    _parseNonCommandResponseLine = (line) => {

        if (line.charAt(0) == '<'){

            const logParts = line.match(/\< (WARN|ERRO|INFO|DATA|EVNT) \| (\d{2}:\d{2}:\d{2}\.\d{3}) > (.+)/i);

            if (logParts && logParts.length == 4){

                const logDate = moment(logParts[2], "HH:mm:ss.SSS", true).toDate();

                this.emit(AuroraResponseSerialParser.logTypesToEvents[logParts[1].toUpperCase()], logParts[3], logDate);
                return;
            }
        }
        else if (line.slice(0, 6) == 'event-'){

            const eventParts = line.match(/event-(\d{1,2}): (\d+)/i);

            if (eventParts && eventParts.length == 3){

                this.emit('responseEvent', +eventParts[1], +eventParts[2]);
                return;
            }
        }
        else {

            const dataParts = line.split(': ');

            if (dataParts.length == 2) {

                this.emit('responseData', dataParts[0], dataParts[1].split(',').map(Number));
                return;
            }
        }

        this.emit('responseUnknown', line);
    }
}

export default new AuroraResponseSerialParser();