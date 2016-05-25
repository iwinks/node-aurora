import Aurora from "./Aurora";
import AuroraCmd from "./AuroraCmd";
import AuroraCmdTransformReadPacket from "./AuroraCmdTransformReadPacket.jsx";
import _ from "lodash";

export default class AuroraCmdReadFile extends AuroraCmd {
    
    static defaultOptions = {
        
        respTimeout: 180000,
        respTypeSuccess: AuroraCmd.RespTypes.STRING,
        packetMode: true,
        packetSize: 128
    };
    
    constructor(srcPath, options) {

        options =  _.defaultsDeep(options, AuroraCmdReadFile.defaultOptions);


        let srcPathSegments = srcPath.split('/');

        let args = [
            srcPathSegments.pop(),
            srcPathSegments.length ? srcPathSegments.join('/') : '/',
            options.packetMode ? options.packetSize : 0
        ];
        
        super('sd-file-read', args, options);

        this.srcPath = srcPath;
    }
    
    exec(){

        //disable packet mode for old aurora firmware
        //TODO: remove once stable
        if (Aurora.firmwareInfo.version.number < 900){
            this.args[2] = false;            //TODO: don't store args like this...
            this.options.packetMode = false; //for this very reason
        }

        super.exec();
    }

    _setupRespSuccess() {

        super._setupRespSuccess();

        if (this.options.packetMode && this.options.packetSize) {

            this.respSuccessStreamBack = this.respSuccessStreamFront;
            this.respSuccessStreamFront = new AuroraCmdTransformReadPacket(this);
            this.respSuccessStreamFront.pipe(this.respSuccessStreamBack);
        }

    }
}
