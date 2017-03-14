import AuroraUsb from './AuroraUsb';
import AuroraBluetooth from './AuroraBluetooth';
import DriveList from 'drivelist';
import usbDetect from 'usb-detection';
import ejectMedia from 'eject-media';
import AuroraConstants from './AuroraConstants';
import EventEmitter from 'events';
import {sleep, promisify} from './util';

const MSD_DISCONNECT_RETRY_DELAY_MS = 2000;
const MSD_SCAN_RETRY_DELAY_MS = 2000;
const MSD_CONNECT_DELAY_SEC = 30;

const MSD_ADD_EVENT_NAME = `add:${+AuroraConstants.AURORA_USB_VID}:${+AuroraConstants.AURORA_USB_MSD_PID}`;
const MSD_REMOVE_EVENT_NAME = `remove:${+AuroraConstants.AURORA_USB_VID}:${+AuroraConstants.AURORA_USB_MSD_PID}`;
const SERIAL_ADD_EVENT_NAME = `add:${+AuroraConstants.AURORA_USB_VID}:${+AuroraConstants.AURORA_USB_SERIAL_PID}`

class Aurora extends EventEmitter {

    constructor() {

        super();

        this._auroraUsb = new AuroraUsb();
        this._auroraUsb.on('connectionStateChange', this._onUsbConnectionStateChange);
        this._auroraUsb.on('usbError', this._onAuroraError);
        this._auroraUsb.on('log', this._onAuroraLog);
        this._auroraUsb.on('streamData', this._onAuroraStreamData);
        this._auroraUsb.on('auroraEvent', this._onAuroraEvent);

        this._auroraBluetooth = new AuroraBluetooth();
        this._auroraBluetooth.on('connectionStateChange', this._onBluetoothConnectionStateChange);
        this._auroraBluetooth.on('bluetoothError', this._onAuroraError);
        this._auroraBluetooth.on('streamData', this._onAuroraStreamData);
        this._auroraBluetooth.on('auroraEvent', this._onAuroraEvent);

        this._cmdQueue = [];

        this._msdDrive = false;

        //this scans for MSD disks that could potentially be the Aurora
        this._getMsdDrive().then(drive => {

            this._msdSetConnected(drive);
        });

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

    connect() {

        this._autoConnectUsb = true;
        this._autoConnectBluetooth = true;

        if (!this._auroraUsb.isConnected() && !this._auroraUsb.isConnecting()){

            this._auroraUsb.connect().catch((e) => {console.log(e)});
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

        return this.disconnectMsd().then(() => this._auroraUsb.connect(port, retryCount));
    }

    async disconnectUsb() {

        this._autoConnectUsb = false;

        if (!this._auroraUsb.isConnected() && !this._auroraUsb.isConnecting()){

            return;
        }

        return this._auroraUsb.disconnect();
    }

    async connectBluetooth(timeoutMs = 20000) {

        if (this._auroraBluetooth.isConnected()){

            return Promise.reject('Already connected over bluetooth.');
        }
        else if (this._auroraBluetooth.isConnecting()){

            return Promise.reject('Already connecting over bluetooth.');
        }

        return this._auroraBluetooth.connect(timeoutMs);
    }

    async disconnectBluetooth(){

        this._autoConnectBluetooth = false;

        if (!this._auroraBluetooth.isConnected() && !this._auroraBluetooth.isConnecting()){

            return;
        }

        return this._auroraBluetooth.disconnect();
    }

    async connectMsd() {

        if (!this.isConnected()){
            return Promise.reject('Must have a connection first.');
        }

        if (this._msdDrive) {

            return Promise.reject('MSD mode already enabled.');
        }
        else if (this._msdConnecting) {

            return Promise.reject('Already enabling MSD mode.');
        }

        this._msdConnecting = true;

        try {

            await this.queueCmd('usb-msd-connect');
        }
        catch (error) {

            this._msdConnecting = false;

            return Promise.reject('Failed enabling MSD mode: ' + error);
        }

        //sleep one second at a time, checking
        //for a connection
        for (let i = 0; i < MSD_CONNECT_DELAY_SEC; i++) {

            await sleep(1000);

            //if we are connected we can return!!
            if (this._msdDrive) return this._msdDrive;
        }

        this._msdConnecting = false;

        return Promise.reject('Timeout waiting for Aurora MSD drive to mount.');
    }

    async disconnectMsd(retryCount = 5) {

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
            this._msdSetDisconnected();

        }).catch(async () => {

            if (retryCount) {

                await sleep(MSD_DISCONNECT_RETRY_DELAY_MS);

                if (!this._msdDrive) {

                    this._msdSetDisconnected();

                    return Promise.resolve();
                }

                return this.disconnectMsd(retryCount-1);
            }

            //check if drive is not actually present
            //in case we missed the disconnect event somehow
            return this._getMsdDrive(0, false).then(msdDrive => {

                if (msdDrive) return Promise.reject('Failed disconnecting from MSD');

                this._msdSetDisconnected();

                return Promise.resolve();

            })

        });
    }

