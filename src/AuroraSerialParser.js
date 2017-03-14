import EventEmitter from 'events';
import {LogNamesToTypeIds, STREAM_ID_MAX, EVENT_ID_MAX, StreamIdsToNames, EventIdsToNames} from './AuroraConstants';
import AuroraCmdResponseParser from './AuroraCmdResponseParser';
import moment from 'moment';

const CmdStates = {

    NO_CMD: 0,
    CMD_HEADER: 1,
    CMD_RESPONSE: 2,
    CMD_OUTPUT: 3,
    CMD_INPUT: 4,
    CMD_ERROR: 5
};

export default class AuroraSerialParser extends EventEmitter {

    constructor() {

        super();

        this._cmdResponseParser = new AuroraCmdResponseParser();
        this._cmdWatchdogTimer = null;

        this.reset();

        this._regexLog = new RegExp('^\\< (' + Object.keys(LogNamesToTypeIds).join('|') + ') \\| (\\d{2}:\\d{2}:\\d{2}\\.\\d{3}) \\> (.+)$');
    }

    reset() {

        clearTimeout(this._cmdWatchdogTimer);

        this._cmd = null;
        this._cmdResponseParser.reset();
        this._cmdState = CmdStates.NO_CMD;
    }

    parseLine(line) {

        clearTimeout(this._cmdWatchdogTimer);

        let match;

        switch (this._cmdState) {

            case CmdStates.NO_CMD :

                //trim off whitespace
                line = line.trim();

                //don't do anything if line is empty
                if (!line.length) {
                    return;
                }

                //look for command prompt
                match = line.match(/^# ([a-z-]+.*)$/i);

                if (match){

                    this._cmd = {
                        command: match[1],
                        error: false
                    };

                    this._cmdState = CmdStates.CMD_HEADER;

                    this._cmdWatchdogTimer = setTimeout(this._onCmdTimeout, 1000);
                }
                else {

                    this._parseNonCmdResponseLine(line);
                }

                break;

            case CmdStates.CMD_HEADER :

                //look for response start
                if (line.match(/^[-]{64,}$/)){

                    this._cmdResponseParser.reset();
                    this._cmdState = CmdStates.CMD_RESPONSE;
                }
                else {

                    this._triggerCmdError('Expected command header.');
                }

                break;

            case CmdStates.CMD_OUTPUT :

                this._cmdWatchdogTimer = setTimeout(this._onCmdTimeout, 1000);

                //look for output footer
                if (line[0] == '+' && line.match(/^[+]{64,}$/)){

                    this._cmdState = CmdStates.CMD_RESPONSE;
                }
                //this must be output
                else {

                    //add back the newlines since this is raw output
                    this._cmd.output += (this._cmd.output ? '\r\n' : '') + line;
                }

                break;

            case CmdStates.CMD_INPUT :

                this._cmdWatchdogTimer = setTimeout(this._onCmdTimeout, 1000);

                //look for input footer
                if (line[0] == '.' && line.match(/^[.]{64,}$/)){

                    this._cmdState = CmdStates.CMD_RESPONSE;
                }

                break;

            case CmdStates.CMD_ERROR :

                this._cmdWatchdogTimer = setTimeout(this._onCmdTimeout, 1000);

                //look for error footer
                if (line[0] == '~' && line.match(/^[~]{64,}$/)){

                    this._cmdState = CmdStates.CMD_RESPONSE;
                }
                else {

                    try {

                        this._cmdResponseParser.parseDetect(line);
                    }
                    catch (error) {

                        this._triggerCmdError(`Invalid command error response: ${error}`);
                    }
                }

                break;


            case CmdStates.CMD_RESPONSE :

                //trim off whitespace
                line = line.trim();

                //don't do anything if line is empty
                if (!line.length) {
                    return;
                }

                //look for output header
                if (line[0] == '+' && line.match(/^[+]{64,}$/)){

                    this._cmd.output = '';
                    this._cmdState = CmdStates.CMD_OUTPUT;
                }
                //look for input header
                else if (line[0] == '.' && line.match(/^[.]{64,}$/)){

                    this._cmdState = CmdStates.CMD_INPUT;
                    this.emit('cmdInputRequested');
                }
                //look for error header
                else if (line[0] == '~' && line.match(/^[~]{64,}$/))
                {
                    this._cmd.error = true;
                    this._cmdResponseParser.reset();
                    this._cmdState = CmdStates.CMD_ERROR;
                }
                //look for end of response
                else if (match = line.match(/^[-]{64,}$/)){

                    this._cmd.response = this._cmdResponseParser.getResponse();
                    this.emit('cmdResponse', this._cmd);
                    this._cmdState = CmdStates.NO_CMD;
                }
                //neither, so this is normal command response
                else if (!this._cmd.error) {

                    this._cmdWatchdogTimer = setTimeout(this._onCmdTimeout, 1000);

                    try {

                        this._cmdResponseParser.parseDetect(line);
                    }
                    catch(error) {

                        this._triggerCmdError(`Invalid command response: ${error}`);
                    }
                }

                break;
        }
    }

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

    _parseNonCmdResponseLine = (line) => {

        if (line.charAt(0) == '<'){

            const logParts = line.match(this._regexLog);

            if (logParts && logParts.length == 4){

                this.emit('log', {
                    typeId: LogNamesToTypeIds[logParts[1].toUpperCase()],
                    type: logParts[1].toUpperCase(),
                    time: +moment(logParts[2], "HH:mm:ss.SSS", true),
                    message: logParts[3]
                });

                return;
            }
        }
        else if (line.slice(0, 6) == 'event-'){

            const eventParts = line.match(/^event-(\d{1,2}): (\d+) \[(\S*)\]$/i);

            if (eventParts && eventParts.length == 4) {

                const eventId = +eventParts[1];

                if (!isNaN(eventId) && eventId <= EVENT_ID_MAX) {

                    this.emit('auroraEvent', {

                        eventId,
                        event: EventIdsToNames[eventId],
                        flags: +eventParts[2],
                        time: Date.now()
                    });

                    return;
                }
            }
        }
        else {

            const dataParts = line.match(/^(\S*)-(\d{1,2}): ([\d\s,.-]+)$/i);

            if (dataParts && dataParts.length == 4) {

                const streamId = +dataParts[2];

                if (!isNaN(streamId) && streamId <= STREAM_ID_MAX) {

                    this.emit('streamData', {

                        streamId,
                        stream: StreamIdsToNames[streamId],
                        data: dataParts[3].split(',').map(Number),
                        time: Date.now()
                    });

                    return;

                }
            }
        }

        this.emit('parseError', line);
    };

}