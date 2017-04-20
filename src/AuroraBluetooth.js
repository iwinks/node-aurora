import EventEmitter from 'events';
import keyBy from 'lodash/keyBy';
import {sleep, promisify} from './util';
import AuroraBluetoothParser from './AuroraBluetoothParser';
import {BleAuroraService, BleAuroraChars, BleCmdStates, BLE_CMD_MAX_PACKET_LENGTH} from './AuroraConstants';

//nasty nasty nasty, see https://github.com/sandeepmistry/noble/issues/570
try { noble = require("noble"); } catch(err) { noble = { on: () => {}, }; }

const INIT_DELAY_MS = 5000;
const DISCONNECT_RETRY_DELAY_MS = 3000;

export default class AuroraBluetooth extends EventEmitter {

    static ConnectionStates = {

        INIT: 'init',
        DISCONNECTED : 'disconnected',
        CONNECTING : 'connecting',
        CONNECTED_IDLE : 'idle',
        CONNECTED_BUSY : 'busy'
    };

    constructor() {

        super();

        this._initializing = false;

        this._connectionState = AuroraBluetooth.ConnectionStates.INIT;
        this._disconnectPending = false;

        this._bluetoothParser = new AuroraBluetoothParser();
        this._bluetoothParser.on('parseError', this._onParseError);
        this._bluetoothParser.on('cmdResponseRead', this._onParseCmdResponseRead);
        this._bluetoothParser.on('cmdResponseWrite', this._onParseCmdResponseWrite);
        this._bluetoothParser.on('cmdInputRequested', this._onParseCmdInputRequested);
        this._bluetoothParser.on('cmdOutputReady', this._onParseCmdOutputReady);
        this._bluetoothParser.on('auroraEvent', this._onParseAuroraEvent);
        this._bluetoothParser.on('streamData', this._onParseStreamData);

        this._watchBluetoothAdapter();
    }

    isConnected(){

        return this._connectionState == AuroraBluetooth.ConnectionStates.CONNECTED_IDLE ||
               this._connectionState == AuroraBluetooth.ConnectionStates.CONNECTED_BUSY;
    }

    isConnecting(){

        return this._connectionState == AuroraBluetooth.ConnectionStates.CONNECTING;
    }

    async connect(timeoutMs = 30000) {

        //if we are waiting for initialization, we'll ignore
        //any further connection attempts silently
        if (this._initializing) return;

        //has the system booted up yet? If not, we'll
        //wait for a bit and try again
        if (this._connectionState == AuroraBluetooth.ConnectionStates.INIT){

            this._initializing = true;

            //sleep for a little bit
            await sleep(INIT_DELAY_MS);

            this._initializing = false;

            //if the state hasn't changed since we waited for
            //initialization to complete, something is wrong
            if (this._connectionState == AuroraBluetooth.ConnectionStates.INIT){

                return Promise.reject('No bluetooth adapter found. Is bluetooth disabled?');
            }

            //try connecting now that the system is initialized
            return this.connect(timeoutMs);
        }

        if (this._connectionState != AuroraBluetooth.ConnectionStates.DISCONNECTED) {

            switch (this._connectionState) {

                case AuroraBluetooth.ConnectionStates.CONNECTING:
                    return Promise.reject('Already connecting...');

                case AuroraBluetooth.ConnectionStates.CONNECTED_BUSY:
                case AuroraBluetooth.ConnectionStates.CONNECTED_IDLE:
                    return Promise.reject('Already connected.');

                default:
                    return Promise.reject('Unknown Bluetooth connection state.');
            }
        }

        this._setConnectionState(AuroraBluetooth.ConnectionStates.CONNECTING);

        try {

            const [peripheral, service, characteristics] = await this._connect(timeoutMs);

            this._peripheral = peripheral;
            this._service = service;

            this._peripheral.once('disconnect', this._onPeripheralDisconnect);

            this._characteristicsByUUID = keyBy(characteristics, 'uuid');

            //these get used a lot, so let's store references
            this._cmdStatusChar = this._characteristicsByUUID[BleAuroraChars.CMD_STATUS];
            this._cmdDataChar = this._characteristicsByUUID[BleAuroraChars.CMD_DATA];
            this._cmdOutputChar = this._characteristicsByUUID[BleAuroraChars.CMD_OUTPUT_NOTIFIED];

            await this._charSubscribe(this._characteristicsByUUID[BleAuroraChars.STREAM_DATA_NOTIFIED], this._onParseStreamData);

            await this._charSubscribe(this._characteristicsByUUID[BleAuroraChars.AURORA_EVENT_NOTIFIED], (event) => {
                this._bluetoothParser.onAuroraEventCharNotification(event);
            });

            await this._charSubscribe(this._cmdStatusChar, (status) => {
                this._bluetoothParser.onCmdStatusCharNotification(status);
            });

            await this._charSubscribe(this._cmdOutputChar, (output) => {
               this._bluetoothParser.onCmdOutputCharNotification(output);
            });

            this._setConnectionState(AuroraBluetooth.ConnectionStates.CONNECTED_IDLE);

            return this._peripheral;
        }
        catch (error) {

            this._setConnectionState(AuroraBluetooth.ConnectionStates.DISCONNECTED);

            return Promise.reject(error);
        }
    }

