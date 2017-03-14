import test from 'tape';
import aurora from '../../lib/Aurora';
import sinon from 'sinon';
import path from 'path';

import {spiesCalledOnce, spiesNeverCalled, assertCommand} from '../util';

const events = [

    'usbConnected',
    'usbDisconnected',
    'bluetoothConnected',
    'bluetoothDisconnected',
    'msdConnected',
    'msdDisconnected',
    'auroraEvent',
    'log',
    'streamData',
    'auroraError'
];

const eventSpies = {};

events.forEach(event => eventSpies[event] = new sinon.spy());

const resetTest = () => {

    aurora.removeAllListeners();

    for (const event of events) {

        eventSpies[event].reset();
        aurora.on(event, eventSpies[event]);
    }
};

const usbTests = [];
const bluetoothTests = [];

const auroraTest = (type, name, runTest) => {

    const createTest = (connector) => {

        return (t) => {

            if ((connector == 'usb' && !aurora.isUsbConnected()) ||
                (connector == 'bluetooth' && !aurora.isBluetoothConnected())){

                return Promise.resolve();
            }

            return new Promise((resolve, reject) => {

                t.test(name.replace('${connector}', connector), (st) => {

                    runTest(st, connector).then(resolve).catch(reject).then(() => st.end());

                });
            })

        };
    };

    if (type == 'any' || type == 'usb') {

        usbTests.push(createTest('usb'));
    }

    if (type == 'any' || type == 'bluetooth') {

        bluetoothTests.push(createTest('bluetooth'));
    }
};


test('Testing Aurora usb connectivity...', t => {

    Promise.resolve()
        .then(() => resetTest())
        .then(() => aurora.connectUsb())
        .then(() => {

            t.pass(`Aurora connected over usb. Proceeding with usb tests.`);

            spiesCalledOnce(t, ['usbConnected'], eventSpies);
            spiesNeverCalled(t, events, eventSpies, ['usbConnected','log']);

            usbTests.reduce((prevTest, nextTest) => {

                return prevTest.then(nextTest(t)).catch(t.fail);

            }, Promise.resolve());

        })
        .catch((e) => {
            console.log(e);
            t.pass('Aurora not connected over usb. Skipping usb tests.');
        })
        .then(() => t.end());

});

test('Testing Aurora bluetooth connectivity...', (t) => {

    Promise.resolve()
        .then(() => resetTest())
        .then(() => aurora.connectBluetooth())
        .then(() => {

            t.pass(`Aurora master connected over bluetooth. Proceeding with bluetooth tests.`);

            spiesCalledOnce(t, ['bluetoothConnected'], eventSpies);
            spiesNeverCalled(t, events, eventSpies, ['bluetoothConnected','log']);

            bluetoothTests.reduce((prevTest, nextTest) => {

                return prevTest.then(nextTest(t)).catch(t.fail);

            }, Promise.resolve());

        }).catch((e) => {
            console.log(e);
            t.pass('Aurora not connected over bluetooth. Skipping bluetooth tests.');
        }).then(() => t.end());

});

test('Final test.', (t) => {

    t.end();

    process.exit(0);

});


auroraTest('any', 'Testing generic command execution over ${connector}...', (t, connector) => {

    const testCmd = (cmdLine, responseType, isError = false) => {

        return aurora.queueCmd(cmdLine, connector).then(cmd => assertCommand(t, cmd, responseType, isError));
    };

    resetTest();

    return Promise.resolve()
        .then(() => testCmd('os-info', 'object'))
        .then(() => testCmd('help', 'table'))
        .then(() => testCmd('sd-dir-read profiles', 'table'))
        .then(() => testCmd('asdf', 'object', true));

});


auroraTest('usb', 'Testing MSD mode...', (t) => {

    resetTest();

    return Promise.resolve()
        .then(() => aurora.connectMsd())
        .then(() => aurora.disconnectMsd())
        .then(() => {

            spiesCalledOnce(t, ['msdConnected', 'msdDisconnected', 'usbDisconnected'], eventSpies);
            spiesNeverCalled(t, ['bluetoothConnected','bluetoothDisconnected','usbConnected'], eventSpies);

        }).then(() => aurora.connectUsb());

});

/*
auroraTest('usb', 'Testing usb autoconnect...', (t) => {

    resetTest();

    return new Promise((resolve, reject) => {

        let connectionCount = 0;

        aurora.on('usbConnected', () => {

            switch (++connectionCount){

                case 1:
                    t.pass('Auto connected from disconnection state.');
                    aurora.connectMsd().then(() => aurora.disconnectMsd()).catch(reject);
                    break;

                case 2:
                    t.pass('Auto connected after MSD disconnection.');
                    aurora.queueCmd('os-reset','usb').catch(reject);
                    break;

                case 3:
                    t.pass('Auto connected after reset.');
                    aurora.disconnectBluetooth().then(resolve).catch(reject);

                    break;
            }
        });

       aurora.disconnectUsb().then(() => aurora.connect()).catch(reject);

    });

});
*/


auroraTest('any', 'Testing Aurora syncTime command over ${connector}...', (t, connector) => {

    resetTest();

    return aurora.syncTime(connector);

});


auroraTest('any', 'Testing Aurora downloadFile command over ${connector}...', (t, connector) => {

    resetTest();

    return aurora.downloadFile('profiles/rem-stim.prof', path.join(__dirname, 'rem-stim.prof'));

});


auroraTest('any', 'Testing Aurora uploadFile command over ${connector}...', (t, connector) => {

    resetTest();

    return aurora.uploadFile(path.join(__dirname, 'rem-stim.prof'), 'upload.test');

});

/*
auroraTest('bluetooth', 'Testing bluetooth auto connect...', (t) => {

    resetTest();

    return new Promise((resolve, reject) => {

        let connectionCount = 0;

        aurora.on('bluetoothConnected', () => {

            switch (++connectionCount) {

                case 1:
                    t.pass('Auto connected from disconnection state.');
                    aurora.queueCmd('os-reset', 'any').catch(reject);
                    break;

                case 2:
                    t.pass('Auto connected after reset.');
                    resolve();

                    break;
            }
        });

        aurora.disconnectBluetooth().then(() => aurora.connect()).catch(reject);
    });

});
*/
