import {ledEffectObjToCmd} from './util';

module.exports = function(ledEffect, connector='any') {
    
    const cmd = typeof ledEffect == 'string' ? ledEffect : ledEffectObjToCmd(ledEffect);

    return this.queueCmd(cmd, connector);
};
    