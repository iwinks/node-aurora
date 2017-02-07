import test from 'tape';
import fs from 'fs';
import sinon from 'sinon';

import AuroraResponseSerialParser from '../lib/AuroraResponseSerialParser';
import AuroraConstants from '../lib/AuroraConstants';

import { oneOfMatcher, bufferMatcher, eventMatcher, logMatcher, dataMatcher} from './SinonMatchers';


test('Testing success response parsing...', (t) => {

    const serialStream = fs.createReadStream('./test/ResponseSuccess.mock', { highWaterMark: 100000});

    const commandBeginSpy = sinon.spy();
    const commandEndSpy = sinon.spy();
    const responseSuccessSpy = sinon.spy();
    const responseErrorSpy = sinon.spy();
    const packetSuccessSpy = sinon.spy();
    const packetErrorSpy = sinon.spy();


    AuroraResponseSerialParser.on('commandBegin', commandBeginSpy);
    AuroraResponseSerialParser.on('commandEnd', commandEndSpy);


    //AuroraResponseSerialParser.on('response', (resp) => t.comment('response: ' + resp));
    AuroraResponseSerialParser.on('responseSuccess', responseSuccessSpy);
    AuroraResponseSerialParser.on('responseError', responseErrorSpy);
    AuroraResponseSerialParser.on('packetSuccess', packetSuccessSpy);
    AuroraResponseSerialParser.on('packetError', packetErrorSpy);

    serialStream.on('data', (responseBuffer) => {
        AuroraResponseSerialParser.parseChunk(responseBuffer);
    });

    serialStream.on('end', () => {

        t.assert(commandBeginSpy.calledOnce, "'commandBegin' event fired once.");
        t.assert(commandBeginSpy.alwaysCalledWithExactly('command-success'), "'commandBegin' event fired with correct command name.");

        t.assert(responseSuccessSpy.calledOnce, "'responseSuccess' event fired once.");
        t.assert(responseSuccessSpy.alwaysCalledWithExactly(bufferMatcher('success')), "'responseSuccess' event received correct response.");

        t.assert(!responseErrorSpy.called, "'responseError' event not fired.");
        t.assert(!packetErrorSpy.called, "'packetError' event not fired.");
        t.assert(!packetSuccessSpy.called, "'packetSuccess' event not fired.");
        t.assert(!packetSuccessSpy.called, "'packetSuccess' event not fired.");

        
        t.assert(commandEndSpy.calledOnce, "'commandEnd' event fired once.");
        t.assert(commandEndSpy.alwaysCalledWithExactly(false), "'commandEnd' event parameter indicated no error.");

        t.end();

        AuroraResponseSerialParser.removeAllListeners();

    });

});


test('Testing error response parsing...', (t) => {

    const serialStream = fs.createReadStream('./test/ResponseError.mock', {highWaterMark: 100000});

    const commandBeginSpy = sinon.spy();
    const commandEndSpy = sinon.spy();
    const responseSuccessSpy = sinon.spy();
    const responseErrorSpy = sinon.spy();
    const packetSuccessSpy = sinon.spy();
    const packetErrorSpy = sinon.spy();

    AuroraResponseSerialParser.on('commandBegin', commandBeginSpy);
    AuroraResponseSerialParser.on('commandEnd', commandEndSpy);

    //AuroraResponseSerialParser.on('response', (resp) => t.comment('response: ' + resp));
    AuroraResponseSerialParser.on('responseSuccess', responseSuccessSpy);
    AuroraResponseSerialParser.on('responseError', responseErrorSpy);
    AuroraResponseSerialParser.on('packetSuccess', packetSuccessSpy);
    AuroraResponseSerialParser.on('packetError', packetErrorSpy);

    serialStream.on('data', (responseBuffer) => {
        AuroraResponseSerialParser.parseChunk(responseBuffer);
    });

    serialStream.on('end', () => {

        t.assert(commandBeginSpy.calledOnce, "'commandBegin' event fired once.");
        t.assert(commandBeginSpy.alwaysCalledWithExactly('command-error'), "'commandBegin' event fired with correct command name.");

        t.assert(responseErrorSpy.calledOnce, "'responseError' event fired once.");
        t.assert(responseErrorSpy.alwaysCalledWithExactly(bufferMatcher('error')), "'responseError' event received correct response.");

        t.assert(!responseSuccessSpy.called, "'responseSuccess' event not fired.");
        t.assert(!packetSuccessSpy.called, "'packetSuccess' event not fired.");
        t.assert(!packetErrorSpy.called, "'packetError' event not fired.");

        t.assert(commandEndSpy.calledOnce, "'commandEnd' event fired once.");
        t.assert(commandEndSpy.alwaysCalledWithExactly(true), "'commandEnd' event parameter indicated an error ocurred.");

        t.end();

        AuroraResponseSerialParser.removeAllListeners();

    });
});

