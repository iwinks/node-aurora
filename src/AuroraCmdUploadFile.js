import fs from 'fs';
import fetch from 'node-fetch';

module.exports = function(srcPath, destPath, rename = false) {

    if (srcPath.match(/https?:\/\//i)){

        return fetch(srcPath).then(res => {

            return this.writeFile(destPath, res.body, rename);

        });
    }

    return this.writeFile(destPath, fs.createReadStream(srcPath));
};