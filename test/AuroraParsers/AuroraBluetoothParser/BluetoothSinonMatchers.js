import sinon from 'sinon';

exports.auroraEventMatcher = (exponent) => {

    const eventObj = {
        eventId: sinon.match.number,
        event: sinon.match.string,
        flags: sinon.match.number,
        time: sinon.match.number
    };

    return sinon.match(eventObj).and(sinon.match(event => {

        return event.event && (event.eventId ** exponent == event.flags);

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

        if (!stream.stream || stream.data.length != stream.streamId) return false;

        if (stream.data.length === 1) return true;

        //data must be increasing by 1
        for (let i = 1; i < stream.data.length; i++){

            if (stream.data[i-1] != (stream.data[i] - 1)) return false;
        }

        return true;

    }));
};