    async queueCmd(command, connectorType = 'any') {

        if (!this._getConnector(connectorType).isConnected()){

            return Promise.reject(`Not connected to Aurora over ${connectorType == 'any' ? 'usb or bluetooth' : connectorType}.`);
        }

        return new Promise((resolve, reject) => {

            this._cmdQueue.push({

                command,
                connectorType,
                resolve,
                reject

            });

            if (!this._cmdCurrent) {

                this._processCmdQueue();
            }

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

        this.emit('cmdBegin', this._cmdCurrent);

        this._cmdCurrent.connector.writeCmd(this._cmdCurrent.command)
            .then(cmdResponse => {

                this._cmdCurrent.response = cmdResponse;

                this.emit('cmdEnd', this._cmdCurrent);

                this._cmdCurrent.resolve(cmdResponse);

                this._processCmdQueue();
            })
            .catch((error) => {

                this._cmdQueue = [];
                this.emit('cmdEnd', this._cmdCurrent);
                this._cmdCurrent.reject(error);
            })
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

    async _getMsdDrive(retryCount = 0, errorOnNotFound = true) {

        return promisify(DriveList.list, DriveList)().then(drives => {

            const drive = drives.find(drive => drive.description == AuroraConstants.MSD_DRIVE_NAME);

            if (errorOnNotFound){

                if (!drive || !drive.mountpoints.length || !drive.mountpoints[0].path) throw new Error();

                return drive.mountpoints[0].path;
            }
            else {

                if (drive && drive.mountpoints.length && drive.mountpoints[0].path) throw new Error();

                return false;
            }

        }).catch(async () => {

            if (!retryCount) {

                return Promise.resolve(false);
            }

            await sleep(MSD_SCAN_RETRY_DELAY_MS);

            return this._getMsdDrive(retryCount-1, errorOnNotFound);
        });
    }

    _watchUsb() {

        usbDetect.removeListener(MSD_ADD_EVENT_NAME, this._onMsdAdd);
        usbDetect.removeListener(MSD_REMOVE_EVENT_NAME, this._onMsdRemove);
        usbDetect.removeListener(SERIAL_ADD_EVENT_NAME, this._onSerialAdd);

        usbDetect.on(MSD_ADD_EVENT_NAME, this._onMsdAdd);
        usbDetect.on(MSD_REMOVE_EVENT_NAME, this._onMsdRemove);
        usbDetect.on(SERIAL_ADD_EVENT_NAME, this._onSerialAdd);

        usbDetect.startMonitoring();
    }

    _unwatchUsb() {

        usbDetect.removeListener(MSD_ADD_EVENT_NAME, this._onMsdAdd);
        usbDetect.removeListener(MSD_REMOVE_EVENT_NAME, this._onMsdRemove);
        usbDetect.removeListener(SERIAL_ADD_EVENT_NAME, this._onSerialAdd);

        usbDetect.stopMonitoring();
    }

    _msdSetConnected(msdDrive) {

        if (!this._msdDrive && msdDrive) {
            this._msdConnecting = false;
            this._msdDrive = msdDrive;
            this.emit('msdConnected', msdDrive);
        }
    }

    _msdSetDisconnected(msdDrive) {

        if (this._msdDrive && !msdDrive) {
            this._msdDrive = false;
            this.emit('msdDisconnected');
        }
    }

    _onUsbConnectionStateChange = (connectionState, previousConnectionState) => {

        if (connectionState == AuroraUsb.ConnectionStates.CONNECTED_IDLE &&
            previousConnectionState == AuroraUsb.ConnectionStates.CONNECTING){

            this.emit('usbConnected', this._auroraUsb);
        }
        else if (connectionState == AuroraUsb.ConnectionStates.DISCONNECTED &&
            previousConnectionState != AuroraUsb.ConnectionStates.CONNECTING){

            this.emit('usbDisconnected');
        }

    };

    _onBluetoothConnectionStateChange = (connectionState, previousConnectionState) => {

        if (connectionState == AuroraBluetooth.ConnectionStates.CONNECTED_IDLE &&
            previousConnectionState == AuroraBluetooth.ConnectionStates.CONNECTING){

            this.emit('bluetoothConnected', this._auroraBluetooth);

        }
        else if (connectionState == AuroraBluetooth.ConnectionStates.DISCONNECTED &&
            previousConnectionState != AuroraBluetooth.ConnectionStates.CONNECTING){

            this.emit('bluetoothDisconnected');
            if (this._autoConnectBluetooth){

                this._auroraBluetooth.connect(0).catch(() => {});
            }

        }
    };

    _onMsdAdd = (device) => {

        this._getMsdDrive(5).then((drive) => this._msdSetConnected(drive));
    };

    _onMsdRemove = (device) => {

        this._getMsdDrive(5, false).then((drive) => this._msdSetDisconnected(drive));
    };

    _onSerialAdd = (device) => {

        if (this._autoConnectUsb){

            this.connect();
        }
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

Object.defineProperty(Aurora.prototype, 'syncTime', {value: require('./AuroraCmdSyncTime')});
Object.defineProperty(Aurora.prototype, 'readFile', {value: require('./AuroraCmdReadFile')});
Object.defineProperty(Aurora.prototype, 'writeFile', {value: require('./AuroraCmdWriteFile')});
Object.defineProperty(Aurora.prototype, 'downloadFile', {value: require('./AuroraCmdDownloadFile')});
Object.defineProperty(Aurora.prototype, 'uploadFile', {value: require('./AuroraCmdUploadFile')});

export default new Aurora();


