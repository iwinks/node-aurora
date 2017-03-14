module.exports = function(destPath, data) {

    let destPathSegments = destPath.split('/');

    const destFileName = destPathSegments.pop();
    const destFileDir = destPathSegments.length ? destPathSegments.join('/') : '/';

    const rename = 0;

    const onCmdInputRequested = (writeInput) => {

        writeInput(data);
    };

    this.once('cmdBegin', (cmd) => {

        cmd.connector.once('cmdInputRequested', onCmdInputRequested);

    });

    this.once('cmdEnd', (cmd) => {

        cmd.connector.removeListener('cmdInputRequested', onCmdInputRequested);
    });

    return this.queueCmd(`sd-file-write ${destFileName} ${destFileDir} ${rename} 1 3000`);

};