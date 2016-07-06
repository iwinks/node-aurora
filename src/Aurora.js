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
import AuroraCmdUnloadProfile from './AuroraCmdUnloadProfile';
import AuroraConstants from "./AuroraConstants";
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

        this._responsePacketRetries = 0;
        this._responseUnparsedBuffer = null;
        this._responsePayloadLength = 0;
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

                    this.emit('serialDisconnect', e);
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
                    this.write(_.repeat("\b", 64));

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

        this._serial.removeAllListeners();

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

        if (!responseChunk.length) {

            console.log('No data in response');
            return;
        }

        if (this.serialLogStream) this.serialLogStream.write(responseChunk);

        if (this.cmdCurrent) {

            this.cmdCurrent.petWatchdog();
        }
        else if (this._responseState != AuroraConstants.ResponseStates.NO_COMMAND) {
            console.log('No command for this response...');
            return;
        }

        //pick up where we left off
        this._responseUnparsedBuffer = Buffer.isBuffer(this._responseUnparsedBuffer) ? Buffer.concat([this._responseUnparsedBuffer, responseChunk]) : responseChunk;

        while (this._responseUnparsedBuffer && this._responseUnparsedBuffer.length) {

            //if we aren't in the middle of processing a response
            if (this._responseState != AuroraConstants.ResponseStates.COMMAND_RESPONSE){

                //look for first newline
                const newlineIndex = this._responseUnparsedBuffer.indexOf('\n');

                //no newline, so wait for the next chunk
                if (newlineIndex == -1) {

                    return;
                }

                //we must have a newline now so grab the line
                const bufferLine = this._responseUnparsedBuffer.slice(0, newlineIndex).toString().trim();

                //and remove it from the unparsed buffer
                this._responseUnparsedBuffer = this._responseUnparsedBuffer.slice(newlineIndex+1);

                //is the line a command prompt?
                if (bufferLine.indexOf(AuroraConstants.COMMAND_PROMPT) === 0) {

                    this._responseState = AuroraConstants.ResponseStates.COMMAND_HEADER;
                }
                //is the line an success header?
                else if (bufferLine.indexOf(AuroraConstants.COMMAND_DIVIDER_SUCCESS_STRING) === 0) {

                    this._responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE;
                }
                //is the line an error header?
                else if (bufferLine.indexOf(AuroraConstants.COMMAND_DIVIDER_ERROR_STRING) === 0) {

                    this._responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE;
                    this.cmdCurrent.error = true;
                }
                //must be log / data response
                else {

                    //TODO: generate log and data events
                    console.log('Non command response', bufferLine.toString());
                }
            }
            else {

                //check for packet mode on this command
                if (this.cmdCurrent.options.packetMode){

                    if (this._processResponseFooter()) {

                        continue;
                    }

                    if (!this._processResponsePacket()){

                        return;
                    }
                }
                //we are not in packet mode, so just try and process the footer
                //buffering the response if it's not found
                else if (!this._processResponseFooter()){

                    return;
                }
            }
        }
    }

    _processResponsePacket() {

        //have we received the header?
        if (!this._responsePayloadLength) {

            //if we don't have enough bytes for the header, wait for more
            if (this._responseUnparsedBuffer.length < 4) {

                return false;
            }

            if (this._responseUnparsedBuffer[0] != AuroraConstants.AURORA_PACKET_SYNC_BYTE || this._responseUnparsedBuffer[1] != AuroraConstants.AURORA_PACKET_SYNC_BYTE){

                console.log('Corrupted header. Requesting resend...');

                this._processResponsePacketError();

                return false;
            }

            this._responsePayloadLength = this._responseUnparsedBuffer.readUInt16LE(2);

            //success, so remove it from the unparsed buffer
            this._responseUnparsedBuffer = this._responseUnparsedBuffer.slice(4);
        }

        //at this point we have read the header
        //so make sure we have the entire payload
        //and the checksum before we continue
        if (this._responseUnparsedBuffer.length < (this._responsePayloadLength+4)){

            return false;
        }

        //we now have the entire payload too, so calculate
        //checksum and send the OK if it checks out
        let payloadSum = 0;
        for (let i = 0; i < this._responsePayloadLength; i++){

            payloadSum += this._responseUnparsedBuffer[i];
        }

        const checksum = this._responseUnparsedBuffer.readInt32LE(this._responsePayloadLength);

        if (~payloadSum == checksum){

            const respStream = this.cmdCurrent.error ? this.cmdCurrent.respErrorStreamFront : this.cmdCurrent.respSuccessStreamFront;

            respStream.write(this._responseUnparsedBuffer.slice(0, -4)); //don't include checksum

            this._processResponsePacketSuccess();
        }
        else {

            console.log('Failed checksum. Requesting resend...');
            this._processResponsePacketError();
        }

        return true;
    }

    _processResponsePacketError() {

        this._responsePacketRetries++;

        this._responsePayloadLength = 0;
        this._responseUnparsedBuffer = null;

        //if we have retried too many times, don't send the error byte
        //which will cause the firmware side to timeout and end the response
        if (this._responsePacketRetries > AuroraConstants.AURORA_PACKET_MAX_RETRIES) {

            console.log('Reached max packet retry attempts.');
            
            this._responsePacketRetries = 0;

            //TODO, trigger some kind of error so command knows it doesn't have the whole response
            
            return;
        }

        this._flushResponse(() => {
            this.write(new Buffer([AuroraConstants.AURORA_PACKET_ERROR_BYTE]));
        });

    }

    _processResponsePacketSuccess() {

        this._responsePacketRetries = 0;
        this._responseUnparsedBuffer = null;
        this._responsePayloadLength = 0;

        this.write(new Buffer([AuroraConstants.AURORA_PACKET_OK_BYTE]));
    }

    _processResponseFooter() {

        let respStream;
        let footerStartIndex;

        if (this.cmdCurrent.error) {

            respStream = this.cmdCurrent.respErrorStreamFront;
            footerStartIndex = this._responseUnparsedBuffer.indexOf('\r\n' + AuroraConstants.COMMAND_DIVIDER_ERROR_STRING);
        } else {

            respStream = this.cmdCurrent.respSuccessStreamFront;
            footerStartIndex = this._responseUnparsedBuffer.indexOf('\r\n' + AuroraConstants.COMMAND_DIVIDER_SUCCESS_STRING);
        }

        if (footerStartIndex == -1) {

            return false;
        }

        //we've seen the start of the footer,
        //but make sure we've also seen the end
        const footerEndIndex = this._responseUnparsedBuffer.indexOf('\r\n', footerStartIndex+2);

        if (footerEndIndex == -1) {

            return false;
        }

        //if we had any data before the footer, write it out now
        //should NOT happen in packet mode...
        if (footerStartIndex !== 0) {

            if (this.cmdCurrent.options.packetMode) {

                console.log('Leftover data before footer in packet mode.');
            }

            respStream.write(this._responseUnparsedBuffer.slice(0, footerStartIndex));
        }

        //remove the entire response and footer from the unparsed buffer
        this._responseUnparsedBuffer = this._responseUnparsedBuffer.slice(footerEndIndex + 2);

        //reset response state
        this._responseState = AuroraConstants.ResponseStates.NO_COMMAND;

        //finally end response stream which signals end of command
        respStream.end();

        return true;
    }

    _flushResponse(onFlushComplete) {

        const currentResponseState = this._responseState;

        this._responseState = AuroraConstants.ResponseStates.FLUSHING_RESPONSE;

        //give the buffer chance to fill up
        //before we flush it
        setTimeout(() => {
    
            this._serial.flush(() => {
        
                this._responseState = currentResponseState;
        
                if (typeof onFlushComplete == 'function'){
            
                    onFlushComplete();
                }
            });
            
        }, 1000);
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
    'writeFile'    : AuroraCmdWriteFile,
    'unloadProfile': AuroraCmdUnloadProfile
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
         AuroraCmdSessionInfo, AuroraCmdSyncTime, AuroraCmdWriteFile, AuroraCmdUnloadProfile };



