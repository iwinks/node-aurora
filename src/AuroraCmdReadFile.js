module.exports = function(srcPath) {

    let srcPathSegments = srcPath.split('/');

    const srcFileName = srcPathSegments.pop();
    const srcFileDir = srcPathSegments.length ? srcPathSegments.join('/') : '/';

    return this.queueCmd(`sd-file-read ${srcFileName} ${srcFileDir}`).then((cmd) => cmd.output);

};