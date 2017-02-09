import test from 'tape';
import fs from 'fs';
import sinon from 'sinon';
import pick from 'lodash/pick';
import path from 'path';
import readline from 'readline';
import {LogTypes} from '../../src/AuroraConstants';
import AuroraSerialParser from '../../src/AuroraSerialParser';

import { oneOfMatcher, auroraEventMatcher, logMatcher, dataMatcher} from './SerialSinonMatchers';

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
    output: 'abcdefghijklmnopqrstuvwxyz'
});

const cmdResponseSpy = sinon.spy();
const auroraEventSpy = sinon.spy();
const logSpy = sinon.spy();
const streamDataSpy = sinon.spy();
const unknownResponseSpy = sinon.spy();

const serialTest = function(name, inputFile, runTest) {

    test(name, t => {

        cmdResponseSpy.reset();
        auroraEventSpy.reset();
        logSpy.reset();
        streamDataSpy.reset();
        unknownResponseSpy.reset();

        const parser = new AuroraSerialParser();

        parser.on('commandResponse', cmdResponseSpy);
        parser.on('auroraEvent', auroraEventSpy);
        parser.on('log', logSpy);
        parser.on('streamData', streamDataSpy);
        parser.on('unknownResponse', unknownResponseSpy);

        const lineReader = readline.createInterface({
            input: fs.createReadStream(path.join(__dirname, inputFile))
        });


        lineReader.on('line', line => parser.parseLine(line));

        lineReader.on('close', () => {

            runTest(t);

            t.end();

            parser.removeAllListeners();

        });
    });
};

serialTest('Testing command response parsing (success case)...', 'SerialCmdResponseSuccess.mock', t => {

    t.assert(cmdResponseSpy.calledOnce, "'commandResponse' event fired once.");
    const filteredResponse = pick(cmdResponseSpy.args[0][0], Object.keys(cmdResponseSuccess));
    t.deepEqual(cmdResponseSuccess, filteredResponse, "'commandResponse' event received correct response.");

    t.assert(!auroraEventSpy.called, "'auroraEvent' event not fired.");
    t.assert(!logSpy.called, "'log' event not fired.");
    t.assert(!streamDataSpy.called, "'streamData' event not fired.");
    t.assert(!unknownResponseSpy.called, "'unknownResponse' event not fired.");
});

serialTest('Testing command response parsing (error case)...', 'SerialcmdResponseError.mock', t => {

    t.assert(cmdResponseSpy.calledOnce, "'commandResponse' event fired once.");
    const filteredResponse = pick(cmdResponseSpy.args[0][0], Object.keys(cmdResponseError));
    t.deepEqual(cmdResponseError, filteredResponse, "'commandResponse' event received correct response.");

    t.assert(!auroraEventSpy.called, "'auroraEvent' event not fired.");
    t.assert(!logSpy.called, "'log' event not fired.");
    t.assert(!streamDataSpy.called, "'streamData' event not fired.");
    t.assert(!unknownResponseSpy.called, "'unknownResponse' event not fired.");

});

serialTest('Testing log response parsing...', 'SerialLog.mock', t => {

    t.assert(logSpy.callCount == 5, "'log' event fired 5 times.");

    t.assert(logSpy.alwaysCalledWithExactly(oneOfMatcher(Object.values(LogTypes)), logMatcher(logSpy.args), sinon.match.date), "'log' event received correct arguments.");

    t.assert(!cmdResponseSpy.called, "'commandResponse' event not fired.");
    t.assert(!auroraEventSpy.called, "'auroraEvent' event not fired.");
    t.assert(!streamDataSpy.called, "'streamData' event not fired.");
    t.assert(!unknownResponseSpy.called, "'unknownResponse' event not fired.");

});

serialTest('Testing aurora event response parsing...', 'SerialAuroraEvent.mock', t => {

    t.assert(auroraEventSpy.callCount == 5, "'auroraEvent' event fired 5 times.");

    t.assert(auroraEventSpy.alwaysCalledWithExactly(auroraEventMatcher(auroraEventSpy.args, 11), sinon.match.number), "'auroraEvent' event received correct arguments.");

    t.assert(!cmdResponseSpy.called, "'commandResponse' event not fired.");
    t.assert(!logSpy.called, "'log' event not fired.");
    t.assert(!streamDataSpy.called, "'streamData' event not fired.");
    t.assert(!unknownResponseSpy.called, "'unknownResponse' event not fired.");

});

