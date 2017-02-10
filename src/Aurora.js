import AuroraConstants from './AuroraConstants';
import AuroraResponseSerialParser from './AuroraSerialParser';
import EventEmitter from 'events';
import _ from 'lodash';

class Aurora extends EventEmitter {

    static defaultOptions = {

        serialPort: 'auto',
        serialOptions: {

            baudrate: 38400,
            autoOpen: false,
            parser: SerialPort.parsers.byteDelimiter(Buffer.from('\r\n','utf8'))
        },
        connectTimeout: 10000
    };

    constructor(options) {

        super();

        this.options = _.defaultsDeep(options, Aurora.defaultOptions);

        this._cmdQueue = [];
        this._cmdCurrent = null;


        this.usbConnected = false;
        this.usbConnecting = false;
        this.cmdCurrent = false;
        this.firmwareInfo = undefined;
    }

    isUsbConnected() {

        return this.usbConnected;
    }

    getFirmwareInfo() {

        return this.firmwareInfo;
    }

    queueCmd(command, origin) {

        this._cmdQueue.push({ command, origin});

        if (!this._cmdCurrent) {

            this._processCmdQueue();
        }
    }

    _processCmdQueue() {

        this._cmdCurrent =

            this._processingQueue.shift();

        if (!this.cmdCurrent) {
            return;
        }

        this.cmdCurrent.exec();

        console.log('Executing: ' + this.cmdCurrent.toString());
    }

    
    execCmd(cmd) {

        if (cmd == undefined) {
            return Promise.reject({'error': -1, 'message': 'Invalid command.'});
        }

        if (!(cmd instanceof AuroraCmd)) {

            let cmdArgs = Array.prototype.slice.call(arguments);
            let cmdName = cmdArgs.shift();

            cmd = new AuroraCmd(cmdName, cmdArgs);
        }

        this._processingQueue.push(cmd);

        //if we aren't already processing
        //the queue, kick things off
        if (this.usbConnected && !this.cmdCurrent) {
            this._processQueue();
        }

        //return a promise that will be fulfilled
        //when the command has finished executing
        return cmd.queue().then( resp => {

            this.emit('commandResponse', false, resp);

            this._processQueue();

            return resp;
            
        }).catch (error => {

            this.emit('commandResponse', true, error);

            this.cmdCurrent = null;

            this._serial.flush(() => {

                AuroraResponseSerialParser.reset();

                if (this.usbConnected){
                    this._processQueue();
                }

            });

            return Promise.reject(error);
        });

    }

    _onSerialDisconnect() {

        this.usbConnected = false;

        if (this.cmdCurrent) {
            this.cmdCurrent.triggerError(-1, "Lost connection to Aurora.");
            this.cmdCurrent = null ;
        }

        this._serial.removeAllListeners();
        this._processingQueue = [];

        for (let i = 0; i < this._processingQueue.length; i++){

            this._processingQueue.shift().triggerError(-1, "Lost connection to Aurora.");
        }
    }

    _onSerialCmdResponse(cmdResponse) {

        cmdResponse.origin = 'serial';

    }



}

const AuroraEvents = AuroraConstants.Events;
const AuroraEventOutputs = AuroraConstants.EventOutputs;
const AuroraLogTypes = AuroraConstants.LogTypes;
const AuroraStreams = AuroraConstants.Streams;
const AuroraStreamOutputs = AuroraConstants.StreamOutputs;
const AuroraSleepStages = AuroraConstants.SleepStages;

export {
    Aurora, AuroraConstants, AuroraEvents, AuroraEventOutputs, AuroraLogTypes, AuroraStreams,
    AuroraStreamOutputs, AuroraSleepStages
};

export default new Aurora();