test('Testing packet mode success response parsing...', (t) => {

    const serialStream = fs.createReadStream('./test/PacketModeShort.mock', {highWaterMark: 100000});

    const commandBeginSpy = sinon.spy();
    const commandEndSpy = sinon.spy();
    const responseSuccessSpy = sinon.spy();
    const responseErrorSpy = sinon.spy();
    const packetSuccessSpy = sinon.spy();
    const packetErrorSpy = sinon.spy();

    AuroraResponseSerialParser.on('commandBegin', commandBeginSpy);
    AuroraResponseSerialParser.on('commandEnd', commandEndSpy);

    AuroraResponseSerialParser.on('responseSuccess', (resp) => t.comment('response: ' + resp));
    AuroraResponseSerialParser.on('responseSuccess', responseSuccessSpy);
    AuroraResponseSerialParser.on('responseError', responseErrorSpy);
    AuroraResponseSerialParser.on('packetSuccess', packetSuccessSpy);
    AuroraResponseSerialParser.on('packetError', packetErrorSpy);

    serialStream.on('data', (responseBuffer) => {
        AuroraResponseSerialParser.parseChunk(responseBuffer);
    });

    serialStream.on('end', () => {

        t.assert(commandBeginSpy.calledOnce, "'commandBegin' event fired once.");
        t.assert(commandBeginSpy.alwaysCalledWithExactly('command-with-packet-mode'), "'commandBegin' event fired with correct command name.");

        t.assert(packetSuccessSpy.calledOnce, "'packetSuccess' event fired once.");
        //t.assert(responseSuccessSpy.alwaysCalledWithExactly(bufferMatcher('success')), "'responseSuccess' event received correct response.");

        t.assert(!responseSuccessSpy.called, "'responseSuccess' event not fired.");
        t.assert(!responseErrorSpy.called, "'responseError' event not fired.");
        t.assert(!packetErrorSpy.called, "'packetError' event not fired.");

        t.assert(commandEndSpy.calledOnce, "'commandEnd' event fired once.");
        t.assert(commandEndSpy.alwaysCalledWithExactly(false), "'commandEnd' event parameter indicated no error.");

        t.end();

        AuroraResponseSerialParser.removeAllListeners();

    });
});

test('Testing packet mode success response with retry parsing...', (t) => {

    const serialStream = fs.createReadStream('./test/PacketModeRetryShort.mock', {highWaterMark: 100000});

    const commandBeginSpy = sinon.spy();
    const commandEndSpy = sinon.spy();
    const responseSuccessSpy = sinon.spy();
    const responseErrorSpy = sinon.spy();
    const packetSuccessSpy = sinon.spy();
    const packetErrorSpy = sinon.spy();

    AuroraResponseSerialParser.on('commandBegin', commandBeginSpy);
    AuroraResponseSerialParser.on('commandEnd', commandEndSpy);

    AuroraResponseSerialParser.on('responseSuccess', (resp) => t.comment('response: ' + resp));
    AuroraResponseSerialParser.on('responseSuccess', responseSuccessSpy);
    AuroraResponseSerialParser.on('responseError', responseErrorSpy);
    AuroraResponseSerialParser.on('packetSuccess', packetSuccessSpy);
    AuroraResponseSerialParser.on('packetError', packetErrorSpy);

    serialStream.on('data', (responseBuffer) => {
        AuroraResponseSerialParser.parseChunk(responseBuffer);
    });

    serialStream.on('end', () => {

        t.assert(commandBeginSpy.calledOnce, "'commandBegin' event fired once.");
        t.assert(commandBeginSpy.alwaysCalledWithExactly('command-with-packet-mode'), "'commandBegin' event fired with correct command name.");
    
        t.assert(packetSuccessSpy.calledOnce, "'packetSuccess' event fired once.");
        
        //t.assert(responseSuccessSpy.alwaysCalledWithExactly(bufferMatcher('success')), "'responseSuccess' event received correct response.");
    
        t.assert(!responseSuccessSpy.called, "'responseSuccess' event not fired.");
        t.assert(!responseErrorSpy.called, "'responseError' event not fired.");
        
        t.assert(packetErrorSpy.calledOnce, "'packetError' event fired once.");
        t.assert(commandEndSpy.calledOnce, "'commandEnd' event fired once.");
        t.assert(commandEndSpy.alwaysCalledWithExactly(false), "'commandEnd' event parameter indicated no error.");

        t.end();

        AuroraResponseSerialParser.removeAllListeners();

    });
});

