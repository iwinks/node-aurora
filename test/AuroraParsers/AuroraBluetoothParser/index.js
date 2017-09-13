import test from 'tape';
import sinon from 'sinon';
import pick from 'lodash/pick';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import AuroraBluetoothParser from '../../../lib/AuroraBluetoothParser';
import { auroraEventMatcher, streamDataMatcher } from './BluetoothSinonMatchers';
import {spiesCalled, spiesCalledOnce, spiesNeverCalled} from '../../util';
import {BleCmdStates} from '../../../lib/AuroraConstants';
import moment from 'moment';

const cmdResponseSuccess = {
    command: 'os-info',
    error: false,
    response: {
        versionString: 'v1.0.1',
        version: 10001,
        board: 'iWinks Aurora v1 rev3',
        buildDate: Date.UTC(2017,0,1,5,5,5),
        bytesFree: 5555,
        batteryLevel: 100,
        runningTime: '5.20 h',
        profile: false,
        debugMode: false
    }
};

const cmdResponseError = {
    command: 'command-error',
    error: true,
    response: {
        error: -1,
        message: 'Command failed.'
    }
};

const events = [
    'cmdResponse',
    'cmdInputRequested',
    'cmdResponseRead',
    'cmdOutputReady',
    'auroraEvent',
    'streamData',
    'parseError'
];

const eventSpies = {};

events.forEach(event => eventSpies[event] = new sinon.spy());

const parser = new AuroraBluetoothParser();

const bluetoothTest = (name, inputFile, runTest) => {

    test(name, t => {

        parser.reset();
        parser.removeAllListeners();

        for (const event of events) {

            eventSpies[event].reset();
            parser.on(event, eventSpies[event]);
        }


        const lineReader = readline.createInterface({
            input: fs.createReadStream(path.join(__dirname, inputFile))
        });

        let lineCount = 0;
        lineReader.on('line', line => {

            if (!line.trim()) return;

            lineCount++;

            const lineParts = line.split(':');
            const type = lineParts.shift();
            const response = Buffer.from(lineParts.join(':'));

            switch (type) {

                case 'command':
                    parser.setCmd(lineParts[0]);
                    break;

                case 'object':
                    parser.onCmdStatusCharNotification(Buffer.from([BleCmdStates.CMD_RESP_OBJECT_READY, response.length]));
                    parser._cmdDataReceiveResponseObject(response);
                    break;

                case 'table':
                    parser.onCmdStatusCharNotification(Buffer.from([BleCmdStates.CMD_RESP_TABLE_READY, response.length]));
                    parser._cmdDataReceiveResponseTable(response);
                    break;

                case 'output':
                    parser.onCmdOutputCharNotification(response);
                    break;

                case 'input':
                    parser.onCmdStatusCharNotification(Buffer.from([BleCmdStates.CMD_INPUT_REQUESTED]));
                    break;

                case 'status':
                    parser.onCmdStatusCharNotification(Buffer.from(lineParts[0].split(',').map(Number)));
                    break;

                case 'event':
                    parser.onAuroraEventCharNotification(Buffer.from(lineParts[0].split(',').map(Number)));
                    break;

                case 'data':
                    parser.onStreamDataCharNotification(Buffer.from(lineParts[0].split(',').map(Number)));
                    break;

                default:
                    console.log('type',type);
                    throw new Error('Invalid mock file.');

            }


        });

        lineReader.on('close', () => {

            runTest(t, lineCount);

        });
    });
};

bluetoothTest('Testing command response bluetooth parsing (success case)...', 'BluetoothCmdResponseSuccess.mock', t => {

    spiesCalledOnce(t, ['cmdResponse'], eventSpies);
    spiesCalled(t, ['cmdResponseRead'], eventSpies);

    if (eventSpies.cmdResponse.calledOnce) {
        const filteredResponse = pick(eventSpies.cmdResponse.args[0][0], Object.keys(cmdResponseSuccess));
        t.deepEqual(cmdResponseSuccess, filteredResponse, "'cmdResponse' event received correct response.");
    }

    spiesNeverCalled(t, events, eventSpies, ['cmdResponse','cmdResponseRead']);

    t.end();
});


bluetoothTest('Testing command response bluetooth parsing (error case)...', 'BluetoothCmdResponseError.mock', t => {

    spiesCalledOnce(t, ['cmdResponse'], eventSpies);
    spiesCalled(t, ['cmdResponseRead'], eventSpies);

    if (eventSpies.cmdResponse.calledOnce) {
        const filteredResponse = pick(eventSpies.cmdResponse.args[0][0], Object.keys(cmdResponseError));
        t.deepEqual(cmdResponseError, filteredResponse, "'cmdResponse' event received correct response.");
    }

    spiesNeverCalled(t, events, eventSpies, ['cmdResponse','cmdResponseRead']);

    t.end();
});


bluetoothTest('Testing command response bluetooth parsing (timeout case)...', 'BluetoothCmdResponseTimeout.mock', t => {

    setTimeout(() => {

        spiesCalledOnce(t, ['cmdResponse'], eventSpies);
        spiesCalled(t, ['cmdResponseRead'], eventSpies);

        if (eventSpies.cmdResponse.calledOnce) {
            t.assert(eventSpies.cmdResponse.args[0][0].error && eventSpies.cmdResponse.args[0][0].response.error, "'cmdResponse' event received correct response.");
        }

        spiesNeverCalled(t, events, eventSpies, ['cmdResponse','cmdResponseRead']);

        t.end();

    }, 10000);

});

