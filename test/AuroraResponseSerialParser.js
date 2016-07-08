import test from 'tape';
import fs from 'fs';
import sinon from 'sinon';

import AuroraResponseSerialParser from '../lib/AuroraResponseSerialParser';

const bufferMatcher = (expectation) => {

    return sinon.match.instanceOf(Buffer).and(sinon.match((value) => {

        return value.toString() === expectation;

    }));
};

test('Testing success response parsing...', (t) => {

    const serialStream = fs.createReadStream('./test/AuroraResponseSuccessMock.txt', { highWaterMark: 100000});

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

    const serialStream = fs.createReadStream('./test/AuroraResponseErrorMock.txt', {highWaterMark: 100000});

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




