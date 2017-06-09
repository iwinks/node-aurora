import AuroraUsb from './AuroraUsb';
import AuroraBluetooth from './AuroraBluetooth';
import DriveList from 'drivelist';
import ejectMedia from 'eject-media';
import AuroraConstants from './AuroraConstants';
import EventEmitter from 'events';
import Stream from 'stream';
import {sleep, promisify, versionToString, stringToVersion} from './util';
import usbDetect from 'usb-detection';

const MSD_DISCONNECT_RETRY_DELAY_MS = 2000;
const MSD_SCAN_RETRY_DELAY_MS = 2000;
const MSD_CONNECT_DELAY_SEC = 30;

class Aurora extends EventEmitter {

    constructor() {

        super();

        this._auroraUsb = new AuroraUsb();
        this._auroraUsb.on('connectionStateChange', this._onUsbConnectionStateChange);
        this._auroraUsb.on('usbError', this._onAuroraError);
        this._auroraUsb.on('log', this._onAuroraLog);
        this._auroraUsb.on('streamData', this._onAuroraStreamData);
        this._auroraUsb.on('auroraEvent', this._onAuroraEvent);
        this._auroraUsb.on('cmdInputRequested',this._onCmdInputRequested);
        this._auroraUsb.on('cmdOutputReady', this._onCmdOutputReady);

        this._auroraBluetooth = new AuroraBluetooth();
        this._auroraBluetooth.on('connectionStateChange', this._onBluetoothConnectionStateChange);
        this._auroraBluetooth.on('bluetoothError', this._onAuroraError);
        this._auroraBluetooth.on('streamData', this._onAuroraStreamData);
        this._auroraBluetooth.on('auroraEvent', this._onAuroraEvent);
        this._auroraBluetooth.on('cmdInputRequested',this._onCmdInputRequested);
        this._auroraBluetooth.on('cmdOutputReady', this._onCmdOutputReady);

        this._cmdQueue = [];

        this._msdDrive = false;
        this._isFlashing = false;
        this._info = {};

        //this scans for MSD disks that could potentially be the Aurora
        this._findMsdDrive().then(this._msdSetAttached, true);

        this._watchUsb();
    }

    isConnected() {

        return this.isUsbConnected() || this.isBluetoothConnected();
    }

    isUsbConnected() {

        return this._auroraUsb.isConnected();
    }

    isBluetoothConnected() {

        return this._auroraBluetooth.isConnected();
    }

    isMsdAttached(){

        return !!this._msdDrive;
    }

    connect() {

        this._autoConnectUsb = true;
        this._autoConnectBluetooth = true;

        if (!this._auroraUsb.isConnected() && !this._auroraUsb.isConnecting()){

            this._auroraUsb.connect().catch(() => {});
        }

        if (!this._auroraBluetooth.isConnected() && !this._auroraBluetooth.isConnecting()){

            this._auroraBluetooth.connect(0).catch(() => {});
        }
    }

    disconnect() {

        this._autoConnectUsb = false;
        this._autoConnectBluetooth = false;

        if (this._auroraUsb.isConnected()){

            this.disconnectUsb();
        }

        if (this._auroraBluetooth.isConnected()){

            this.disconnectBluetooth();
        }
    }

    async connectUsb(port = 'detect', retryCount = 3) {

        if (this._auroraUsb.isConnected()){

            return Promise.reject('Already connected over usb.');
        }
        else if (this._auroraUsb.isConnecting()){

            return Promise.reject('Already connecting over usb.');
        }

        return new Promise((resolve, reject) => {

            this.once('usbConnectionChange', (fwInfo) => {

                if (!fwInfo) return reject();

                resolve(fwInfo);

            });

            this.detachMsd().then(() => this._auroraUsb.connect(port, retryCount)).catch(reject);

        });
    }

    async disconnectUsb() {

        if (!this._auroraUsb.isConnected() && !this._auroraUsb.isConnecting()){

            return;
        }

        return this._auroraUsb.disconnect();
    }

