import SerialPort from 'serialport';
import usbDetect from 'usb-detection';
import AuroraCmd from './AuroraCmd';
import AuroraCmdReadFile from './AuroraCmdReadFile';
import AuroraCmdCopyFile from './AuroraCmdCopyFile';
import AuroraCmdDeleteDir from './AuroraCmdDeleteDir';
import AuroraCmdDeleteFile from './AuroraCmdDeleteFile';
import AuroraCmdDownloadFile from './AuroraCmdDownloadFile';
import AuroraCmdFlash from './AuroraCmdFlash';
import AuroraCmdGetProfiles from './AuroraCmdGetProfiles';
import AuroraCmdOsInfo from './AuroraCmdOsInfo';
import AuroraCmdReadDir from './AuroraCmdReadDir';
import AuroraCmdSessionInfo from './AuroraCmdSessionInfo';
import AuroraCmdSyncTime from './AuroraCmdSyncTime';
import AuroraCmdSdFormat from './AuroraCmdSdFormat';
import AuroraCmdWriteFile from './AuroraCmdWriteFile';
import AuroraCmdUnloadProfile from './AuroraCmdUnloadProfile';
import AuroraCmdEnableEventOutput from './AuroraCmdEnableEventOutput';
import AuroraCmdDisableEventOutput from './AuroraCmdDisableEventOutput';
import AuroraCmdLedSet from './AuroraCmdLedSet';
import AuroraCmdLedBlink from './AuroraCmdLedBlink';
import AuroraCmdLedAlternate from './AuroraCmdLedAlternate';
import AuroraCmdLedTransition from './AuroraCmdLedTransition';
import AuroraConstants from './AuroraConstants';
import AuroraResponseSerialParser from './AuroraResponseSerialParser';
import EventEmitter from 'events';
import fs from 'fs';
import _ from 'lodash';


class Aurora extends EventEmitter {

    static defaultOptions = {

        serialPort: 'auto',
        serialOptions: {

            baudrate: 38400,
            autoOpen: false
        },
        enableLogging: false,
        logFilePath: 'aurora-serial.log',
        connectTimeout: 10000
    };

    constructor(options) {

        super();

        this.options = _.defaultsDeep(options, Aurora.defaultOptions);

        this._processingQueue = [];
        this.usbConnected = false;
        this.usbConnecting = false;
        this.cmdCurrent = false;
        this.firmwareInfo = undefined;

        this._responsePacketRetries = 0;

        this.serialLogStream = this.options.enableLogging ? fs.createWriteStream(this.options.logFilePath) : null;

        this.on('serialDisconnect', this._onSerialDisconnect);

        AuroraResponseSerialParser.on('packetSuccess', this._onPacketSuccess);
        AuroraResponseSerialParser.on('packetError', this._onPacketError);
        AuroraResponseSerialParser.on('commandEnd', this._onCommandEnd);
        AuroraResponseSerialParser.on('responseSuccess', this._onResponseSuccess);
        AuroraResponseSerialParser.on('responseError', this._onResponseError);
        AuroraResponseSerialParser.on('responseEvent', (eventId, eventFlags) => this.emit('event', eventId, eventFlags));
        AuroraResponseSerialParser.on('responseLog', (type, message, date) => this.emit('log', type, message, date));
        AuroraResponseSerialParser.on('responseData', (type, data) => this.emit('data', type, data));
        

        usbDetect.on('add:' + parseInt(AuroraConstants.AURORA_USB_VID), (device) => this.emit('usbConnect', device));
        usbDetect.on('remove:' + parseInt(AuroraConstants.AURORA_USB_VID), (device) => this.emit('usbDisconnect', device));
    }

    setOptions(options) {

        //if log status is changing, we need to close the stream if it exists
        if (options.enableLogging != this.options.enableLogging ||
            options.logFilePath != this.options.logFilePath){

            if (options.serialLogStream) this.serialLogStream.end();

            this.serialLogStream = options.enableLogging ? fs.createWriteStream(options.logFilePath || this.options.logFilePath) : null;
        }

        this.options = _.defaultsDeep(this.options, options);
    }

    isUsbConnected() {

        return this.usbConnected;
    }