    async disconnect() {

        if (this._connectionState == AuroraBluetooth.ConnectionStates.DISCONNECTED || this._disconnectPending) {

            return;
        }

        this._disconnectPending = true;

        //check if we are in the process of connecting, or are processing a command
        if (this._connectionState == AuroraBluetooth.ConnectionStates.CONNECTING) {

            noble.stopScanning();

            //give scanning a little time to stop
            await sleep(20);

            if (this._connectionState != AuroraBluetooth.ConnectionStates.DISCONNECTED) {

                return Promise.reject('Failed to disconnect. Scanning not stopped.');
            }
        }
        else if (this._connectionState == AuroraBluetooth.ConnectionStates.CONNECTED_BUSY) {

            //let's give the system a little time before we pull the plug
            await sleep(DISCONNECT_RETRY_DELAY_MS);
        }

        //have we disconnected yet?
        if (this._connectionState == AuroraBluetooth.ConnectionStates.DISCONNECTED) return;

        //nope but we can't wait any longer
        return promisify(this._peripheral.disconnect, this._peripheral)().then(() => {

            //in case disconnected event hasn't fired yet, we fire it here
            this._setConnectionState(AuroraBluetooth.ConnectionStates.DISCONNECTED);
        });
    }

    async writeCmd(cmd) {

        //check for error condition
        if (this._connectionState != AuroraBluetooth.ConnectionStates.CONNECTED_IDLE) {

            switch (this._connectionState) {

                case AuroraBluetooth.ConnectionStates.DISCONNECTED:
                case AuroraBluetooth.ConnectionStates.ADAPTER_FOUND:
                case AuroraBluetooth.ConnectionStates.DEVICE_FOUND:
                    return Promise.reject('No idle serial connection.');

                case AuroraBluetooth.ConnectionStates.CONNECTED_BUSY:
                    return Promise.reject('Another command is already in progress.');

                default:
                    return Promise.reject('Unknown Bluetooth connection state.');
            }
        }

        if (this._disconnectPending){

            return Promise.reject('Bluetooth currently disconnecting.');
        }

        this._setConnectionState(AuroraBluetooth.ConnectionStates.CONNECTED_BUSY);

        return new Promise(async (resolve, reject) => {

            try {

                this._bluetoothParser.once('cmdResponse', (cmdResponse) => {

                    this._setConnectionState(AuroraBluetooth.ConnectionStates.CONNECTED_IDLE);

                    cmdResponse.origin = 'bluetooth';

                    resolve(cmdResponse);

                });

                //write the status byte, indicating start of command
                await this._charWrite(this._cmdStatusChar, Buffer.from([BleCmdStates.IDLE]));

                //write the actual command string as ascii (max 128bytes)
                await this._charWrite(this._cmdDataChar, Buffer.from(cmd, 'ascii'));

                //let the parser know the command too
                this._bluetoothParser.setCmd(cmd);

                //write the status byte, indicating end of command
                await this._charWrite(this._cmdStatusChar, Buffer.from([BleCmdStates.CMD_EXECUTE]));
            }
            catch (error) {

                this._bluetoothParser.reset();
                this._bluetoothParser.removeAllListeners('cmdResponse');

                this._setConnectionState(AuroraBluetooth.ConnectionStates.CONNECTED_IDLE);

                reject(error);
            }

        });

    }