    async connectBluetooth(timeoutMs = 20000) {

        if (this._auroraBluetooth.isConnected()){

            return Promise.reject('Already connected over bluetooth.');
        }

        //is USB is already connected, lets signal to
        //the Aurora to start advertising aggressively
        if (this.isUsbConnected()){

            this.queueCmd('ble-reset', 'usb');
        }

        if (this._auroraBluetooth.isConnecting()){

            return Promise.reject('Already connecting over bluetooth.');
        }

        return new Promise((resolve, reject) => {

            this.once('bluetoothConnectionChange', (fwInfo) => {

                if (!fwInfo) return reject();

                resolve(fwInfo);

            });

            this._auroraBluetooth.connect(timeoutMs).catch(reject);

        });
    }

    async disconnectBluetooth(){

        if (!this._auroraBluetooth.isConnected() && !this._auroraBluetooth.isConnecting()){

            return;
        }

        return this._auroraBluetooth.disconnect();
    }

    async attachMsd() {

        if (!this.isConnected()){
            return Promise.reject('Must have a connection first.');
        }

        if (this.isMsdAttached()) {

            return Promise.reject('MSD mode already attached.');
        }
        else if (this._msdAttaching) {

            return Promise.reject('Already attaching MSD.');
        }

        this._msdAttaching = true;

        try {

            await this.queueCmd('usb-mode 2');
        }
        catch (error) {

            this._msdAttaching = false;

            return Promise.reject('Failed enabling MSD mode: ' + error);
        }

        //sleep one second at a time, checking
        //for a connection
        for (let i = 0; i < MSD_CONNECT_DELAY_SEC; i++) {

            await sleep(1000);

            //if we are connected we can return!!
            if (this._msdDrive) return this._msdDrive;
        }

        this._msdAttaching = false;

        return Promise.reject('Timeout waiting for Aurora MSD drive to mount.');
    }

    async detachMsd(retryCount = 5) {

        if (!this._msdDrive) {

            return;
        }

        //we do this just in case things are moving too fast...
        await sleep(1500);

        if (!this._msdDrive) {

            return;
        }

        return promisify(ejectMedia.eject, ejectMedia)(this._msdDrive).then(() => {

            //we go ahead and mark the drive as removed in case
            //the event hasn't fired yet.
            this._msdSetDetached();

        }).catch(async () => {

            if (retryCount) {

                await sleep(MSD_DISCONNECT_RETRY_DELAY_MS);

                if (!this._msdDrive) {

                    this._msdSetDetached();

                    return Promise.resolve();
                }

                return this.detachMsd(retryCount-1);
            }

            //check if drive is not actually present
            //in case we missed the disconnect event somehow
            return this._findMsdDrive().then(msdDrive => {

                if (msdDrive) return Promise.reject('Failed disconnecting from MSD');

                this._msdSetDetached();

                return Promise.resolve();
            })

        });
    }

    async flash(fwFile, fwVersion = false, fwType = 'app') {

        if (this._isFlashing) return Promise.reject('Already flashing.');

        if (!this.isConnected()) return Promise.reject('Must be connected to perform flash.');

        //remember whether auto connect was on before flash
        //since we are going to secretly turn auto connect on now
        const wasUsbAutoConnectOff = !this._autoConnectUsb;
        const wasBluetoothAutoConnectOff = !this._autoConnectBluetooth;
        const wasUsbConnected = this.isUsbConnected();
        const wasBluetoothConnected = this.isBluetoothConnected();

        if (this.isUsbConnected()){

            this._autoConnectUsb = true;
        }

        if (this.isBluetoothConnected()){

            this._autoConnectBluetooth = true;
        }

        let flashCmd = fwType == 'bootloader' || fwType == 'bootloader-and-bootstrap' ? 'os-flash-bootloader' : (fwType == 'ble' ? 'ble-flash' : 'os-flash');

        if (this._info.version >= 20100) {
            flashCmd += ` ${fwFile} /`;

            if (fwType == 'bootloader-and-bootstrap') {

                flashCmd += ' 1';
            }
        }

        return this.queueCmd(flashCmd).then(() => {

            this._isFlashing = true;

            return new Promise((resolve, reject) => {

                let onFlashConnectionChange;
                let flashTimeout;

                const finish = () => {

                    if (wasUsbAutoConnectOff && this._autoConnectUsb){

                        this._autoConnectUsb = false;
                    }

                    if (wasBluetoothAutoConnectOff && this._autoConnectBluetooth){

                        this._autoConnectBluetooth = false;
                    }

                    this._isFlashing = false;

                    clearTimeout(flashTimeout);

                    this.removeListener('flashConnectionChange', onFlashConnectionChange);

                    if (wasUsbConnected && !this.isUsbConnected()){

                        this.emit('usbConnectionChange', false);
                    }

                    if (wasBluetoothConnected && !this.isBluetoothConnected()){

                        setTimeout(() => {

                            if (!this.isBluetoothConnected()) {

                                this.emit('bluetoothConnectionChange', false);
                            }

                        }, 3000);
                    }

                };

                onFlashConnectionChange = (fwInfo) => {

                    if (fwInfo) {

                        finish();

                        const version = fwType == 'bootloader' || fwType == 'bootloader-and-bootstrap' ? fwInfo.bootloaderVersion : (fwType == 'ble' ? fwInfo.bleVersion : fwInfo.version);

                        if (!fwVersion || version === fwVersion){

                            resolve(fwInfo);
                        }
                        else {

                            reject(`Flash failed. Expected ${type} version ${versionToString(fwVersion)} but have ${versionToString(version)}.`);
                        }
                    }
                };

                this.on('flashConnectionChange', onFlashConnectionChange);

                flashTimeout = setTimeout(() => {

                    finish();
                    reject('Unable to verify flash. Timeout waiting for reconnection.');

                }, 50000);

            });

        });

    }

