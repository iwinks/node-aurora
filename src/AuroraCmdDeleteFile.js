import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdDeleteFile extends AuroraCmd {

    constructor(srcPath, options) {

        let srcPathSegments = srcPath.split('/');
        let args = [srcPathSegments.pop(), srcPathSegments.length ? srcPathSegments.join('/') : '/']

        super('sd-file-del', args, options);
    }
}
