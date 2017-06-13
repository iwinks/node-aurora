import moment from 'moment';
import isPlainObject from 'lodash/isPlainObject';
import camelCase from 'lodash/camelCase';

exports.sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

exports.promisify = (fn, context = null) => {

    return (...args) => {

        return new Promise((resolve, reject) => {

            fn.apply(context, args.concat((error, result) => {

                if (error) return reject(error);

                resolve(result);

            }));
        });
    }
};

exports.promisifyStream = (stream) => {

    return new Promise((resolve, reject) =>  {

        stream.once('close', resolve);
        stream.once('error', reject);
        stream.once('end', resolve);
    });

};

exports.parseValueString = (value) => {

    value = value.trim();

    const valWithoutNumericSymbols = value.replace(/[$%,]+|(ms$)/g,'');

    if (!isNaN(valWithoutNumericSymbols)) {

        return +valWithoutNumericSymbols;
    }

    //support the funky date format GCC uses for __TIME__ constant
    let date = moment(value, [
        moment.ISO_8601,
        "YYYY-MM-DD HH:mm:ss:SSS",
        "MMM D YYYY - HH:mm:ss",
        "MMM  D YYYY - HH:mm:ss",
        "MMM DD YYYY - HH:mm:ss"
    ], true);

    if (date.isValid()){

        return +date;
    }

    //TODO: eventually remove this, as in the future, uppercase will be
    //required to trigger conversion
    const valueUC = value.toUpperCase();

    if (valueUC === 'TRUE' || valueUC === 'ON' || valueUC === 'ACTIVE' || valueUC === 'YES') {

        return true;
    }
    else if (valueUC === 'FALSE' || valueUC === 'OFF' || valueUC === 'INACTIVE' || valueUC === 'NO' || valueUC === 'NONE') {

        return false;
    }
    else if (valueUC === 'UNKNOWN'){

        return 0;
    }

    return value;
};

exports.camelCaseObjectKeys = (object) => {

    const camelCaseObject = {};

    for (let key of Object.keys(object)) {

        let value = object[key];

        if (isPlainObject(value)) {
            value = exports.camelCaseObjectKeys(value);
        }

        camelCaseObject[camelCase(key)] = value;
    }

    return camelCaseObject;
};

exports.maskFromIds = (...ids) => {

    return ids.reduce((mask, id) => mask + (1 << id), 0);

};

exports.versionToString = (version) => {

    if (!version) return "UNKNOWN";

    const major = Math.floor(version / 10000);
    const minor = Math.floor((version - major*10000) / 100);
    const build = version - major*10000 - minor*100;

    return `v${major}.${minor}.${build}`;

};

exports.stringToVersion = (versionString) => {

    const version = versionString.split('.');

    if (version.length != 3) return 0;

    return parseInt(version[0])*10000 + parseInt(version[1])*100 + parseInt(version[2]);
};