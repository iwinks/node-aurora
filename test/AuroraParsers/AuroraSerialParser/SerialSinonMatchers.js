import sinon from 'sinon';
import {LogNamesToTypeIds} from '../../../lib/AuroraConstants';

exports.auroraEventMatcher = (exponent) => {

    const eventObj = {
        eventId: sinon.match.number,
        event: sinon.match.string,
        flags: sinon.match.number,
        time: sinon.match.number
    };

    return sinon.match(eventObj).and(sinon.match(event => {

        return event.event && event.eventId ** exponent == event.flags;

    }));
};

exports.logMatcher = () => {

    const logObj = {
        typeId: sinon.match.number,
        type: sinon.match.string,
        message: sinon.match.string,
        time: sinon.match.number
    };

    return sinon.match(logObj).and(sinon.match(log => {

        const message = log.message.split('-');

        if (message.length != 2) return false;

        if (log.type != message[0] || log.typeId != LogNamesToTypeIds[log.type]) return false;

        const today = new Date();

        return (new Date(log.time) - today.setHours(0,0,0,0)) == +message[1];
    }));
};

exports.streamDataMatcher = () => {

    const streamObj = {
        streamId: sinon.match.number,
        stream: sinon.match.string,
        data: sinon.match.array,
        time: sinon.match.number
    };

    return sinon.match(streamObj).and(sinon.match(stream => {

        if (stream.data.length != stream.streamId && stream.stream) {
            return false;
        }

        if (stream.data.length === 1) {
            return true;
        }

        //data must be increasing by 1
        for (let i = 1; i < stream.data.length; i++){

            if (stream.data[i-1] != (stream.data[i] - 1)) return false;
        }

        return true;

    }));
};