bluetoothTest('Testing aurora event response bluetooth parsing...', 'BluetoothAuroraEvent.mock', (t, lineCount) => {

    t.assert(eventSpies.auroraEvent.callCount == lineCount, `'auroraEvent' event fired ${lineCount} times.`);

    t.assert(eventSpies.auroraEvent.alwaysCalledWithExactly(auroraEventMatcher(10)), "'auroraEvent' event received correct arguments.");

    spiesNeverCalled(t, events, eventSpies, ['auroraEvent']);

    t.end();

});

bluetoothTest('Testing data response bluetooth parsing...', 'BluetoothStreamData.mock', (t, lineCount) => {

    t.assert(eventSpies.streamData.callCount == lineCount*2, `'streamData' event fired ${lineCount*2} times.`);

    t.assert(eventSpies.streamData.alwaysCalledWithExactly(streamDataMatcher()), "'streamData' event received correct arguments.");

    spiesNeverCalled(t, events, eventSpies, ['streamData']);

    t.end();

});

bluetoothTest('Testing bluetooth parse error...', 'BluetoothParseError.mock', (t, lineCount) => {

    t.assert(eventSpies.parseError.callCount == lineCount, `'parseError' event fired ${lineCount} times.`);

    spiesNeverCalled(t, events, eventSpies, ['parseError']);

    t.end();

});

bluetoothTest('Testing bluetooth parsing of command with output response...', 'BluetoothCmdResponseWithOutput.mock', t => {

    spiesCalledOnce(t, ['cmdResponse'], eventSpies);
    spiesCalled(t, ['cmdResponseRead','cmdOutputReady'], eventSpies);

    if (eventSpies.cmdResponse.calledOnce) {
        const filteredResponse = pick(eventSpies.cmdResponse.args[0][0], Object.keys(cmdResponseSuccess));
        t.deepEqual(cmdResponseSuccess, filteredResponse, "'cmdResponse' event received correct response.");
    }

    spiesNeverCalled(t, events, eventSpies, ['cmdResponse','cmdResponseRead','cmdOutputReady']);

    t.end();

});


bluetoothTest('Testing bluetooth parsing of command with input response...', 'BluetoothCmdResponseWithInput.mock', t => {

    spiesCalledOnce(t, ['cmdResponse'], eventSpies);
    spiesCalled(t, ['cmdResponseRead','cmdInputRequested'], eventSpies);

    if (eventSpies.cmdResponse.calledOnce) {
        const filteredResponse = pick(eventSpies.cmdResponse.args[0][0], Object.keys(cmdResponseSuccess));
        t.deepEqual(cmdResponseSuccess, filteredResponse, "'cmdResponse' event received correct response.");
    }

    spiesNeverCalled(t, events, eventSpies, ['cmdResponse','cmdResponseRead','cmdInputRequested']);

    t.end();

});


bluetoothTest('Testing bluetooth parsing of the perfect storm...', 'BluetoothKitchenSink.mock', t => {

    const {cmdResponse, auroraEvent, streamData} = eventSpies;

    t.assert(cmdResponse.callCount == 4, "'cmdResponse' event fired four times.");

    spiesCalled(t, ['cmdResponseRead','cmdInputRequested','cmdOutputReady'], eventSpies);

    let filteredResponse;

    //1st call success
    if (cmdResponse.callCount == 4) {

        filteredResponse = pick(cmdResponse.args[0][0], Object.keys(cmdResponseSuccess));
        t.deepEqual(cmdResponseSuccess, filteredResponse, "'cmdResponse' event received first correct response.");

        //2nd call success w/data
        filteredResponse = pick(cmdResponse.args[1][0], Object.keys(cmdResponseSuccess));
        t.deepEqual(cmdResponseSuccess, filteredResponse, "'cmdResponse' event received correct success response without output.");

        //3rd call error
        filteredResponse = pick(cmdResponse.args[2][0], Object.keys(cmdResponseError));
        t.deepEqual(cmdResponseError, filteredResponse, "'cmdResponse' event received first incorrect response.");

        //4th call contains table
        const fourthSuccess = cmdResponse.args[3][0];
        t.assert(fourthSuccess.error === false && Array.isArray(fourthSuccess.response) && typeof fourthSuccess.response[0] == 'object', "'cmdResponse' event received last correct response.");
    }

    t.assert(auroraEvent.callCount == 5, "'auroraEvent' event fired 5 times.");
    t.assert(auroraEvent.alwaysCalledWithExactly(auroraEventMatcher(10)), "'auroraEvent' event received correct arguments.");

    t.assert(streamData.callCount == 6, "'streamData' event fired 6 times.");
    t.assert(streamData.alwaysCalledWithExactly(streamDataMatcher()), "'streamData' event received correct arguments.");

    spiesNeverCalled(t, ['parseError'], eventSpies);

    t.end();

});