    //TODO: this code will be refactored to not create a new SerialPort instance with
    //each connection attempt once the node-serialport package has successfully implemented
    //updateBaudRate on all platforms and fixes the usbConnect/disconnect event bugs
    usbConnect() {

        if (this.usbConnecting) {
            return Promise.reject('Already connecting...');
        }

        if (this.usbConnected) {
            return Promise.reject('Already connected.');
        }

        this.usbConnecting = true;

        return new Promise((resolve, reject) => {

            this.connectTimer = setTimeout(() => {

                this.usbConnecting = false;
                
                reject('Timeout while trying to connect to Aurora.');

            }, this.options.connectTimeout);

            let tryConnect = (serialPorts) => {

                let serialPort = serialPorts.pop();

                this._serial = new SerialPort(serialPort, this.options.serialOptions);

                this._serial.once('close', () => {

                    console.log('serialDisconnect', 'expected');
                    this.emit('serialDisconnect');
                });

                this._serial.once('disconnect', (e) => {

                    console.log('serialDisconnect', e);
                    this.emit('serialDisconnect', e);
                });

                this._serial.once('error', (e) => {

                    this.emit('serialDisconnect', e);
                    this.emit('error', e);
                });

                this._serial.open(error => {
                    
                    const handleError = (error) => {

                        this._serial.removeAllListeners();

                        if (!serialPorts.length) {

                            this.usbConnecting = false;

                            clearTimeout(this.connectTimer);

                            return reject('Device not found. (' + this.options.serialPort + ')');
                        }
                        else {
                            return tryConnect(serialPorts);
                        }
                    };

                    if (error) {

                        return handleError(error);
                    }

                    //make sure there aren't any dangling
                    //characters on the command line
                    this.write(_.repeat("\b", 64));

                    this._serial.flush(() => {
                        
                        AuroraResponseSerialParser.reset();

                        this._processingQueue = [];

                        this._serial.addListener('data', this._processResponse.bind(this));

                        this.execCmd(new AuroraCmdOsInfo()).then(firmwareInfo => {

                            clearTimeout(this.connectTimer);

                            this.firmwareInfo = firmwareInfo;

                            this.usbConnecting = false;
                            this.usbConnected = true;

                            this.emit('serialConnect');

                            resolve(firmwareInfo);

                        }).catch((error) => {

                            this._serial.close();

                            handleError(error);

                        });


                        this._processQueue();

                    });

                });

            };

            if (this.options.serialPort == 'auto') {

                SerialPort.list( (error, ports) => {

                    if (error) {

                        return reject(error);
                    }
                    
                    let serialPorts = [];
                    
                    ports.forEach(function (port) {

                        //TODO: remove these extra conditions when old beta
                        //units are no longer in circulation
                        if ((port.pnpId && port.pnpId.indexOf('5740') !== -1) ||
                            (port.pnpId && port.pnpId.indexOf('0483') !== -1) ||
                            (port.productId && port.productId.indexOf('5740') !== -1) ||
                            (port.vendorId && port.vendorId.indexOf(AuroraConstants.AURORA_USB_VID) !== -1) ||
                            port.manufacturer == "iWinks") {
                                serialPorts.push(port.comName.replace('cu.','tty.'));
                        }
                    });

                    if (!serialPorts.length) {
                        this.usbConnecting = false;

                        return reject('No Aurora devices found connected to computer.');
                    }

                    tryConnect(serialPorts);

                });
            }
            else {
                tryConnect([this.options.serialPort]);
            }

        });

    }

    disconnect() {

        this._serial.close();
    }

