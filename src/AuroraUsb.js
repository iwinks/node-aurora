import EventEmitter from 'events';
import SerialPort from 'serialport';

import AuroraSerialParser from './AuroraSerialParser';
import {AURORA_USB_VID} from './AuroraConstants';

const serialOptions = {

    baudrate: 38400,
    parser: SerialPort.parsers.readline('\r\n')
};

const ConnectionStates = {

    'DISCONNECTED' : 0,
    'CONNECTING' : 1,
    'CONNECTED_SERIAL_IDLE' : 2,
    'CONNECTED_SERIAL_BUSY' : 3,
    'CONNECTED_MSD' : 4
};

const ConnectionStateStrings = ['disconnected','connecting','connected','busy','msdEnabled'];

export default class AuroraUsb extends EventEmitter {

    constructor() {

        super();

        this._serialParser = new AuroraSerialParser();

        this._connectionState = ConnectionStates.DISCONNECTED;

        //this._serialParser.on('commandResponse');
        //this._serialParser.on('commandOutput');
        //this._serialParser.on('auroraEvent');
        //this._serialParser.on('log');
        //this._serialParser.on('streamData');
        //this._serialParser.on('unknownResponse');
    }

    monitorConnection() {

        usbDetect.on('add:' + parseInt(AURORA_USB_VID), (device) => this.emit('usbConnect', device));
        usbDetect.on('remove:' + parseInt(AURORA_USB_VID), (device) => this.emit('usbDisconnect', device));
    }

    isConnected() {

    }

    isSerialConnected() {

    }

    isMsdConnected() {

    }

    async connect(port = 'auto') {

        switch (this._connectionState) {

            case ConnectionStates.CONNECTING:
                return Promise.reject('Already connecting...');

            case ConnectionStates.CONNECTED_SERIAL_BUSY:
            case ConnectionStates.CONNECTED_SERIAL_IDLE:
                return Promise.reject('Already connected.');

            case ConnectionStates.CONNECTED_MSD:
                return Promise.reject('USB in MSD mode.');

            case ConnectionStates.DISCONNECTED:
                break;

            default:
                return Promise.reject('Unknown connection state.');
        }

        this._setConnectionState(ConnectionStates.CONNECTING);

        try {

            if (port == 'auto') {

                const auroraPorts = await this.discoverAuroraPorts();

                if (!auroraPorts.length) return Promise.reject('No Aurora devices found.');

                for (const auroraPort of auroraPorts) {

                    try {

                        this._serial = await this._connect(auroraPort);

                        this._setConnectionState(ConnectionStates.CONNECTED_SERIAL_IDLE);

                        return auroraPort;
                    }
                    catch (error) { } //swallow this error
                }

                return Promise.reject(`Failed connecting to Aurora on port(s) ${auroraPorts.join(',')}`);
            }
            else {

                this._serial = await this._connect(port);

                this._setConnectionState(ConnectionStates.CONNECTED_SERIAL_IDLE);

                return port;
            }
        }
        catch (error) {

            this._setConnectionState(ConnectionStates.DISCONNECTED);

            return Promise.reject(`Failed connecting to Aurora on port ${port}: ${error}`);
        }
    }

    sendCmd(cmd) {

        switch (this._connectionState) {

            case ConnectionStates.DISCONNECTED:
            case ConnectionStates.CONNECTING:
                return Promise.reject('No USB serial connection.');

            case ConnectionStates.CONNECTED_SERIAL_BUSY:
                return Promise.reject('Another command is already in progress.');

            case ConnectionStates.CONNECTED_MSD:
                return Promise.reject('USB in MSD mode.');

            case ConnectionStates.CONNECTED_SERIAL_IDLE:
                break;

            default:
                return Promise.reject('Unknown USB connection state.');
        }

        this._setConnectionState(ConnectionStates.CONNECTED_SERIAL_BUSY);

        return new Promise((resolve, reject) => {

            this._serialParser.once('commandResponse', (cmdResponse) => {

                this._setConnectionState(ConnectionStates.CONNECTED_SERIAL_IDLE);

                resolve(cmdResponse);
            });

            cmd = cmd.trim() + '\r\n';

            this._write(cmd).catch(error => {

                this._serialParser.removeAllListeners('commandResponse');

                this._setConnectionState(ConnectionStates.CONNECTED_SERIAL_IDLE);

                reject(error);
            });

        });
    }

    disconnect() {

        if (this._serial) {

            this._serial.close();
        }
    }

    discoverAuroraPorts() {

        return new Promise((resolve, reject) => {

            SerialPort.list( (error, ports) => {

                if (error) {

                    return reject(error);
                }

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

                resolve(auroraPorts);

            });

        });
    }

    _setConnectionState(connectionState) {

        if (this._connectionState == connectionState || !ConnectionStateStrings[connectionState]) {

            return;
        }

        switch (connectionState) {

            case ConnectionStates.DISCONNECTED:
                this._serial.removeAllListeners();
                break;

            case ConnectionStates.CONNECTED_SERIAL_IDLE:

                //if we are coming from connecting state, we need to
                //enable some events
                if (this._connectionState == ConnectionStates.CONNECTING) {

                    this._serialParser.reset();

                    this._serial.removeAllListeners();

                    this._serial.on('data', this._onSerialDataLine);
                    this._serial.on('close', this._onSerialDisconnect);
                    this._serial.on('error', console.log);
                }

                break;

            case ConnectionStates.CONNECTED_MSD:
                this._serial.removeAllListeners();
                break;
        }

        this._connectionState = connectionState;

        this.emit('connectionStateChange', ConnectionStateStrings[connectionState]);
    }

    _connect(port) {

        return new Promise((resolve, reject) => {

            const serialPort = new SerialPort(port, serialOptions, (error) => {

                if (error) return reject(error);

                resolve(serialPort);
            });

        });
    }

    _write(data) {

        return new Promise((resolve, reject) => {

            this._serial.write(data, writeError => {

                if (writeError) return reject(writeError);

                this._serial.drain(drainError => {

                    if (drainError) return reject(drainError);

                    resolve(data);

                });

            });

        });
    }

    _onSerialDisconnect = () => {

        this._setConnectionState(ConnectionStates.DISCONNECTED);
    };

    _onSerialDataLine = (line) => {

        this._serialParser.parseLine(line);
    };

    _onParseLog = (log) => {

        log.origin = 'usb';

        this.emit('log', log);
    }

    _onParseUnknownResponse = (line) => {

        this.emit('error', `Unknown response during parsing: ${line}`);
    }

    _onParseAuroraEvent = () => {

    };

    _onParseStreamData = () => {

    };


}