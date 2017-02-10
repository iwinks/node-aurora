import EventEmitter from 'events';
import {LogNamesToTypes} from './AuroraConstants';
import AuroraCmdResponseParser from './AuroraCmdResponseParser';
import moment from 'moment';

const CmdStates = {

    NO_CMD: 0,
    CMD_HEADER: 1,
    CMD_RESPONSE: 2,
    CMD_OUTPUT: 3
};

export default class AuroraSerialParser extends EventEmitter {

    constructor() {

        super();

        this._cmdResponseParser = new AuroraCmdResponseParser();
        this._watchdogTimer = null;

        this.reset();

        this._regexLog = new RegExp('\\< (' + Object.keys(LogNamesToTypes).join('|') + ') \\| (\\d{2}:\\d{2}:\\d{2}\\.\\d{3}) \\> (.+)');
    }

    reset() {

        clearTimeout(this._watchdogTimer);

        this.cmd = null;
        this._cmdResponseParser.reset();
        this._cmdState = CmdStates.NO_CMD;
    }

    parseLine(line) {

        clearTimeout(this._watchdogTimer);

        //trim off whitespace
        line = line.trim();

        //don't do anything if line is empty
        if (!line.length) {
            return;
        }

        let match;

        switch (this._cmdState) {

            case CmdStates.NO_CMD :

                //look for command prompt
                match = line.match(/^# ([a-z-]+.*)$/i);

                if (match){

                    this.cmd = {
                        command: match[1]
                    };

                    this._cmdState = CmdStates.CMD_HEADER;

                    this._watchdogTimer = setTimeout(this._onCmdTimeout, 1000);
                }
                else {

                    this._parseNonCmdResponseLine(line);
                }

                break;

            case CmdStates.CMD_HEADER :

                //look for error or success header
                if (line.match(/^[-|~]{64,}$/)){

                    this._cmdResponseParser.reset();
                    this._cmdState = CmdStates.CMD_RESPONSE;
                }
                else {

                    this._triggerCmdError('Expected command header.');
                }

                break;

            case CmdStates.CMD_OUTPUT :

                this._watchdogTimer = setTimeout(this._onCmdTimeout, 1000);

                //look for output header
                if (line[0] == '+' && line.match(/^[\+]{64,}$/)){

                    this._cmdState = CmdStates.CMD_RESPONSE;
                }
                //this must be output
                else {

                    this.cmd.output += line;
                }

                break;

            case CmdStates.CMD_RESPONSE :

                //look for output header
                if (line[0] == '+' && line.match(/^[\+]{64,}$/)){

                    this.cmd.output = '';
                    this._cmdState = CmdStates.CMD_OUTPUT;
                }
                //or footer
                else if (match = line.match(/^[-|~]{64,}$/)){

                    this.cmd.response = this._cmdResponseParser.getResponse();
                    this.cmd.error = match[0][0] === '~';
                    this.emit('commandResponse', this.cmd);
                    this._cmdState = CmdStates.NO_CMD;
                }
                //neither, so this is normal command response
                else {

                    this._watchdogTimer = setTimeout(this._onCmdTimeout, 1000);

                    try {

                        this._cmdResponseParser.parseLine(line);
                    }
                    catch(error) {

                        this._triggerCmdError('Invalid command response.')
                    }
                }

                break;
        }
    }

    _triggerCmdError = (message) => {

        this.cmd.error = true;
        this.cmd.response = {
            error: -64,
            message
        };

        this.emit('commandResponse', this.cmd);

        this.reset();
    };

    _onCmdTimeout = () => {

        this._triggerCmdError('Command timed out.');
    };

    _parseNonCmdResponseLine = (line) => {

        if (line.charAt(0) == '<'){

            const logParts = line.match(this._regexLog);

            if (logParts && logParts.length == 4){

                const logDate = moment(logParts[2], "HH:mm:ss.SSS", true).toDate();

                this.emit('log', LogNamesToTypes[logParts[1].toUpperCase()], logParts[3], logDate);
                
                return;
            }
        }
        else if (line.slice(0, 6) == 'event-'){

            const eventParts = line.match(/^event-(\d{1,2}): (\d+) \[(\S*)\]$/i);

            if (eventParts && eventParts.length == 4) {

                const eventId = +eventParts[1];

                if (!isNaN(eventId) && eventId < 32) {

                    this.emit('auroraEvent', {

                        eventId,
                        event: eventParts[3],
                        flags: +eventParts[2],
                        time: Date.now()
                    });

                    return;
                }
            }
        }
        else {

            const dataParts = line.match(/^(\S*)-(\d{1,2}): ([\d\s,]+)$/i);

            if (dataParts && dataParts.length == 4) {

                const streamId = +dataParts[2];

                if (!isNaN(streamId) && streamId < 32) {

                    this.emit('streamData', {

                        streamId,
                        stream: dataParts[1],
                        data: dataParts[3].split(',').map(Number),
                        time: Date.now()
                    });

                    return;

                }
            }
        }

        this.emit('unknownResponse', line);
    };

}