import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import {promisify} from './util';

module.exports = function(srcPath, destPath, options={}) {

    //create directory if it doesn't exist
    //then read the file and pass the output
    //to fs.writeFile
    return promisify(mkdirp)(path.dirname(destPath))
        .then(() => this.readFile(srcPath))
        .then((data) => promisify(fs.writeFile, fs)(destPath, data));

};