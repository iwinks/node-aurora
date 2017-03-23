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

    let date = moment(value, [
        moment.ISO_8601,
        "YYYY-MM-DD HH:mm:ss:SSS",
        "MMM  D YYYY - HH:mm:ss",
        "MMM DD YYYY - HH:mm:ss"
    ], true);

    if (date.isValid()){

        return +date;
    }

    const valueUC = value.toUpperCase();

    if (valueUC === 'TRUE' || valueUC === 'ON' || valueUC === 'ACTIVE' || valueUC === 'YES') {

        return true;
    }
    else if (valueUC === 'FALSE' || valueUC === 'OFF' || valueUC === 'INACTIVE' || valueUC === 'NO') {

        return false;
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