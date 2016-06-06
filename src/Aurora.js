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
import EventEmitter from 'events';
import fs from "fs";
import _ from "lodash";


class Aurora extends EventEmitter {

    static defaultOptions = {

        serialPort: 'auto',
        serialOptions: {

            baudrate: 38400,
            bufferSize: 256,
            flowControl: false,
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

        while (this._responseUnparsedBuffer){

            switch (this._responseState){

                //this is the initial state, when no command response is currently being
                //parsed. Response received during this state may be the beginning of a command
                //or log/data messages generated in between commands. That's what makes this so damn tricky...
                case AuroraConstants.ResponseStates.NO_COMMAND:

                    //store the position of the command prompt in the unparsed response
                    let cmdPromptIndex = this._responseUnparsedBuffer.indexOf(AuroraConstants.COMMAND_PROMPT);

                    //if the prompt is not found, check if a portion of the unparsed response
                    //can be safely added to the message buffer
                    if (cmdPromptIndex === -1){

                        //if we don't have enough characters to contain the command prompt, wait for more
                        if (this._responseUnparsedBuffer.length < AuroraConstants.COMMAND_PROMPT.length){

                            //console.log('not enough characters for cmd prompt');
                            return;
                        }

                        //we have enough characters to contain the command prompt so a -1 indicates
                        //at least some of the unparsed string contains message data

                        //store what we know can't contain the command response in the message buffer
                        this._responseMessageBuffer += this._responseUnparsedBuffer.slice(0, 1 - AuroraConstants.COMMAND_PROMPT.length);

                        //and strip out the message data from the unparsed buffer
                        this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(1 - AuroraConstants.COMMAND_PROMPT.length);
                    }
                    //we have found the command prompt, so everything before must be message data
                    else {

                        //add message data to buffer
                        this._responseMessageBuffer += this._responseUnparsedBuffer.slice(0, cmdPromptIndex);

                        //and remove it from unparsed buffer
                        this._responseUnparsedBuffer = this._responseUnparsedBuffer.slice(cmdPromptIndex+AuroraConstants.COMMAND_PROMPT.length);

                        //now we are ready to move to the next state
                        this._responseState = AuroraConstants.ResponseStates.COMMAND_STRING;
                    }

                    break;

                case AuroraConstants.ResponseStates.COMMAND_STRING:

                    //wait until we have a newline in unparsed buffer
                    //since that indicates a completed command string

                    let endOfCommandIndex = this._responseUnparsedBuffer.indexOf('\n');

                    if (endOfCommandIndex !== -1) {

                        let cmdString = this._responseUnparsedBuffer.slice(0, endOfCommandIndex-1);

                        //TODO: check if cmdString corresponds to current command. restart state machine if not...

                        //remove command string and newline from unparsed buffer
                        this._responseUnparsedBuffer = this._responseUnparsedBuffer.slice(endOfCommandIndex+1);

                        //now we are read to move to the next state
                        this._responseState = AuroraConstants.ResponseStates.COMMAND_HEADER;
                    }
                    //do we have too many characters for a command string?
                    else if (this._responseUnparsedBuffer.length > AuroraConstants.COMMAND_STRING_MAX_LENGTH){

                        //assume error and restart state machine
                        //we'll keep the unparsed buffer in tact in case we can recover
                        //console.log('Expected command string.\nUnparsed buffer: ' + this._responseUnparsedBuffer);
                        this._responseState = AuroraConstants.ResponseStates.NO_COMMAND;
                    }
                    else {

                        //console.log('No end of command found, but still within limit.');
                        return;
                    }

                    break;

                case AuroraConstants.ResponseStates.COMMAND_HEADER:

                    //wait until we have a newline in unparsed buffer
                    //since that indicates we have a completed header
                    let endOfHeaderIndex = this._responseUnparsedBuffer.indexOf('\n');

                    if (endOfHeaderIndex !== -1){

                        //make sure we have the minimum required header characters
                        if (endOfHeaderIndex < AuroraConstants.COMMAND_DIVIDER_MIN_LENGTH) {

                            //console.log('Expected longer header.\nUnparsed buffer: ' + this._responseUnparsedBuffer);
                            this._responseState = AuroraConstants.ResponseStates.NO_COMMAND;
                        }
                        //check for success header
                        else if (this._responseUnparsedBuffer.charAt(0) == AuroraConstants.COMMAND_DIVIDER_SUCCESS_CHAR &&
                            this._responseUnparsedBuffer.charAt(endOfHeaderIndex-2) == AuroraConstants.COMMAND_DIVIDER_SUCCESS_CHAR){

                            this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(endOfHeaderIndex+1);
                            this._responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE;
                            this.cmdCurrent.error = false;
                            //console.log("end of header found: " + this._responseUnparsedBuffer);
                        }
                        else if (this._responseUnparsedBuffer.charAt(0) == AuroraConstants.COMMAND_DIVIDER_ERROR_CHAR &&
                            this._responseUnparsedBuffer.charAt(endOfHeaderIndex-2) == AuroraConstants.COMMAND_DIVIDER_ERROR_CHAR){

                            this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(endOfHeaderIndex+1);
                            this._responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE;
                            this.cmdCurrent.error = true;
                        }
                        else {
                            //console.log('Expected header char.\nUnparsed buffer: ' + this._responseUnparsedBuffer);
                            this._responseState = AuroraConstants.ResponseStates.NO_COMMAND;
                        }
                    }
                    else if (this._responseUnparsedBuffer.length > AuroraConstants.COMMAND_DIVIDER_MAX_LENGTH){

                        //console.log('Expected completed header.\nUnparsed buffer: ' + this._responseUnparsedBuffer);
                        this._responseState = AuroraConstants.ResponseStates.NO_COMMAND;
                    }
                    else {

                        //console.log('No end of header found, but still within limit.');
                        return;
                    }

                    break;

                case AuroraConstants.ResponseStates.COMMAND_RESPONSE:

                    let startOfFooterIndex;
                    var cmdResponseStream;

                    if (this.cmdCurrent.error){

                        startOfFooterIndex = this._responseUnparsedBuffer.indexOf('\n' + AuroraConstants.COMMAND_DIVIDER_ERROR_CHAR);
                        cmdResponseStream = this.cmdCurrent.respErrorStreamFront;
                    }
                    else {

                        startOfFooterIndex = this._responseUnparsedBuffer.indexOf('\n' + AuroraConstants.COMMAND_DIVIDER_SUCCESS_CHAR);
                        cmdResponseStream = this.cmdCurrent.respSuccessStreamFront;
                    }

                    //if we don't see the footer, we can safely assume the entire buffer is command response if we have enough chars
                    if (startOfFooterIndex === -1) {

                        //if we don't have enough characters to contain the divider char + newline
                        //we might need to wait for more characters
                        if (this._responseUnparsedBuffer.length < 2){

                            //we don't actually have to wait if we have a non newline character
                            if (this._responseUnparsedBuffer.length && this._responseUnparsedBuffer.charAt(0) != '\n'){

                                //we can safely add this single character to the command response
                                cmdResponseStream.write(this._responseUnparsedBuffer, 'binary');
                                this._responseUnparsedBuffer = '';
                            }
                            else {
                                console.log('not enough characters for footer.');
                                return;
                            }
                        }

                        //we have enough characters to contain the footer start so a -1 indicates
                        //at least some of the unparsed string contains command response

                        //store what we know can't contain the footer in the response
                        cmdResponseStream.write(this._responseUnparsedBuffer.slice(0, -1), 'binary');
                       // console.log('command response: ' + this._responseUnparsedBuffer.slice(0, -1));

                        //and strip out the response data from the unparsed buffer
                        this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(-1);
                    }
                    else {

                        //everything up to the beginning of footer is safe to assume is command response
                        if (startOfFooterIndex >= 2){
                            cmdResponseStream.write(this._responseUnparsedBuffer.slice(0,startOfFooterIndex - 1), 'binary');
                            //console.log('command partial response: ' + this._responseUnparsedBuffer.slice(0,startOfFooterIndex - 1));
                        }

                        this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(startOfFooterIndex);
                        this._responseState = AuroraConstants.ResponseStates.COMMAND_FOOTER;
                    }

                    break;

                case AuroraConstants.ResponseStates.COMMAND_FOOTER:

                    //we know the first char is a newline, so make sure to look for the second
                    //newline with an offset of 1
                    let endOfFooterIndex = this._responseUnparsedBuffer.indexOf('\n', 1);
                    cmdResponseStream = this.cmdCurrent.error ? this.cmdCurrent.respErrorStreamFront : this.cmdCurrent.respSuccessStreamFront;

                    //did we find a second newline?
                    if (endOfFooterIndex !== -1){

                        //make sure we have the minimum required divider characters
                        if (endOfFooterIndex < AuroraConstants.COMMAND_DIVIDER_MIN_LENGTH) {

                            //console.log('Expected longer footer.\nUnparsed buffer: ' + this._responseUnparsedBuffer);

                            //not enough characters between start and end of divider, so everything up to the
                            //second newline must be command response. Stay in this state since we have a second newline already
                            cmdResponseStream.write(this._responseUnparsedBuffer.slice(0, endOfFooterIndex - 1), 'binary');
                            this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(endOfFooterIndex);
                        }
                        //check for success footer
                        else if (this._responseUnparsedBuffer.charAt(1) == AuroraConstants.COMMAND_DIVIDER_SUCCESS_CHAR &&
                            this._responseUnparsedBuffer.charAt(endOfFooterIndex-2) == AuroraConstants.COMMAND_DIVIDER_SUCCESS_CHAR){

                            this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(endOfFooterIndex+1);

                            this._responseState = AuroraConstants.ResponseStates.NO_COMMAND;

                            //console.log('all done!');
                            cmdResponseStream.end();
                        }
                        else if (this._responseUnparsedBuffer.charAt(1) == AuroraConstants.COMMAND_DIVIDER_ERROR_CHAR &&
                            this._responseUnparsedBuffer.charAt(endOfFooterIndex-2) == AuroraConstants.COMMAND_DIVIDER_ERROR_CHAR){

                            this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(endOfFooterIndex+1);

                            this._responseState = AuroraConstants.ResponseStates.NO_COMMAND;

                            //console.log('all done!');
                            cmdResponseStream.end();
                        }
                        else {
                            //console.log('Expected footer char.\nUnparsed buffer: ' + this._responseUnparsedBuffer);

                            //since we haven't seen a completed footer, we have to assume that everything we have seen so far is command response
                            //including the previous newline so add it to the command response and move back to the command response state.
                            cmdResponseStream.write('\n');
                            this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(1);
                            this._responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE;
                        }
                    }
                    else if (this._responseUnparsedBuffer.length > AuroraConstants.COMMAND_DIVIDER_MAX_LENGTH){

                        //console.log('Expected completed footer.\nUnparsed buffer: ' + this._responseUnparsedBuffer);

                        //since we haven't seen a completed footer, we have to assume that everything we have seen so far is command response
                        //including the previous newline so add it to the command response and move back to the command response state.
                        cmdResponseStream.write('\n');
                        this._responseUnparsedBuffer = this._responseUnparsedBuffer.substr(1);
                        this._responseState = AuroraConstants.ResponseStates.COMMAND_RESPONSE;
                    }
                    else {

                        //console.log('No end of footer found, but still within limit.');
                        return;
                    }

                    break;

            }

        }

        this._processResponseMessageBuffer();
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



