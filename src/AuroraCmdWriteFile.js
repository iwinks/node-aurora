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

        let readStream = this.content;

        if (typeof this.content == 'string') {

            readStream = new Stream.Readable();
            readStream._read = function noop(){};

            readStream.push(this.content);
            readStream.push(null);
        }

        readStream.on('end', () => {
            Aurora.write('\r\r\r\r');
            readStream.removeAllListeners();
        }).on('data', (data) => {
            this.petWatchdog();
            Aurora.write(data);
        });

    }

}