    write(data) {

        if (this.usbConnected){

            this._serial.write(data);
        }
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

    _processQueue() {

        this.cmdCurrent = this._processingQueue.shift();

        if (!this.cmdCurrent) {
            return;
        }

        this.cmdCurrent.exec();

        console.log('Executing: ' + this.cmdCurrent.toString());
    }


    _processResponse(responseChunk) {

        if (!responseChunk.length) {

            return;
        }

        if (this.serialLogStream) this.serialLogStream.write(responseChunk);

        if (this.cmdCurrent) {

            this.cmdCurrent.petWatchdog();
        }

        AuroraResponseSerialParser.parseChunk(responseChunk);
    }

    _onPacketSuccess = (response) => {

        this.cmdCurrent.respSuccessStreamFront.write(response);
        this._responsePacketRetries = 0;
        this.write(new Buffer([AuroraConstants.AURORA_PACKET_OK_BYTE]));
    };

    _onPacketError = (error) => {

        this._responsePacketRetries++;

        //if we have retried too many times, don't send the error byte
        //which will cause the firmware side to timeout and end the response
        if (this._responsePacketRetries > AuroraConstants.AURORA_PACKET_MAX_RETRIES) {

            console.log('Reached max packet retry attempts.');
            
            this._responsePacketRetries = 0;

            //TODO, trigger some kind of error so command knows it doesn't have the whole response
            
            return;
        }

        setTimeout(() => {

            this._serial.flush(() => {

                this.write(new Buffer([AuroraConstants.AURORA_PACKET_ERROR_BYTE]));
            });

        }, 1000);
    };
    
    _onResponseSuccess = (response) => {
        
        this.cmdCurrent.respSuccessStreamFront.write(response);
    };
    
    _onResponseError = (response) => {

        this.cmdCurrent.respErrorStreamFront.write(response);
    };

    _onCommandEnd = (error) => {

        if (error) {

            this.cmdCurrent.respErrorStreamFront.end();
        }
        else {
            this.cmdCurrent.respSuccessStreamFront.end();
        }
    };
}

const AuroraCommands = {

    'copyFile'          : AuroraCmdCopyFile,
    'readFile'          : AuroraCmdReadFile,
    'deleteDir'         : AuroraCmdDeleteDir,
    'deleteFile'        : AuroraCmdDeleteFile,
    'downloadFile'      : AuroraCmdDownloadFile,
    'flash'             : AuroraCmdFlash,
    'getProfiles'       : AuroraCmdGetProfiles,
    'osInfo'            : AuroraCmdOsInfo,
    'readDir'           : AuroraCmdReadDir,
    'sessionInfo'       : AuroraCmdSessionInfo,
    'syncTime'          : AuroraCmdSyncTime,
    'sdFormat'          : AuroraCmdSdFormat,
    'writeFile'         : AuroraCmdWriteFile,
    'unloadProfile'     : AuroraCmdUnloadProfile,
    'enableEventOutput' : AuroraCmdEnableEventOutput,
    'disableEventOutput': AuroraCmdDisableEventOutput,
    'ledSet'            : AuroraCmdLedSet,
    'ledBlink'          : AuroraCmdLedBlink,
    'ledAlternate'      : AuroraCmdLedAlternate,
    'ledTransition'     : AuroraCmdLedTransition
};


//TODO: when ES7 decorators become stable convert into a real decorator
let decorateWithCommands = function(auroraClass){

    for (let cmdName in AuroraCommands){

        auroraClass[cmdName] = function() {

            let args = Array.from(arguments);
            args.unshift(null);

            let cmdInstance = new (Function.prototype.bind.apply(AuroraCommands[cmdName], args));

            return auroraClass.execCmd(cmdInstance);
        }
    }
    
    return auroraClass;
}

export default decorateWithCommands(new Aurora());

const AuroraEvents = AuroraConstants.Events;
const AuroraEventOutputs = AuroraConstants.EventOutputs;
const AuroraLogTypes = AuroraConstants.LogTypes;
const AuroraStreams = AuroraConstants.Streams;
const AuroraStreamOutputs = AuroraConstants.StreamOutputs;
const AuroraSleepStages = AuroraConstants.SleepStages;

export {
    Aurora, AuroraCmd, AuroraCmdCopyFile, AuroraCmdReadDir, AuroraCmdReadFile,
    AuroraCmdDeleteDir, AuroraCmdDeleteFile, AuroraCmdDownloadFile,
    AuroraCmdFlash, AuroraCmdGetProfiles, AuroraCmdOsInfo, AuroraCmdSdFormat,
    AuroraCmdSessionInfo, AuroraCmdSyncTime, AuroraCmdWriteFile, AuroraCmdUnloadProfile,
    AuroraCmdEnableEventOutput, AuroraCmdDisableEventOutput, AuroraCmdLedSet,
    AuroraCmdLedBlink, AuroraCmdLedAlternate, AuroraCmdLedTransition,
    AuroraEvents, AuroraEventOutputs, AuroraLogTypes, AuroraStreams, AuroraStreamOutputs,
    AuroraSleepStages
};

export AuroraCmdTransformBinary from './AuroraCmdTransformBinary';
export AuroraCmdTransformLines from './AuroraCmdTransformLines';
export AuroraCmdTransformObject from './AuroraCmdTransformObject';


