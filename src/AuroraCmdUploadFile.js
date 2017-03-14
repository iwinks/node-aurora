import fs from 'fs';
import {promisify} from './util';

module.exports = function(srcPath, destPath, options={}) {

    return promisify(fs.readFile, fs)(srcPath).then((data) => {

        return this.writeFile(destPath, data);
    });

};