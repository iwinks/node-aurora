import moment from 'moment';
import isPlainObject from 'lodash/isPlainObject';
import camelCase from 'lodash/camelCase';
import {LedEffects, LedColors} from './AuroraConstants';

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

exports.buzzSongObjToCmd = (songObj) => {

    let {song, repeats, volume, tempoAdjust, pitchAdjust} = songObj;

    if (!song) throw new Error("Song field is required.");

    repeats = parseInt(repeats);

    if (isNaN(repeats)){

        repeats = 0;
    }

    volume = parseInt(volume);
    volume = isNaN(volume) ? 100 : Math.min(100, Math.max(0, volume));

    tempoAdjust = parseFloat(tempoAdjust);
    tempoAdjust = isNaN(tempoAdjust) ? 1 : Math.min(2.5, Math.max(.25, tempoAdjust));

    pitchAdjust = parseInt(pitchAdjust);
    pitchADjust = isNaN(pitchAdjust) ? 0 : Math.min(12, Math.max(-12, pitchAdjust));

    return `buzz-song ${song} ${repeat} ${volume} ${tempoAdjust} ${pitchAdjust}`;
};

exports.ledEffectObjToCmd = (effectObj) => {

    let effect = LedEffects.find((e) => e.name == effectObj.effect);

    if (!effect){

        throw new Error("Invalid effect specified.");
    }

    const [eyes, state1Eyes, state2Eyes] = ['eyes','state1Eyes','state2Eyes'].map((option) => {

        const eyesOption = effectObj[option];

        if (typeof eyesOption == 'string'){

            switch (eyesOptions.toLowerCase()){

                case 'right': 
                    return 2;

                case 'left': 
                    return 1;

                case 'none': 
                    return 0;

                case 'both':
                default:
                    return 3;
            }
        }
        else {

            const eye= parseInt(eyesOption);

            return isNaN(eyes) || eyes < 0 || eyes > 3 ? 3 : eyes;
        }
        
        return 3;

    });

    const [
        brightness, 
        state1Brightness, 
        state2Brightness
    ] = ['brightness','state1Brightness','state2Brightness'].map((option) => {

        const brightnessOption = effectObj[option];
        const brightness = parseInt(brightnessOption);

        if (isNaN(brightness) || brightness > 255 || brightness < 0){
            return 255;
        }

        return brightness * (255 / 100);
    });

    const [
        color,
        state1Color,
        state2Color
    ] = ['color','state1Color','state2Color'].map((option) => {

        const colorOption = effectObj[option];

        if (!colorOption || colorOption == 'off' || colorOption == 'black'){

            return '0x000000';
        }

        let color = LedColors.find((c) => c.name == colorOption);
        color = !color ? colorOption : color.value;
        color = color.replace('#','0x');

        return isNaN(parseInt(color)) ? '0x000000' : color;

    });

    const [
        state1Duration,
        state2Duration,
        transitionDuration
    ] = ['state1Duration','state2Duration','transitionDuration'].map((option) => {

        const durationOption = effectObj[option];
        const duration = parseFloat(durationOption);

        if (isNaN(duration)){

            return 1000;
        }
        
        return Math.floor(duration*1000);
    });

    let shutdownDelay = parseInt(effectObj.shutdownDelay);
    shutdownDelay = isNaN(shutdownDelay) ? 0 : shutdownDelay * 1000;

    switch (effect.name){

        case 'set':
            return `${effect.cmd} ${eyes} ${color} ${brightness} ${shutdownDelay}`;

        case 'blink':
            let blinkCount = parseInt(effectObj.blinkCount);
            blinkCount = isNaN(blinkCount) ? 1 : blinkCount;
            let blinkRate = parseInt(effectObj.blinkRate);
            blinkRate = isNaN(blinkRate) ? 500 : blinkRate*1000;
            return `${effect.cmd} ${eyes} ${color} ${brightness} ${blinkCount} ${blinkRate} ${shutdownDelay}`;

        case 'alternate':
            let alternateCount = parseInt(effectObj.alternateCount);
            alternateCount = isNaN(alternateCount) ? 1 : alternateCount;
            return `${effect.cmd} ${state1Eyes} ${state1Color} ${state1Brightness}
                    ${state1Duration} ${state2Eyes} ${state2Color} ${state2Brighntess}
                    ${state2Duration} ${alternateCount} ${shutdownDelay}`;

        case 'transition':
            let transitionRewind = effectObj.transitionRewind ? 1 : 0;
            return `${effect.cmd} ${state1Eyes} ${state1Color} ${state1Brightness}
                    ${state2Eyes} ${state2Color} ${state2Brighntess}
                    ${transitionDuration} ${transitionRewind} ${shutdownDelay}`;

    }

};
