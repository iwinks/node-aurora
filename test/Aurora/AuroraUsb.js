import test from 'tape';
import AuroraUsb from '../../lib/AuroraUsb';
import {LogTypeIds} from '../../lib/AuroraConstants';
import sinon from 'sinon';
import {spiesCalledOnceWith, spiesNeverCalledWith, spiesCalled, spiesNeverCalled} from '../util';

const auroraUsb = new AuroraUsb();

const events = [

    'connectionStateChange',
    'auroraEvent',
    'streamData',
    'log',
    'usbError',
    'cmdInputRequested',
    'cmdInputReady'
];

const eventSpies = {};

events.forEach(event => eventSpies[event] = new sinon.spy());

const resetTest = () => {

    auroraUsb.removeAllListeners();

    for (const event of events) {

        eventSpies[event].reset();
        auroraUsb.on(event, eventSpies[event]);
    }
};

const usbTests = [];
const usbTest = (name, runTest) => {

    usbTests.push( (t) => {

        new Promise((resolve, reject) => {

            t.test(name, (st) => {

                resetTest();

                runTest(st).then(resolve).catch(reject).then(() => st.end());

            });
        })
    });
};

test('Testing Aurora USB connector functionality...', t => {

    resetTest();

    Promise.resolve()
        .then(() => auroraUsb.connect())
        .then(() => auroraUsb.disconnect())
        .then(() => {

            t.pass(`Aurora connected over usb. Proceeding with usb connector tests.`);

            spiesCalledOnceWith(t, ['connectionStateChange'], eventSpies, ['connecting','idle', 'disconnected']);
            spiesNeverCalledWith(t, ['connectionStateChange'], eventSpies, ['busy']);

            usbTests.reduce((prevTest, nextTest) => {

                return prevTest.then(nextTest(t)).catch(t.fail);

            }, Promise.resolve());

        }).catch((e) => {
            console.log(e);
            t.pass('Could not establish usb connection to Aurora. Skipping usb tests.');

        }).then(() => {

            t.end();
        });

});


usbTest('Testing usb connector log events...', (t) => {

    return Promise.resolve()
        .then(() => auroraUsb.connect())
        .then(() => auroraUsb.writeCmd(`log-message ${LogTypeIds.ERROR} "Oops, false alarm..."`))
        .then(() => auroraUsb.disconnect())
        .then(() => {

            spiesCalled(t, ['log','connectionStateChange'], eventSpies);
            spiesNeverCalled(t, events, eventSpies, ['log','connectionStateChange']);

        });

});