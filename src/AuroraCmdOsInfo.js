import _ from 'lodash';
import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdOsInfo extends AuroraCmd {

    static defaultOptions = {
        respTypeSuccess: AuroraCmd.RespTypes.OBJECT
    };

    constructor(options) {

        super('os-info', [], _.defaultsDeep(options, AuroraCmdOsInfo.defaultOptions));
    }

    onSuccess(){

        if (this.respSuccess.version) {

            const version = his.respSuccess.version.match(/(\d+).(\d+).(\d+)/);

            this.respSuccess.versionString = 'v' + this.respSuccess.version;
            this.respSuccess.version = (parseInt(version[1]) * 10000) + (parseInt(version[2]) * 100) + parseInt(version[3]);

            super.onSuccess();
        }
        else {

            this.triggerError(-1, 'Unknown firmware version.');
        }
    }

}
