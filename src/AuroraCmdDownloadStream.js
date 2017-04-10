import mkdirp from 'mkdirp';
import path from 'path';
import fs from 'fs';
import {promisify} from './util';
import AuroraTransformBinary from './AuroraTransformBinary';

module.exports = async function(srcPath, destDir, type, connector = 'any') {

    try {

        await promisify(mkdirp)(destDir);

        let transform;
        let file = path.basename(srcPath);

        if (file.slice(-4) == '.dat' && type != undefined){

            file = file.slice(0, -4) + '.csv';
            transform = new AuroraTransformBinary(stream.type);
        }

        let writeStream = fs.createWriteStream(path.join(destDir, file));

        if (transform){

            transform.pipe(writeStream);
            writeStream = transform;
        }

        await this.readFile(srcPath, writeStream, connector);

        return await this.queueCmd(`sd-file-del ${srcPath}`);
    }
    catch (error) {

        return Promise.reject(error);
    }

};