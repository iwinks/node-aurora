import fs from 'fs';
import {promisify} from './util';

module.exports = function(fwPath, fwVersion = false, fwType = 'app') {

    //TODO: this condition is for backwards compatibility
    const filename = fwType == 'app' ? 'aurora.hex' : `aurora-${fwType}.hex`;

    return this.uploadFile(fwPath, filename).then(() => {

        return this.flash(filename, fwVersion, fwType);

    });

};