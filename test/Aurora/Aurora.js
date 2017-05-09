import test from 'tape';
import aurora from '../../lib/Aurora';
import sinon from 'sinon';
import path from 'path';

import {spiesCalledOnce, spiesNeverCalled, assertCommand, spiesCalled} from '../util';

const events = [

    'usbConnectionChange',
    'bluetoothConnectionChange',
    'flashConnectionChange',
    'msdConnectionChange',
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
            });

        };
    };

    if (type == 'any' || type == 'usb') {

        usbTests.push(createTest('usb'));
    }

    if (type == 'any' || type == 'bluetooth') {

        bluetoothTests.push(createTest('bluetooth'));
    }
};


test('Testing Aurora bluetooth connectivity...', (t) => {

    Promise.resolve()
        .then(() => resetTest())
        .then(() => aurora.connectBluetooth())
        .then(() => {

            t.pass(`Aurora master connected over bluetooth. Proceeding with bluetooth tests.`);

            spiesCalledOnce(t, ['bluetoothConnectionChange'], eventSpies);
            spiesNeverCalled(t, events, eventSpies, ['bluetoothConnectionChange','log']);

            bluetoothTests.reduce((prevTest, nextTest) => {

                resetTest();
                return prevTest.then(nextTest(t)).catch(t.fail);

            }, Promise.resolve());

        }).catch((e) => {

            t.pass('Aurora not connected over bluetooth. Skipping bluetooth tests.');
            
        }).then(() => t.end());

});

test('Testing Aurora usb connectivity...', t => {

    Promise.resolve()
        .then(() => resetTest())
        .then(() => aurora.connectUsb())
        .then(() => {

            t.pass(`Aurora connected over usb. Proceeding with usb tests.`);

            spiesCalledOnce(t, ['usbConnectionChange'], eventSpies);
            spiesNeverCalled(t, events, eventSpies, ['usbConnectionChange','log']);

            usbTests.reduce((prevTest, nextTest) => {

                resetTest();
                return prevTest.then(nextTest(t)).catch(t.fail);

            }, Promise.resolve());

        })
        .catch((e) => {
            console.log(e);
            t.pass('Aurora not connected over usb. Skipping usb tests.');
        })
        .then(() => t.end());

});


test('Final test.', (t) => {

    t.end();

    process.exit(0);

});



auroraTest('any', 'Testing generic command execution over ${connector}...', (t, connector) => {

    const testCmd = (cmdLine, responseType, isError = false) => {

        return aurora.queueCmd(cmdLine, connector)
            .then(cmd => assertCommand(t, cmd, responseType, isError))
            .catch(error => {

                if (isError) return Promise.resolve();

                return Promise.reject(error);

            });
    };

    resetTest();

    return Promise.resolve()
        .then(() => testCmd('os-info', 'object'))
        .then(() => testCmd('help', 'table'))
        .then(() => testCmd('sd-dir-read profiles', 'table'))
        .then(() => testCmd('asdf', 'object', true));

});

/*
auroraTest('usb', 'Testing MSD mode...', (t) => {

    return Promise.resolve()
        .then(() => aurora.attachMsd())
        .then(() => aurora.detachMsd())
        .then(() => {

            spiesCalled(t, ['msdConnectionChange', 'usbConnectionChange'], eventSpies);
            spiesNeverCalled(t, ['bluetoothConnectionChange'], eventSpies);

        }).then(() => aurora.connectUsb());

});

auroraTest('usb', 'Testing usb autoconnect...', (t) => {

    resetTest();

    return new Promise((resolve, reject) => {

        let connectionCount = 0;

        aurora.on('usbConnected', () => {

            switch (++connectionCount){

                case 1:
                    t.pass('Auto connected from disconnection state.');
                    aurora.attachMsd().then(() => aurora.detachMsd()).catch(reject);
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

auroraTest('any', 'Testing application firmware flashing over ${connector}...', (t, connector) => {

    resetTest();

    return aurora.flashFile('https://s3-us-west-1.amazonaws.com/aurora-firmware/v2.0.x/aurora-v2.0.4.hex').then(() => {

        t.pass('Aurora flash completed successfully.');

        spiesCalled(t, ['flashConnectionChange'], eventSpies);
        spiesNeverCalled(t, events, eventSpies, ['flashConnectionChange']);

    });

});

/*
auroraTest('any', 'Testing Aurora syncTime command over ${connector}...', (t, connector) => {

    return aurora.syncTime(connector);

});


auroraTest('any', 'Testing Aurora downloadFile command over ${connector}...', (t, connector) => {

    return aurora.downloadFile('profiles/rem-stim.prof', path.join(__dirname, 'rem-stim.prof'));

});


auroraTest('any', 'Testing Aurora uploadFile command over ${connector}...', (t, connector) => {

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

/*
auroraTest('any', 'Testing Aurora getProfiles and setProfiles command over ${connector}...', (t, connector) => {

    return aurora.getProfiles(connector).then((getCmd) => {

        getCmd.profiles.push(getCmd.profiles.slice()[0]);

        return aurora.setProfiles(getCmd.profiles, connector);

    });

});

auroraTest('any', 'Testing Aurora getSessions command over ${connector}...', (t, connector) => {

    return aurora.getSessions(connector).then((sessions) => {

        return Promise.all(sessions.map((session) => aurora.downloadSession(session, path.join(__dirname, 'sessions', session.name), connector)));

    }).catch(console.log);

});

 */