serialTest('Testing data response...', 'SerialStreamData.mock', t => {

    t.assert(streamDataSpy.callCount == 5, "'streamData' event fired 5 times.");

    t.assert(streamDataSpy.alwaysCalledWithExactly("eeg", dataMatcher()), "'streamData' event received correct arguments.");

    t.assert(!cmdResponseSpy.called, "'commandResponse' event not fired.");
    t.assert(!logSpy.called, "'log' event not fired.");
    t.assert(!auroraEventSpy.called, "'auroraEvent' event not fired.");
    t.assert(!unknownResponseSpy.called, "'unknownResponse' event not fired.");

});

serialTest('Testing unknown response...', 'SerialUnknownResponse.mock', t => {

    t.assert(unknownResponseSpy.callCount == 5, "'responseUnknown' event fired 5 times.");

    t.assert(!cmdResponseSpy.called, "'commandResponse' event not fired.");
    t.assert(!logSpy.called, "'log' event not fired.");
    t.assert(!streamDataSpy.called, "'streamData' event not fired.");
    t.assert(!auroraEventSpy.called, "'auroraEvent' event not fired.");

});

serialTest('Testing command with output response...', 'SerialCmdResponseWithOutput.mock', t => {

    t.assert(cmdResponseSpy.calledOnce, "'commandResponse' event fired once.");

    t.assert(cmdResponseSpy.calledOnce, "'commandResponse' event fired once.");
    const filteredResponse = pick(cmdResponseSpy.args[0][0], Object.keys(cmdResponseWithOutput));
    t.deepEqual(cmdResponseWithOutput, filteredResponse, "'commandResponse' event received correct response.");

    t.assert(!auroraEventSpy.called, "'auroraEvent' event not fired.");
    t.assert(!logSpy.called, "'log' event not fired.");
    t.assert(!streamDataSpy.called, "'streamData' event not fired.");
    t.assert(!unknownResponseSpy.called, "'unknownResponse' event not fired.");

});


serialTest('Testing the perfect storm...', 'SerialKitchenSink.mock', t => {

    t.assert(cmdResponseSpy.callCount == 4, "'commandResponse' event fired four times.");

    let filteredResponse;

    //1st and 4th call, success
    filteredResponse = pick(cmdResponseSpy.args[0][0], Object.keys(cmdResponseSuccess));
    t.deepEqual(cmdResponseSuccess, filteredResponse, "'commandResponse' event received first correct response.");
    filteredResponse = pick(cmdResponseSpy.args[3][0], Object.keys(cmdResponseSuccess));
    t.deepEqual(cmdResponseSuccess, filteredResponse, "'commandResponse' event received last correct response.");

    //2nd call w/data
    filteredResponse = pick(cmdResponseSpy.args[1][0], Object.keys(cmdResponseWithOutput));
    t.deepEqual(cmdResponseWithOutput, filteredResponse, "'commandResponse' event received correct success response without output.");

    //3rd call error
    filteredResponse = pick(cmdResponseSpy.args[2][0], Object.keys(cmdResponseError));
    t.deepEqual(cmdResponseError, filteredResponse, "'commandResponse' event received first incorrect response.");


    t.assert(logSpy.callCount == 5, "'log' event fired 5 times.");
    t.assert(logSpy.alwaysCalledWithExactly(oneOfMatcher(Object.values(LogTypes)), logMatcher(logSpy.args), sinon.match.date), "'log' event received correct arguments.");

    t.assert(auroraEventSpy.callCount == 5, "'auroraEvent' event fired 5 times.");
    t.assert(auroraEventSpy.alwaysCalledWithExactly(auroraEventMatcher(auroraEventSpy.args, 11), sinon.match.number), "'auroraEvent' event received correct arguments.");

    t.assert(streamDataSpy.callCount == 5, "'streamData' event fired 5 times.");
    t.assert(streamDataSpy.alwaysCalledWithExactly("eeg", dataMatcher()), "'streamData' event received correct arguments.");

    t.assert(!unknownResponseSpy.called, "'unknownResponse' event not fired.");

});