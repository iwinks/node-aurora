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

    onRespSuccessData(profileLines){

        if (!Array.isArray(profileLines)){

            profileLines = [profileLines];
        }

        for (let profileLine of profileLines){

            let p = profileLine.split(':');
            let profile = {
                name: p[0],
                id: p.length > 1 ? p[1] : _.uniqueId('custom_')
            };

            this.respSuccess = this.respSuccess.concat(profile);
        }

    }

}