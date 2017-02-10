import sinon from 'sinon';
import AuroraConstants from '../../lib/AuroraConstants';

exports.oneOfMatcher = (array) => {

    return sinon.match((el) => {

        return array.indexOf(el) != -1;
    });
};

exports.bufferMatcher = (string) => {

    return sinon.match.instanceOf(Buffer).and(sinon.match((value) => {

        return value.toString() === string;

    }));
};

exports.auroraEventMatcher = () => {

    const eventObj = {
        eventId: sinon.match.number,
        event: sinon.match.string,
        flags: sinon.match.number,
        time: sinon.match.number
    };

    return sinon.match(eventObj).and(sinon.match(event => {

        return event.event == `event${event.flags * event.eventId}`;

    }));
};

exports.logMatcher = (args) => {

    return sinon.match.string.and(sinon.match((paramString) => {

        const params = paramString.split('-');

        if (params.length != 3) return false;

        const today = new Date();
        today.setHours(0,0,0,0);

        const callIndex = parseInt(params[0]);

        if (AuroraConstants.LogNamesToTypes[params[1]] != args[callIndex][0]) return false;

        return args[callIndex][2].getTime() == (today.getTime() + parseInt(params[2]));

    }));
};

exports.streamDataMatcher = () => {

    const streamObj = {
        streamId: sinon.match.number,
        stream: 'data',
        data: sinon.match.array,
        time: sinon.match.number
    };

    return sinon.match(streamObj).and(sinon.match(stream => {

        if (stream.data.length != stream.streamId) {
            return false;
        }

        if (stream.data.length === 1) {
            return true;
        }

        //data must be increasing by 1
        for (let i = 1; i < stream.data.length; i++){

            if (stream.data[i-1] != stream.data[i] - 1) return false;
        }

        return true;

    }));
};