    async writeCmdInput(data) {

        //check for error condition
        if (this._connectionState != AuroraBluetooth.ConnectionStates.CONNECTED_BUSY) {

            switch (this._connectionState) {

                case AuroraBluetooth.ConnectionStates.DISCONNECTED:
                case AuroraBluetooth.ConnectionStates.ADAPTER_FOUND:
                case AuroraBluetooth.ConnectionStates.DEVICE_FOUND:
                    return Promise.reject('No idle serial connection.');

                case AuroraBluetooth.ConnectionStates.CONNECTED_IDLE:
                    return Promise.reject('Command input can only be written during a command.');

                default:
                    return Promise.reject('Unknown Bluetooth connection state.');
            }
        }

        return this._charWrite(this._cmdDataChar, data);
    }

    _setConnectionState(connectionState) {

        if (this._connectionState == connectionState) {

            return;
        }

        const previousConnectionState = this._connectionState;

        this._connectionState = connectionState;

        if (this._connectionState == AuroraBluetooth.ConnectionStates.DISCONNECTED){

            this._disconnectPending = false;
        }

        //console.log(`${previousConnectionState} --> ${connectionState}`);

        this.emit('connectionStateChange', connectionState, previousConnectionState);
    }

    async _connect(timeoutMs) {

        if (this._connectPromise){

            throw new Error('Already have a pending connection.');
        }

        return new Promise((resolve, reject) => {

            this._connectPromise = {resolve, reject};

            //remove any existing listeners just in case
            noble.removeListener('discover', this._onPeripheralFound);
            noble.removeListener('scanStop', this._onPeripheralScanStop);

            noble.on('discover', this._onPeripheralFound);
            noble.once('scanStop', this._onPeripheralScanStop);

            noble.startScanning([BleAuroraService], false);

            clearTimeout(this._connectTimer);

            if (timeoutMs > 0) {

                this._connectTimer = setTimeout(() => {

                    this._connectPromise = null;

                    noble.stopScanning();
                    noble.removeListener('discover', this._onPeripheralFound);

                    reject('Timeout waiting for bluetooth connection.');

                }, timeoutMs);
            }

        });
    }

    async _charWritePacket(char, packet){

        if (!Buffer.isBuffer(packet)) return Promise.reject('Packet parameter is not a valid buffer.');

        if (!packet.length) return Promise.resolve();

        if (packet.length > BLE_CMD_MAX_PACKET_LENGTH) return Promise.reject('Exceeded max write packet length.');

        return new Promise((resolve, reject) => {

            //write a packet, the false here means the callback
            //isn't executed until the other side confirms receipt
            char.write(packet, false, error => {

                if (error) return reject(error);

                resolve();

            });

        });
    }

    async _charReadPacket(char){

        return new Promise((resolve, reject) => {

            //write a packet, the false here means the callback
            //isn't executed until the other side confirms receipt
            char.read((error, packet) => {

                if (error) return reject(error);

                resolve(packet);

            });

        });
    }

    async _charWrite(char, buffer) {

        if (!Buffer.isBuffer(buffer)) throw 'Buffer parameter is not a valid buffer.';

        if (!buffer.length) return;

        //process at most 20 bytes at a time
        for (let i = 0 ; i < (buffer.length + BLE_CMD_MAX_PACKET_LENGTH); i += BLE_CMD_MAX_PACKET_LENGTH) {

            //create a buffer slice <= 20 bytes
            //slice handles case where buffer < 20
            const packet = buffer.slice(i, (i + BLE_CMD_MAX_PACKET_LENGTH));

            //if this slice is empty, nothing to do
            if (!packet.length) break;

            //remember, this happens synchronously
            await this._charWritePacket(char, packet);
        }
    }

