import Aurora from "./Aurora";
import AuroraCmd from "./AuroraCmd";
import Stream from 'stream';
import _ from 'lodash';

export default class AuroraCmdWriteFile extends AuroraCmd {

    static defaultOptions = {

        renameIfExisting: false,
        silentMode: true,
        respTypeSuccess: AuroraCmd.RespTypes.OBJECT
    };

    constructor(destPath, content, options) {

        super('sd-file-write');

        this.options = _.defaultsDeep(options, AuroraCmdWriteFile.defaultOptions);

        this.destPath = destPath;

        let destPathSegments = destPath.split('/');

        this.destFile = destPathSegments.pop();
        this.destDir = destPathSegments.length ? destPathSegments.join('/') : '/';

        this.args = [ this.destFile, this.options.renameIfExisting, this.destDir, this.options.silentMode];
        this.content = content;
    }

    exec() {

        super.exec();

        if (typeof this.content == 'string') {

            console.log('writing from string');

            Aurora.write(this.content + '\r\r\r\r');
        }
        else {

            let readStream = this.content;

            readStream.on('end', () => {

                Aurora.write('\r\r\r\r');
                readStream.removeAllListeners();
            }).on('data', (data) => impo

                this.petWatchdog();
                Aurora.write(data);
            });
        }

    }

}
