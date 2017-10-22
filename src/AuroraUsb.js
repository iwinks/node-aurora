import EventEmitter from 'events';
import SerialPort from 'serialport';
import AuroraSerialParser from './AuroraSerialParser';
import {sleep, promisify} from './util';

const CONNECT_RETRY_DELAY_MS = 1500;
const DISCONNECT_RETRY_DELAY_MS = 3000;

export default class AuroraUsb extends EventEmitter {

    static ConnectionStates = {

        DISCONNECTED : 'disconnected',
        CONNECTING : 'connecting',
        CONNECTED_IDLE : 'idle',
        CONNECTED_BUSY : 'busy'
    };

    static discoverAuroraPorts() {

        return promisify(SerialPort.list, SerialPort)().then(ports => {

            let auroraPorts = [];

            for (const port of ports) {

                //simplify these conditions when old
                //units are no longer in circulation
                if ((port.pnpId && port.pnpId.indexOf('5740') !== -1) ||
                    (port.pnpId && port.pnpId.indexOf('0483') !== -1) ||
                    (port.productId && port.productId.indexOf('5740') !== -1) ||
                    (port.vendorId && port.vendorId.indexOf(AURORA_USB_VID) !== -1) ||
                    port.manufacturer == "iWinks") {

                    auroraPorts.push(port.comName.replace('cu.','tty.'));
                }
            }

            return auroraPorts;

        });
    }

    constructor() {

        super();

        this._serialParser = new AuroraSerialParser();

        this._connectionState = AuroraUsb.ConnectionStates.DISCONNECTED;
        this._disconnectPending = false;

        this._serialParser.on('auroraEvent', this._onParseAuroraEvent);
        this._serialParser.on('log', this._onParseLog);
        this._serialParser.on('streamData', this._onParseStreamData);
        this._serialParser.on('streamTimestamp', this._onParseStreamTimestamp);
        this._serialParser.on('cmdInputRequested', this._onParseCmdInputRequested);
        this._serialParser.on('cmdOutputReady', this._onParseCmdOutputReady);
        this._serialParser.on('parseError', this._onParseError);
    }

    isConnected(){

        return this._connectionState == AuroraUsb.ConnectionStates.CONNECTED_IDLE ||
               this._connectionState == AuroraUsb.ConnectionStates.CONNECTED_BUSY;
    }

    isConnecting(){

        return this._connectionState == AuroraUsb.ConnectionStates.CONNECTING;
    }

    async connect(port = 'detect', retryCount = 3) {

        //at this point state should be disconnected
        //otherwise, this is an error case.
        if (this._connectionState != AuroraUsb.ConnectionStates.DISCONNECTED) {

            switch (this._connectionState) {

                case AuroraUsb.ConnectionStates.CONNECTING:
                    return Promise.reject('Already connecting...');

                case AuroraUsb.ConnectionStates.CONNECTED_BUSY:
                case AuroraUsb.ConnectionStates.CONNECTED_IDLE:
                    return Promise.reject('Already connected.');

                default:
                    return Promise.reject('Unknown USB connection state.');
            }
        }

        this._setConnectionState(AuroraUsb.ConnectionStates.CONNECTING);

        let connectionAttempts = 0;

        do {

            if (connectionAttempts) {

                await sleep(CONNECT_RETRY_DELAY_MS);
            }

            connectionAttempts++;

            try {

                if (port == 'detect') {

                    const auroraPorts = await AuroraUsb.discoverAuroraPorts();

                    if (!auroraPorts.length) {

                        throw new Error('No Aurora devices found.');
                    }

                    for (const auroraPort of auroraPorts) {

                        if (this._disconnectPending) break;

                        try {

                            this._serialPort = await this._connect(auroraPort);

                            this._setConnectionState(AuroraUsb.ConnectionStates.CONNECTED_IDLE);

                            return auroraPort;
                        }
                        catch (error) {

                            console.log('caught error', error);

                        } //swallow this error
                    }

                    throw new Error(`Failed connecting to Aurora on port(s): ${auroraPorts.join(',')}`);
                }
                else {

                    this._serialPort = await this._connect(port);

                    this._setConnectionState(AuroraUsb.ConnectionStates.CONNECTED_IDLE);

                    return port;
                }
            }
            catch (error) {

                continue;
            }

        } while (connectionAttempts <= retryCount && this._connectionState == AuroraUsb.ConnectionStates.CONNECTING && !this._disconnectPending)

        //if we are here, all connection attempts failed
        this._setConnectionState(AuroraUsb.ConnectionStates.DISCONNECTED);

        return Promise.reject(`Failed connecting to Aurora on port "${port}".`);
    }

    async disconnect() {

        if (this._connectionState == AuroraUsb.ConnectionStates.DISCONNECTED || this._disconnectPending) {

            return;
        }

        this._disconnectPending = true;

        //check if we are in the process of connecting, or are processing a command
        if (this._connectionState == AuroraUsb.ConnectionStates.CONNECTING ||
            this._connectionState == AuroraUsb.ConnectionStates.CONNECTED_BUSY) {

            //let's give the system a little time before we pull the plug
            await sleep(DISCONNECT_RETRY_DELAY_MS);

            //did it work
            if (this._connectionState == AuroraUsb.ConnectionStates.DISCONNECTED) return;

            //no but we can't wait any longer...
        }

        return promisify(this._serialPort.close, this._serialPort)().catch(console.log).then(() => {

            //in case disconnected event hasn't fired yet, we fire it here
            this._setConnectionState(AuroraUsb.ConnectionStates.DISCONNECTED);

        });
    }

