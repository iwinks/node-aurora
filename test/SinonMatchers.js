import sinon from 'sinon';
import AuroraConstants from '../lib/AuroraConstants';

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

exports.eventMatcher = (args, multiplier) => {

    return sinon.match.number.and(sinon.match((callIndex) => {

        return args[callIndex][0]*multiplier == args[callIndex][1];

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

exports.dataMatcher = () => {

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