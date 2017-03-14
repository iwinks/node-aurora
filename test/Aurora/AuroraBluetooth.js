import test from 'tape';
import AuroraBluetooth from '../../lib/AuroraBluetooth';
import sinon from 'sinon';
import {spiesCalledOnceWith, spiesNeverCalledWith} from '../util';

const auroraBluetooth = new AuroraBluetooth();

const events = [

    'connectionStateChange',
    'auroraEvent',
    'streamData',
    'bluetoothError',
];

const eventSpies = {};

events.forEach(event => eventSpies[event] = new sinon.spy());

const resetTest = () => {

    auroraBluetooth.removeAllListeners();

    for (const event of events) {

        eventSpies[event].reset();
        auroraBluetooth.on(event, eventSpies[event]);
    }
};

const bluetoothTests = [];
const bluetoothTest = (name, runTest) => {

    bluetoothTests.push( (t) => {

        new Promise((resolve, reject) => {

            t.test(name, (st) => {

                resetTest();

                runTest(st).then(resolve).catch(reject).then(() => st.end());

            });
        })
    });
};

test('Testing Aurora bluetooth connector functionality...', t => {

    resetTest();

    Promise.resolve()
        .then(() => auroraBluetooth.connect())
        .then(() => auroraBluetooth.disconnect())
        .then(() => {

        t.pass(`Aurora connected over bluetooth. Proceeding with bluetooth connector tests.`);

        spiesCalledOnceWith(t, ['connectionStateChange'], eventSpies, ['connecting','idle', 'disconnected']);
        spiesNeverCalledWith(t, ['connectionStateChange'], eventSpies, ['busy']);

        bluetoothTests.reduce((prevTest, nextTest) => {

            return prevTest.then(nextTest(t)).catch(t.fail);

        }, Promise.resolve());

    }).catch(() => {

        t.pass('Could not establish bluetooth connection to Aurora. Skipping bluetooth tests.');

    }).then(() => {

        t.end();
    });

});