    async writeCmd(cmd) {

        //check for error condition
        if (this._connectionState != AuroraUsb.ConnectionStates.CONNECTED_IDLE) {

            switch (this._connectionState) {

                case AuroraUsb.ConnectionStates.DISCONNECTED:
                case AuroraUsb.ConnectionStates.CONNECTING:
                    return Promise.reject('No idle serial connection.');

                case AuroraUsb.ConnectionStates.CONNECTED_BUSY:
                    return Promise.reject('Another command is already in progress.');

                default:
                    return Promise.reject('Unknown USB connection state.');
            }
        }

        if (this._disconnectPending) {

            return Promise.reject('Serial port currently disconnecting.');
        }

        this._setConnectionState(AuroraUsb.ConnectionStates.CONNECTED_BUSY);

        return new Promise((resolve, reject) => {

            const onDisconnect = (connectionState) => {

                if (connectionState == AuroraUsb.ConnectionStates.DISCONNECTED) {

                    reject('Usb disconnected while processing command response.');
                }
            };

            this._serialParser.once('cmdResponse', (cmdResponse) => {

                this.removeListener('connectionStateChange', onDisconnect);

                if (this._connectionState == AuroraUsb.ConnectionStates.CONNECTED_BUSY) {

                    this._setConnectionState(AuroraUsb.ConnectionStates.CONNECTED_IDLE);
                }

                cmdResponse.origin = 'usb';

                resolve(cmdResponse);

            });

            this.once('connectionStateChange', onDisconnect);

            cmd = cmd.trim() + '\r';

            this._write(cmd).catch(error => {

                this._serialParser.removeAllListeners('cmdResponse');
                this.removeListener('connectionStateChange', onDisconnect);

                if (this._connectionState == AuroraUsb.ConnectionStates.CONNECTED_BUSY) {

                    this._setConnectionState(AuroraUsb.ConnectionStates.CONNECTED_IDLE);
                }

                reject(error);
            });

        });
    }

    async writeCmdInput(data){

        //check for error condition
        if (this._connectionState != AuroraUsb.ConnectionStates.CONNECTED_BUSY) {

            switch (this._connectionState) {

                case AuroraUsb.ConnectionStates.DISCONNECTED:
                case AuroraUsb.ConnectionStates.CONNECTING:
                    return Promise.reject('No idle serial connection.');

                case AuroraUsb.ConnectionStates.CONNECTED_IDLE:
                    return Promise.reject('Command input can only be written during a command.');

                default:
                    return Promise.reject('Unknown USB connection state.');
            }
        }

        //process at most 128 bytes at a time
        for (let i = 0 ; i < (data.length + 128); i += 128) {

            const packet = data.slice(i, (i + 128));

            //if this slice is empty, nothing to do
            if (!packet.length) break;

            //remember, this happens synchronously
            await this._write(packet);
        }

        return data;
    }

    _setConnectionState(connectionState) {

        //don't fire or respond to events when the
        //state doesn't actually change
        if (this._connectionState == connectionState) {

            return;
        }

        const previousConnectionState = this._connectionState;

        this._connectionState = connectionState;

        if (connectionState == AuroraUsb.ConnectionStates.DISCONNECTED) {

            this._disconnectPending = false;

            if (this._serialPort){

                this._serialPort.removeAllListeners();
            }
        }
        else if (connectionState == AuroraUsb.ConnectionStates.CONNECTED_IDLE && previousConnectionState == AuroraUsb.ConnectionStates.CONNECTING){

            this._serialParser.reset();

            this._serialPort.removeAllListeners();

            this._serialPort.on('data', this._onSerialData);
            this._serialPort.on('close', this._onSerialDisconnect);
            this._serialPort.on('error', this._onSerialError);
        }

        this.emit('connectionStateChange', connectionState, previousConnectionState);
    }

    async _connect(port) {

        return new Promise((resolve, reject) => {

            const serialPort = new SerialPort(port, (error) => {

                if (error) return reject(error);

                //flush any bytes in buffer that haven't been read
                serialPort.flush(error => {

                    if (error) return reject(error);

                    if (this._disconnectPending) return reject('Serial disconnect pending, cancelling connection.');

                    resolve(serialPort);
                });

            });

        });
    }

    async _write(data) {

        return new Promise((resolve, reject) => {

            this._serialPort.write(data, writeError => {

                if (writeError) return reject(writeError);

                this._serialPort.drain(drainError => {

                    if (drainError) return reject(drainError);

                    resolve(data);

                });

            });

        });
    }

    _onSerialDisconnect = () => {

        this._setConnectionState(AuroraUsb.ConnectionStates.DISCONNECTED);
    };

    _onSerialData = (chunk) => {

        this._serialParser.parseChunk(chunk);
    };

    _onParseLog = (log) => {

        log.origin = 'usb';

        this.emit('log', log);
    };

    _onParseAuroraEvent = (auroraEvent) => {

        auroraEvent.origin = 'usb';

        this.emit('auroraEvent', auroraEvent);
    };

    _onParseStreamData = (streamData) => {

        streamData.origin = 'usb';

        this.emit('streamData', streamData);
    };

    _onParseCmdInputRequested = () => {

        this.emit('cmdInputRequested');
    };

    _onParseCmdOutputReady = (output) => {

        this.emit('cmdOutputReady', output);
    };

    _onParseStreamTimestamp = (streamTimestamp) => {

        streamTimestamp.origin = 'usb';

        this.emit('streamTimestamp', streamTimestamp);
    };

    _onParseError = (error) => {

        this.emit('usbError', 'Parse Error: ' + error);
    };

    _onSerialError = (error) => {

        this.emit('usbError', 'Serial error: ' + error);
    }

}