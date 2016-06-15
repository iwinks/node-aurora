import SerialPort from "serialport";
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
import AuroraCmdWriteFile from './AuroraCmdWriteFile';
import AuroraConstants from "./AuroraConstants";
import {Parser} from "binary-parser";
import EventEmitter from 'events';
import fs from "fs";
import _ from "lodash";


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

        this._responseUnparsedBuffer = "";
        this._responseMessageBuffer = "";
        this._responseUnparsedLines = [];

        this._responseState = AuroraConstants.ResponseStates.NO_COMMAND;

        this.serialLogStream = this.options.enableLogging ? fs.createWriteStream(this.options.logFilePath) : null;

        this.on('serialDisconnect', this._onSerialDisconnect);

        usbDetect.on('add:' + parseInt(AuroraConstants.AURORA_USB_VID), (device) => { console.log('usb detected', device); this.emit('usbConnect', device);});
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
                console.log('try connect', serialPort);

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
                    console.log('serialError', e);
                    this.emit('error', e);
                });

                this._serial.open(error => {
                    console.log('serial open', error);
                    const handleError = (error) => {
                        console.log('connection error', error);
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
                    this._serial.write(_.repeat("\b", 64));

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

            };

            if (this.options.serialPort == 'auto') {

                SerialPort.list( (error, ports) => {

                    if (error) {
                        console.log('serial error', error);
                        return reject(error);
                    }

                    console.log('ports', ports);

                    let serialPorts = [];

                    //console.log(ports);

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
        console.log(this);
        this._serial.close();
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

            console.log(resp);

            console.timeEnd('command completed');
            this._processQueue();

            return resp;
            
        }).catch (error => {

            console.log(error)

            console.timeEnd('command completed');

            if (this.usbConnected){
                this._processQueue();
            }

            //TODO: understand why I can't just return the error directly here....
            return Promise.reject(error);
        });

    }

    _onSerialDisconnect() {

        this.usbConnected = false;

        if (this.cmdCurrent) {
            this.cmdCurrent.triggerError(-1, "Lost connection to Aurora.");
            this.cmdCurrent = false;
        }

        this._serial.removeListener('data', this._processResponse);

        for (let cmd of this._processingQueue){
            cmd.triggerError(-1, "Lost connection to Aurora.");
        }
    }

    _processQueue() {

        this.cmdCurrent = this._processingQueue.shift();

        if (!this.cmdCurrent) {
            return;
        }

        this.cmdCurrent.exec();

        console.log('Executing: ' + this.cmdCurrent.toString());
        console.time('command completed');
    }


    _processResponse(responseChunk) {

        if (this.serialLogStream) this.serialLogStream.write(responseChunk);

        if (!this.cmdCurrent && this._responseState != AuroraConstants.ResponseStates.NO_COMMAND){
            console.log('No command for this response...');
            return;
        }

        //pick up where we left off
        this._responseUnparsedBuffer += responseChunk.toString('binary');

        while (true) {

            //look for a newline
            const newLineIndex = this._responseUnparsedBuffer.indexOf('\n');

            if (newLineIndex == -1) {
                break;
            }

            //push line into buffer, including the newline delimiter
            this._responseUnparsedLines.push(this._responseUnparsedBuffer.slice(0, newLineIndex+1));

            //and remove the line from the unparsed buffer
            this._responseUnparsedBuffer = this._responseUnparsedBuffer.slice(newLineIndex+1);
        }

        while (this._responseUnparsedLines.length) {

            let bufferLine = this._responseUnparsedLines.shift();

            if (this._responseState == AuroraConstants.ResponseStates.COMMAND_RESPONSE) {

                const respStream = this.cmdCurrent.error ? this.cmdCurrent.respErrorStreamFront
                                                         : this.cmdCurrent.respSuccessStreamFront;

                if (bufferLine.indexOf('----------------------') === 0 || bufferLine.indexOf('~~~~~~~~~~~~~~~~~~~~~~~~') === 0) {

                    console.log('success/error footer', bufferLine.toString());
                    this._responseState = AuroraConstants.ResponseStates.NO_COMMAND;
                    respStream.end();
                }
                else {

                    respStream.write(bufferLine, 'binary');
                }
            }
            else {

                if (bufferLine.indexOf('# ') === 0) {

                    console.log('command', bufferLine.toString());
                    this._responseState = AuroraConstants.ResponseStates.COMMAND_HEADER;
                }
                else if (bufferLine.indexOf('----------------------') === 0) {

                    console.log('success header', bufferLine.toString());
                    this._responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE;
                }
                else if (bufferLine.indexOf('~~~~~~~~~~~~~~~~~~~~~~') === 0) {

                    console.log('error header', bufferLine.toString());
                    this._responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE;
                    this.cmdCurrent.error = true;
                }
                else {
                    console.log('Non command response', bufferLine.toString());
                }
            }
        }
    }


    _processResponseMessageBuffer() {

        this._responseMessageBuffer = this._responseMessageBuffer.trim();

        if (!this._responseMessageBuffer){
            return;
        }

        let messages = this._responseMessageBuffer.split('\n');

        //console.log(messages);

        this._responseMessageBuffer = messages.pop();
    }

}

const AuroraCommands = {

    'copyFile'     : AuroraCmdCopyFile,
    'readFile'     : AuroraCmdReadFile,
    'deleteDir'    : AuroraCmdDeleteDir,
    'deleteFile'   : AuroraCmdDeleteFile,
    'downloadFile' : AuroraCmdDownloadFile,
    'flash'        : AuroraCmdFlash,
    'getProfiles'  : AuroraCmdGetProfiles,
    'osInfo'       : AuroraCmdOsInfo,
    'readDir'      : AuroraCmdReadDir,
    'sessionInfo'  : AuroraCmdSessionInfo,
    'syncTime'     : AuroraCmdSyncTime,
    'writeFile'    : AuroraCmdWriteFile
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

export { Aurora, AuroraCmd, AuroraCmdCopyFile, AuroraCmdReadDir, AuroraCmdReadFile,
         AuroraCmdDeleteDir, AuroraCmdDeleteFile, AuroraCmdDownloadFile,
         AuroraCmdFlash, AuroraCmdGetProfiles, AuroraCmdOsInfo, AuroraCmdReadDir,
         AuroraCmdSessionInfo, AuroraCmdSyncTime, AuroraCmdWriteFile };



