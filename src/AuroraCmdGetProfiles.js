import AuroraCmd from "./AuroraCmd";
import AuroraCmdReadFile from "./AuroraCmdReadFile";
import _ from "lodash";

export default class AuroraCmdGetProfiles extends AuroraCmdReadFile {

    static defaultOptions = {

        respTypeSuccess: AuroraCmd.RespTypes.ARRAY,
        includeContent: true //TODO: figure out how to do composite commands so this can actually do something...
    };

    constructor(options) {

        super('profiles/_profiles.list', _.defaultsDeep(options, AuroraCmdGetProfiles.defaultOptions));
    }

    _onRespSuccessData = (profileLine) => {
        
        let p = profileLine.split(':');
        let profile = {
            file: p[0],
            path: 'profiles/' + p[0],
            name: p[0].substr(0, p[0].lastIndexOf('.')),
            id: p.length > 1 ? p[1] : _.uniqueId('custom_')
        };

        this.respSuccess = this.respSuccess.concat(profile);

    };

}