    async queueCmd(commandStr, connectorType = 'any', onCmdBegin = null, onCmdEnd = null) {

        if (!this._getConnector(connectorType).isConnected()){

            return Promise.reject(`Not connected to Aurora over ${connectorType == 'any' ? 'usb or bluetooth' : connectorType}.`);
        }

        return new Promise((resolve, reject) => {

            this._cmdQueue.push({

                commandStr,
                connectorType,
                onCmdBegin,
                onCmdEnd,
                resolve,
                reject

            });

            if (!this._cmdCurrent) {

                this._processCmdQueue();
            }

        });
    }

    //this command is really only useful to reconcile differences between
    //the old version of os-info and new ones
    //TODO: remove once all in-field units are upgraded to firmware >= 2.1.0
    async _getOsInfo(connectorType) {

        return this.queueCmd('os-info 1', connectorType).catch((cmdWithResponse) => {

            //if the "too many arguments" error, then we'll reissue the command without params
            if (cmdWithResponse.response.error === 3) {

                return this.queueCmd('os-info', connectorType);
            }

            return Promise.reject(cmdWithResponse);

        }).then((cmdWithResponse) => {

           if (cmdWithResponse.response.error === 3) {

               return this.queueCmd('os-info', connectorType);
           }

           return cmdWithResponse;

        }).then((cmdWithResponse) => {

            if (typeof cmdWithResponse.response.version == 'string') {

                cmdWithResponse.response.version = stringToVersion(cmdWithResponse.response.version);
            }

            this._info = cmdWithResponse.response;

            return cmdWithResponse;
        });
    }

