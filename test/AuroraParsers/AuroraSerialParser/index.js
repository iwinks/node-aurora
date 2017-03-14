import test from 'tape';
import fs from 'fs';
import sinon from 'sinon';
import pick from 'lodash/pick';
import path from 'path';
import readline from 'readline';
import AuroraSerialParser from '../../../lib/AuroraSerialParser';
import {spiesCalledOnce, spiesNeverCalled} from '../../util';
import { auroraEventMatcher, logMatcher, streamDataMatcher} from './SerialSinonMatchers';

const cmdResponseSuccess = {
    command: 'os-info',
    error: false,
    response: {
        versionString: 'v1.0.1',
        version: 10001,
        board: 'iWinks Aurora v1 rev3',
        buildDate: +(new Date(2017,0,1,5,5,5)),
        bytesFree: 5555,
        batteryLevel: 100,
        runningTime: '5.20 h',
        profile: 'None',
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

const cmdResponseWithOutput = Object.assign({}, cmdResponseSuccess, {
    output: 'abcdefghijklmnopqrstuvwxyz\r\nABCDEFGHIJKLMNOPQRSTUVWXYZ'
});

const cmdResponseWithInput = Object.assign({}, cmdResponseSuccess, {
    input: 'abcdefghijklmnopqrstuvwxyz\r\nABCDEFGHIJKLMNOPQRSTUVWXYZ'
});

const events = [
    'cmdResponse',
    'cmdInputRequested',
    'auroraEvent',
    'log',
    'streamData',
    'parseError'
];

const eventSpies = {};

events.forEach(event => eventSpies[event] = new sinon.spy());

const serialTest = (name, inputFile, runTest) => {

    test(name, (t) => {

        const parser = new AuroraSerialParser();

        for (const event of events) {

            eventSpies[event].reset();
            parser.on(event, eventSpies[event]);
        }

        const lineReader = readline.createInterface({
            input: fs.createReadStream(path.join(__dirname, inputFile))
        });

        let lineCount = 0;

        lineReader.on('line', line => {
            parser.parseLine(line);
            if (line.trim()){
                lineCount++;
            }
        });

        lineReader.on('close', () => {

            runTest(t, lineCount);

        });
    });
};

serialTest('Testing command response serial parsing (success case)...', 'SerialCmdResponseSuccess.mock', (t) => {

    spiesCalledOnce(t, ['cmdResponse'], eventSpies);

    if (eventSpies.cmdResponse.calledOnce) {
        const filteredResponse = pick(eventSpies.cmdResponse.args[0][0], Object.keys(cmdResponseSuccess));
        t.deepEqual(cmdResponseSuccess, filteredResponse, "'cmdResponse' event received correct response.");
    }

    spiesNeverCalled(t, events, eventSpies, ['cmdResponse']);

    t.end();
});

serialTest('Testing command response serial parsing (error case)...', 'SerialCmdResponseError.mock', (t) => {

    spiesCalledOnce(t, ['cmdResponse'], eventSpies);

    if (eventSpies.cmdResponse.calledOnce) {
        const filteredResponse = pick(eventSpies.cmdResponse.args[0][0], Object.keys(cmdResponseError));
        t.deepEqual(cmdResponseError, filteredResponse, "'cmdResponse' event received correct response.");
    }

    spiesNeverCalled(t, events, eventSpies, ['cmdResponse']);

    t.end();
});


serialTest('Testing command response serial parsing (timeout case)...', 'SerialCmdResponseTimeout.mock', (t) => {

    setTimeout(() => {

        spiesCalledOnce(t, ['cmdResponse'], eventSpies);

        if (eventSpies.cmdResponse.calledOnce) {
            t.assert(eventSpies.cmdResponse.args[0][0].error && eventSpies.cmdResponse.args[0][0].response.error, "'cmdResponse' event received correct response.");
        }

        spiesNeverCalled(t, events, eventSpies, ['cmdResponse']);

        t.end();

    }, 2000);

});


serialTest('Testing log response serial parsing...', 'SerialLog.mock', (t, lineCount) => {

    t.assert(eventSpies.log.callCount == lineCount, `'log' event fired ${lineCount} times.`);

    t.assert(eventSpies.log.alwaysCalledWithExactly(logMatcher()), "'log' event received correct arguments.");

    spiesNeverCalled(t, events, eventSpies, ['log']);

    t.end();

});

serialTest('Testing aurora event response serial parsing...', 'SerialAuroraEvent.mock', (t, lineCount) => {

    t.assert(eventSpies.auroraEvent.callCount == lineCount, `'auroraEvent' event fired ${lineCount} times.`);

    t.assert(eventSpies.auroraEvent.alwaysCalledWithExactly(auroraEventMatcher(10)), "'auroraEvent' event received correct arguments.");

    spiesNeverCalled(t, events, eventSpies, ['auroraEvent']);

    t.end();

});

serialTest('Testing data response serial parsing...', 'SerialStreamData.mock', (t, lineCount) => {

    t.assert(eventSpies.streamData.callCount == lineCount, `'streamData' event fired ${lineCount} times.`);

    t.assert(eventSpies.streamData.alwaysCalledWithExactly(streamDataMatcher()), "'streamData' event received correct arguments.");

    spiesNeverCalled(t, events, eventSpies, ['streamData']);

    t.end();

});

serialTest('Testing serial parse error...', 'SerialParseError.mock', (t, lineCount) => {

    t.assert(eventSpies.parseError.callCount == lineCount, `'parseError' event fired ${lineCount} times.`);

    spiesNeverCalled(t, events, eventSpies, ['parseError']);

    t.end();

});

serialTest('Testing serial parsing of command with output response...', 'SerialCmdResponseWithOutput.mock', (t) => {

    spiesCalledOnce(t, ['cmdResponse'], eventSpies);

    if (eventSpies.cmdResponse.calledOnce) {
        const filteredResponse = pick(eventSpies.cmdResponse.args[0][0], Object.keys(cmdResponseWithOutput));
        t.deepEqual(cmdResponseWithOutput, filteredResponse, "'cmdResponse' event received correct response with output.");
    }

    spiesNeverCalled(t, events, eventSpies, ['cmdResponse']);

    t.end();

});

serialTest('Testing serial parsing of command with input response...', 'SerialCmdResponseWithInput.mock', (t) => {

    spiesCalledOnce(t, ['cmdResponse','cmdInputRequested'], eventSpies);

    if (eventSpies.cmdResponse.calledOnce) {
        const filteredResponse = pick(eventSpies.cmdResponse.args[0][0], Object.keys(cmdResponseWithInput));
        t.deepEqual(cmdResponseWithInput, filteredResponse, "'cmdResponse' event received correct response with input.");
    }

    spiesNeverCalled(t, events, eventSpies, ['cmdResponse','cmdInputRequested']);

    t.end();

});


serialTest('Testing serial parsing of the perfect storm...', 'SerialKitchenSink.mock', (t) => {

    const {cmdResponse, log, auroraEvent, streamData} = eventSpies;

    t.assert(cmdResponse.callCount == 4, "'cmdResponse' event fired four times.");

    let filteredResponse;

    if (cmdResponse.callCount == 4) {

        //1st call success
        filteredResponse = pick(cmdResponse.args[0][0], Object.keys(cmdResponseSuccess));
        t.deepEqual(cmdResponseSuccess, filteredResponse, "'cmdResponse' event received first correct response.");

        //2nd call success w/data
        filteredResponse = pick(cmdResponse.args[1][0], Object.keys(cmdResponseWithOutput));
        t.deepEqual(cmdResponseWithOutput, filteredResponse, "'cmdResponse' event received correct success response with output.");

        //3rd call error
        filteredResponse = pick(cmdResponse.args[2][0], Object.keys(cmdResponseError));
        t.deepEqual(cmdResponseError, filteredResponse, "'cmdResponse' event received first incorrect response.");

        //4th call contains table w/ input
        const fourthSuccess = cmdResponse.args[3][0];
        t.assert(fourthSuccess.error === false && Array.isArray(fourthSuccess.response) && typeof fourthSuccess.response[0] == 'object', "'cmdResponse' event received last correct response.");
        t.assert(fourthSuccess.input === cmdResponseWithInput.input, "'cmdResponse' event received correct input with response.");
    }

    t.assert(log.callCount == 5, "'log' event fired 5 times.");
    t.assert(log.alwaysCalledWithExactly(logMatcher()), "'log' event received correct arguments.");

    t.assert(auroraEvent.callCount == 5, "'auroraEvent' event fired 5 times.");
    t.assert(auroraEvent.alwaysCalledWithExactly(auroraEventMatcher(10)), "'auroraEvent' event received correct arguments.");

    t.assert(streamData.callCount == 5, "'streamData' event fired 5 times.");
    t.assert(streamData.alwaysCalledWithExactly(streamDataMatcher()), "'streamData' event received correct arguments.");

    spiesNeverCalled(t, ['parseError'], eventSpies);

    t.end();

});