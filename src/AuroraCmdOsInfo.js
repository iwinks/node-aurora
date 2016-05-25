import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdOsInfo extends AuroraCmd {

    static defaultOptions = {
        respTypeSuccess: AuroraCmd.RespTypes.OBJECT
    };

    constructor(options) {

        super('os-info', [], _.defaultsDeep(options, AuroraCmdOsInfo.defaultOptions));
    }

    _commandResponse() {
        
        if (!this.error) {

            let versionKey = false;

            //TODO: this gets removed once old firmware versions are deprecated
            if (this.respSuccess.auroraOsVersion) {
                versionKey = 'auroraOsVersion';
            }
            else if (this.respSuccess.version) {
                versionKey = 'version';
            }

            if (versionKey) {

                let version = this.respSuccess[versionKey].toString().match(/(\d+).(\d+).?(\d)*/);

                this.respSuccess.version = {
                    major: parseInt(version[1]),
                    minor: parseInt(version[2]),
                    build: version[3] != undefined ? parseInt(version[3]) : 0
                };

                this.respSuccess.version.number = (this.respSuccess.version.major * 10000) + (this.respSuccess.version.minor * 100) + this.respSuccess.version.build;

                this.respSuccess.versionString = 'v' + this.respSuccess.version.major + '.' + this.respSuccess.version.minor + '.' + this.respSuccess.version.build;

                delete this.respSuccess.auroraOsVersion; //TODO: removed once old firmware versions are deprecated

            }
            else {

                this.triggerError(-1, 'Unknown firmware version.');
            }
        }

        super._commandResponse();
    }

}
