import {promisifyStream} from './util';
import crc32 from 'buffer-crc32';

module.exports = function(srcPath, writeStream = false, connector = 'any') {

    let srcPathSegments = srcPath.split('/');

    const srcFileName = srcPathSegments.pop();
    const srcFileDir = srcPathSegments.length ? srcPathSegments.join('/') : '/';

    /*
    if (connector != 'bluetooth' && this.isMsdAttached()){


    }
    */


    const outputChunks = [];
    let crc;
    let stream;

    return this.queueCmd(`sd-file-read ${srcFileName} ${srcFileDir} 0`, connector, (cmd) => {

        cmd.outputStream.on('data', (chunk) => {
            crc = crc32.unsigned(chunk, crc);
        });

        stream = cmd.outputStream;

        if (writeStream){

            stream = stream.pipe(writeStream);
        }

        stream.on('data', (chunk) => {
            outputChunks.push(chunk);
        });

    }).then(cmdWithResponse => {

        return promisifyStream(stream).then(() => {

            if (cmdWithResponse.response.crc != crc) return Promise.reject('CRC failed.');

            cmdWithResponse.output = writeStream ? outputChunks : outputChunks.map(String).join('');

            return cmdWithResponse;

        });

    });

};