    async _charRead(char, numBytes) {

        if (numBytes <= 0) throw 'Trying to read less than 1 byte.';

        const packets = [];

        let packetCount = Math.ceil(numBytes / BLE_CMD_MAX_PACKET_LENGTH);

        //read packets until we've read all required bytes
        while (packetCount--){

            //read the packet, and add it to packet array
            const packet = await this._charReadPacket(char);
            packets.push(packet);
        }

        //waits till the last promise is resolved
        //then return the concatenated buffer
        return Buffer.concat(packets, numBytes);
    }

    async _charSubscribe(char, onNotification){

        return new Promise((resolve, reject) => {

            char.subscribe(error => {

                if (error) return reject(error);

                char.on('data', onNotification);

                resolve();
            });

        });
    }

    _watchBluetoothAdapter() {

        this._unwatchBluetoothAdapter();

        noble.on('stateChange', this._onAdapterStateChange);
    }

    _unwatchBluetoothAdapter(){

        noble.removeListener('stateChange', this._onAdapterStateChange);
    }

    _onAdapterStateChange = (state) => {

        if (state == 'poweredOn'){

            if (this._connectionState == AuroraBluetooth.ConnectionStates.INIT){

                //don't fire event here, just set connection state directly
                this._connectionState = AuroraBluetooth.ConnectionStates.DISCONNECTED;
            }
        }
        else if (state == 'poweredOff'){

            this._connectionState = AuroraBluetooth.ConnectionStates.INIT;
        }
    };

    _onPeripheralDisconnect = () => {

        this._setConnectionState(AuroraBluetooth.ConnectionStates.DISCONNECTED);
    };

    _onPeripheralFound = (peripheral) => {

        peripheral.connect(error => {

            if (error) {

                return;
            }

            peripheral.discoverSomeServicesAndCharacteristics([BleAuroraService], Object.values(BleAuroraChars), (error, services, characteristics) => {

                if (error) {

                    return;
                }

                if (!this._connectPromise) {

                    throw new Error('Peripheral found event fired without valid connection promise.');
                }

                this._connectPromise.resolve([peripheral, services[0], characteristics]);
                this._connectPromise = null;

                noble.stopScanning();

            });
        });

    };

    _onPeripheralScanStop = () => {

        clearTimeout(this._connectTimer);

        noble.removeListener('discover', this._onPeripheralFound);

        if (this._connectPromise){

            this._setConnectionState(AuroraBluetooth.ConnectionStates.DISCONNECTED);
            this._connectPromise.reject('Connection cancelled.');
            this._connectPromise = null;
        }

    };

    _onParseCmdResponseRead = (bytesToRead, cbAfterRead) => {

        this._charRead(this._cmdDataChar, bytesToRead).then(cbAfterRead);
    };

    _onParseCmdResponseWrite = (buffer, cbAfterWrite) => {

        this._charWrite(this._cmdDataChar, buffer).then(() => {

            this._charWrite(this._cmdStatusChar, Buffer.from([BleCmdStates.IDLE])).then(cbAfterWrite);
        });
    };

    _onParseCmdInputRequested = () => {

        this.emit('cmdInputRequested');
    };

    _onParseCmdOutputReady = (output) => {

        this.emit('cmdOutputReady', output);
    };

    _onParseAuroraEvent = (auroraEvent) => {

        auroraEvent.origin = 'bluetooth';

        this.emit('auroraEvent', auroraEvent);
    };

    _onParseStreamData = (streamData) => {

        streamData.origin = 'bluetooth';

        this.emit('streamData', streamData);
    };

    _onParseError = (error) => {

        this.emit('bluetoothError', 'Parse Error: ' + error);
    };

}