test('Testing log response...', (t) => {
    
    const serialStream = fs.createReadStream('./test/ResponseLog.mock', {highWaterMark: 100000});
    
    const logSpy = sinon.spy();
    const responseUnknownSpy = sinon.spy();

    const logTypeIds = Object.keys(AuroraConstants.LogNamesToTypes).map((k) => { return AuroraConstants.LogNamesToTypes[k]; });

    AuroraResponseSerialParser.on('responseLog', logSpy);
    AuroraResponseSerialParser.on('responseUnknown', responseUnknownSpy);
    
    serialStream.on('data', (responseBuffer) => {
        AuroraResponseSerialParser.parseChunk(responseBuffer);
    });
    
    serialStream.on('end', () => {

        t.assert(logSpy.callCount == 5, "'responseLog' event fired 5 times.");

        t.assert(logSpy.alwaysCalledWithExactly(oneOfMatcher(logTypeIds), logMatcher(logSpy.args), sinon.match.date), "'responseLog' event received correct arguments.");
        
        t.assert(!responseUnknownSpy.called, "'responseUnknown' event not fired.");
        
        t.end();
        
        AuroraResponseSerialParser.removeAllListeners();
        
    });
});

test('Testing event response...', (t) => {

    const serialStream = fs.createReadStream('./test/ResponseEvent.mock', {highWaterMark: 100000});

    const eventSpy = sinon.spy();
    const responseUnknownSpy = sinon.spy();

    AuroraResponseSerialParser.on('responseEvent', eventSpy);
    AuroraResponseSerialParser.on('responseUnknown', responseUnknownSpy);

    serialStream.on('data', (responseBuffer) => {
        AuroraResponseSerialParser.parseChunk(responseBuffer);
    });

    serialStream.on('end', () => {


        t.assert(eventSpy.callCount == 11, "'responseEvent' event fired 11 times.");

        t.assert(eventSpy.alwaysCalledWithExactly(eventMatcher(eventSpy.args, 11), sinon.match.number), "'responseEvent' event received correct arguments.");

        t.assert(!responseUnknownSpy.called, "'responseUnknown' event not fired.");

        t.end();

        AuroraResponseSerialParser.removeAllListeners();

    });
});

test('Testing data response...', (t) => {

    const serialStream = fs.createReadStream('./test/ResponseData.mock', {highWaterMark: 100000});

    const dataSpy = sinon.spy();
    const responseUnknownSpy = sinon.spy();

    AuroraResponseSerialParser.on('responseData', dataSpy);
    AuroraResponseSerialParser.on('responseUnknown', responseUnknownSpy);

    serialStream.on('data', (responseBuffer) => {
        AuroraResponseSerialParser.parseChunk(responseBuffer);
    });

    serialStream.on('end', () => {


        t.assert(dataSpy.callCount == 5, "'responseData' event fired 5 times.");

        t.assert(dataSpy.alwaysCalledWithExactly("eeg", dataMatcher()), "'responseData' event received correct arguments.");

        t.assert(!responseUnknownSpy.called, "'responseUnknown' event not fired.");

        t.end();

        AuroraResponseSerialParser.removeAllListeners();

    });
});