    _processCmdQueue() {

        this._cmdCurrent = this._cmdQueue.shift();

        if (!this._cmdCurrent) {
            return;
        }

        this._cmdCurrent.connector = this._getConnector(this._cmdCurrent.connectorType);

        if (!this._cmdCurrent.connector.isConnected()){

            this._cmdCurrent.reject(`No longer connected to Aurora over ${this._cmdCurrent.connectorType == 'any' ? 'usb or bluetooth' : this._cmdCurrent.connectorType}.`);
            return;
        }

        const [command, ...args] = this._cmdCurrent.commandStr.split(' ');

        this._cmdCurrent.inputStream = new Stream.Writable();
        this._cmdCurrent.inputStream._write = (data, encoding, done) => {
            this._cmdCurrent.connector.writeCmdInput(data).then(() => done());
        };

        this._cmdCurrent.outputStream = new Stream.Readable();
        this._cmdCurrent.outputStream._read = () => {};

        const cmd = {
            command,
            args,
            connectorType: this._cmdCurrent.connectorType,
            outputStream: this._cmdCurrent.outputStream,
            beginTime: Date.now(),
        };

        this.emit('cmdBegin', cmd);

        if (this._cmdCurrent.onCmdBegin){
            this._cmdCurrent.onCmdBegin(cmd);
        }

        this._cmdCurrent.connector.writeCmd(this._cmdCurrent.commandStr)
            .then(cmdWithResponse => {

                cmd.endTime = Date.now();
                cmd.origin = cmdWithResponse.origin;
                cmd.error = cmdWithResponse.error;
                cmd.response = cmdWithResponse.response;

                return cmd;
            })
            .catch((error) => {

                cmd.origin = this._cmdCurrent.connectorType == 'any' ? 'unknown' : this._cmdCurrent.connectorType;
                cmd.error = true;
                cmd.response = {error: -99, message: `Fatal error: ${error}`};
                this._cmdQueue = [];

                return cmd;

            })
            .then((cmd) => {

                cmd.outputStream.push(null);

                if (cmd.error){
                    this._cmdCurrent.reject(cmd);
                }
                else {
                    this._cmdCurrent.resolve(cmd);
                }

                if (this._cmdCurrent.onCmdEnd){
                    this._cmdCurrent.onCmdEnd(cmd);
                }

                this.emit('cmdEnd', cmd);

                this._cmdCurrent = null;
                this._processCmdQueue();

            });
    }

    _getConnector(connector){

        switch (connector){

            case 'usb':
                return this._auroraUsb;

            case 'bluetooth':
                return this._auroraBluetooth;

            case 'any':
            default:
                return this._auroraUsb.isConnected() ? this._auroraUsb : this._auroraBluetooth;
        }
    }

    async _findMsdDrive(retryCount = 0, successOnFound = true) {

        return promisify(DriveList.list, DriveList)().then(async drives => {

            const drive = drives.find(drive => drive.description == AuroraConstants.MSD_DRIVE_NAME);

            if (!drive || !drive.mountpoints.length || !drive.mountpoints[0].path) {

                if (!retryCount || !successOnFound) {

                    return false;
                }
            }
            else if (successOnFound) {

                return drive.mountpoints[0].path;
            }

            await sleep(MSD_SCAN_RETRY_DELAY_MS);

            return this._findMsdDrive(retryCount-1, successOnFound);

        });
    }

    _watchUsb = () => {

        this._unwatchUsb();

        usbDetect.on(`add:${AuroraConstants.AURORA_USB_VID}`, this._onAuroraUsbAttached);
        usbDetect.on(`remove:${AuroraConstants.AURORA_USB_VID}`, this._onAuroraUsbDetached);
    };

    _unwatchUsb = () => {

        usbDetect.removeListener(`add:${AuroraConstants.AURORA_USB_VID}`, this._onAuroraUsbAttached);
        usbDetect.removeListener(`remove:${AuroraConstants.AURORA_USB_VID}`, this._onAuroraUsbDetached);
    };

    _onAuroraUsbAttached = async (device) => {

        if (device.productId === parseInt(AuroraConstants.AURORA_USB_MSD_PID)) {

            this._findMsdDrive(5).then(this._msdSetAttached, true);
        }
        else if (device.productId  === parseInt(AuroraConstants.AURORA_USB_SERIAL_PID) && this._autoConnectUsb) {

            await sleep(500);

            if (this._autoConnectUsb)
            {
                const device = await usbDetect.find(AuroraConstants.AURORA_USB_VID, AuroraConstants.AURORA_USB_SERIAL_PID);

                console.log(device);

                this.connect();
            }
        }
    };

    _onAuroraUsbDetached = (device) => {

        if (device.productId === parseInt(AuroraConstants.AURORA_USB_MSD_PID)) {

            this._findMsdDrive(5).then(this._msdSetDetached, false);
        }

    };

    _msdSetAttached = (msdDrive) => {

        if (!this._msdDrive && msdDrive) {

            this._msdAttaching = false;
            this._msdDrive = msdDrive;

            this.emit('msdAttachmentChange', msdDrive);
        }
    };

    _msdSetDetached = (msdDrive) => {

        if (this._msdDrive && !msdDrive) {

            this._msdDrive = false;

            this.emit('msdAttachmentChange', false);
        }
    };

