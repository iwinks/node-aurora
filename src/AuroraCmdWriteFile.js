import Stream from 'stream';
import crc32 from 'buffer-crc32';

module.exports = function(destPath, dataOrReadStream, rename = false, connector = 'any') {

    let destPathSegments = destPath.split('/');

    const destFileName = destPathSegments.pop();
    const destFileDir = destPathSegments.length ? destPathSegments.join('/') : '/';

    let crc;
    let stream = dataOrReadStream;

    //convert to stream in case of string or buffer
    if (typeof dataOrReadStream == 'string' || Buffer.isBuffer(dataOrReadStream)){

        stream = new Stream.Readable();
        stream._read = () => {};
        stream.push(dataOrReadStream.toString());
        stream.push(null);
    }

    stream.pause();
    stream.on('data', (chunk) => {
        crc = crc32.unsigned(chunk, crc);
    });

    return this.queueCmd(`sd-file-write ${destFileName} ${destFileDir} ${rename ? 1 : 0} 1 500`, connector, (cmd) => {

        this.once('cmdInputRequested', (inputStream) => {
            stream.pipe(inputStream);
            stream.resume();
        });

    }).then(cmdWithResponse => {

        if (cmdWithResponse.response.crc != crc) return Promise.reject('CRC failed.');

        return cmdWithResponse;

    });

};