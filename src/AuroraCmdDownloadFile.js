import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import {promisify} from './util';

module.exports = function(srcPath, destPath) {

    return promisify(mkdirp)(path.dirname(destPath))
        .then(() => this.readFile(srcPath, fs.createWriteStream(destPath)));
};