import fs from 'fs';
import {promisify} from './util';

module.exports = function(fwPath, fwVersion = false) {

    return this.uploadFile(fwPath, 'aurora.hex').then(() => {

        return this.flash('aurora.hex', fwVersion);

    });

};