    _onUsbConnectionStateChange = (connectionState, previousConnectionState) => {

        if (connectionState == AuroraUsb.ConnectionStates.CONNECTED_IDLE &&
            previousConnectionState == AuroraUsb.ConnectionStates.CONNECTING){

            this._getOsInfo('usb').then((cmd) => {

                this.emit(this._isFlashing ? 'flashConnectionChange' : 'usbConnectionChange', cmd.response);

            }).catch((error) => {

                this.disconnectUsb();
            });

        }
        else if (connectionState == AuroraUsb.ConnectionStates.DISCONNECTED &&
            previousConnectionState != AuroraUsb.ConnectionStates.CONNECTING){

            this.emit(this._isFlashing ? 'flashConnectionChange' : 'usbConnectionChange', false);
        }

    };

    _onBluetoothConnectionStateChange = (connectionState, previousConnectionState) => {

        if (connectionState == AuroraBluetooth.ConnectionStates.CONNECTED_IDLE &&
            previousConnectionState == AuroraBluetooth.ConnectionStates.CONNECTING){

            this._getOsInfo('bluetooth').then((cmd) => {

                this.emit(this._isFlashing ? 'flashConnectionChange' : 'bluetoothConnectionChange', cmd.response);

            }).catch((error) => {

                this.disconnectBluetooth();
            });

        }
        else if (connectionState == AuroraBluetooth.ConnectionStates.DISCONNECTED &&
            previousConnectionState != AuroraBluetooth.ConnectionStates.CONNECTING){

            this.emit(this._isFlashing ? 'flashConnectionChange' : 'bluetoothConnectionChange', false);

            if (this._autoConnectBluetooth){

                this._auroraBluetooth.connect(0).catch(() => {});
            }

        }
    };

    _onCmdInputRequested = () => {

        if (!this._cmdCurrent) return;

        this.emit('cmdInputRequested', this._cmdCurrent.inputStream);
    };

    _onCmdOutputReady = (output) => {

        if (!this._cmdCurrent) return;

        this._cmdCurrent.outputStream.push(output);
    };

    _onAuroraLog = (log) => {

        this.emit('log', log);
    };

    _onAuroraStreamData = (streamData) => {

        this.emit('streamData', streamData);
    };

    _onAuroraEvent = (auroraEvent) => {

        this.emit('auroraEvent', auroraEvent);
    };

    _onAuroraError = (error) => {

        this.emit('auroraError', error);
    };

}

const AuroraEventIds = AuroraConstants.EventIds;
const AuroraEventOutputIds = AuroraConstants.EventOutputsIds;
const AuroraLogTypeIds = AuroraConstants.LogTypeIds;
const AuroraStreamIds = AuroraConstants.StreamIds;
const AuroraStreamOutputIds = AuroraConstants.StreamOutputIds;
const AuroraSleepStages = AuroraConstants.SleepStages;

export {
    Aurora, AuroraConstants, AuroraEventIds, AuroraEventOutputIds, AuroraLogTypeIds, AuroraStreamIds,
    AuroraStreamOutputIds, AuroraSleepStages
};

Object.defineProperty(Aurora.prototype, 'syncTime', {value: require('./AuroraCmdSyncTime')});
Object.defineProperty(Aurora.prototype, 'readFile', {value: require('./AuroraCmdReadFile')});
Object.defineProperty(Aurora.prototype, 'writeFile', {value: require('./AuroraCmdWriteFile')});
Object.defineProperty(Aurora.prototype, 'downloadFile', {value: require('./AuroraCmdDownloadFile')});
Object.defineProperty(Aurora.prototype, 'uploadFile', {value: require('./AuroraCmdUploadFile')});
Object.defineProperty(Aurora.prototype, 'flashFile', {value: require('./AuroraCmdFlashFile')});
Object.defineProperty(Aurora.prototype, 'getProfiles', {value: require('./AuroraCmdGetProfiles')});
Object.defineProperty(Aurora.prototype, 'setProfiles', {value: require('./AuroraCmdSetProfiles')});
Object.defineProperty(Aurora.prototype, 'getSessions', {value: require('./AuroraCmdGetSessions')});
Object.defineProperty(Aurora.prototype, 'downloadStream', {value: require('./AuroraCmdDownloadStream')});

export default new Aurora();


