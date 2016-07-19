import test from 'tape';
import fs from 'fs';
import sinon from 'sinon';

import AuroraResponseSerialParser from '../lib/AuroraResponseSerialParser';

const bufferMatcher = (string) => {

    return sinon.match.instanceOf(Buffer).and(sinon.match((value) => {

        return value.toString() === string;

    }));
};

const timeMatcher = (msAfterMidnight) => {

  return sinon.match.instanceOf(Date).and(sinon.match((value) => {

      const today = new Date();
      today.setHours(0,0,0,0);

      return value.getTime() == (today.getTime() + msAfterMidnight);

  }));

};

const eventMatcher = (args, multiplier) => {

    return sinon.match.number.and(sinon.match((callIndex) => {

        return args[callIndex][0]*multiplier == args[callIndex][1];

    }));
};

const dataMatcher = () => {

    return sinon.match.array.and(sinon.match((array) => {

        if (array.length == 0) {
            return false;
        }

        if (array.length === 1) {
            return true;
        }
        
        for (let i = 1; i < array.length; i++){

            if (array[i-1] != array[i] - 1) return false;
        }

        return true;

    }));
};

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
    
    const logInfoSpy = sinon.spy();
    const logWarningSpy = sinon.spy();
    const logErrorSpy = sinon.spy();
    const logDataSpy = sinon.spy();
    const logEventSpy = sinon.spy();
    const responseUnknownSpy = sinon.spy();
    
    AuroraResponseSerialParser.on('responseLogInfo', logInfoSpy);
    AuroraResponseSerialParser.on('responseLogWarning', logWarningSpy);
    AuroraResponseSerialParser.on('responseLogError', logErrorSpy);
    AuroraResponseSerialParser.on('responseLogData', logDataSpy);
    AuroraResponseSerialParser.on('responseLogEvent', logEventSpy);
    AuroraResponseSerialParser.on('responseUnknown', responseUnknownSpy);
    
    serialStream.on('data', (responseBuffer) => {
        AuroraResponseSerialParser.parseChunk(responseBuffer);
    });
    
    serialStream.on('end', () => {
    
    
        t.assert(logWarningSpy.calledOnce, "'responseLogWarning' event fired once.");
        t.assert(logWarningSpy.alwaysCalledWithExactly("warning", timeMatcher(0)), "'responseLogWarning' event received correct arguments.");

        t.assert(logInfoSpy.calledOnce, "'responseLogInfo' event fired once.");
        t.assert(logInfoSpy.alwaysCalledWithExactly("info", timeMatcher(2)), "'responseLogInfo' event received correct arguments.");

        t.assert(logDataSpy.calledOnce, "'responseLogData' event fired once.");
        t.assert(logDataSpy.alwaysCalledWithExactly("data", timeMatcher(2000)), "'responseLogData' event received correct arguments.");

        t.assert(logEventSpy.calledOnce, "'responseLogEvent' event fired once.");
        t.assert(logEventSpy.alwaysCalledWithExactly("event", timeMatcher(120000)), "'responseLogEvent' event received correct arguments.");

        t.assert(logErrorSpy.calledOnce, "'responseLogError' event fired once.");
        t.assert(logErrorSpy.alwaysCalledWithExactly("error", timeMatcher(7200000)), "'responseLogError' event received correct arguments.");
        
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




