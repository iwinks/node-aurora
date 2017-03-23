import mkdirp from 'mkdirp';
import path from 'path';
import fs from 'fs';
import {promisify} from './util';
import AuroraTransformBinary from './AuroraTransformBinary';

module.exports = async function(session, destDir, connector = 'any') {

    await promisify(mkdirp)(destDir);

    return Promise.all(session.streams.map((stream) => {

        let transform;
        let file = stream.file;

        if (file.slice(-4) == '.dat'){

            file = file.slice(0, -4) + '.csv';
            transform = new AuroraTransformBinary(stream.type);
        }

        let writeStream = fs.createWriteStream(path.join(destDir, file));

        if (transform){

            transform.pipe(writeStream);
            writeStream = transform;
        }

        const streamAuroraPath = `${session.auroraDir}/${stream.file}`;

        return this.readFile(streamAuroraPath, writeStream, connector).then(() => {

            return this.queueCmd(`sd-file-del ${streamAuroraPath}`);

        });

    })).then(() => {

        return this.queueCmd(`sd-dir-del ${session.auroraDir}`);

    });

};