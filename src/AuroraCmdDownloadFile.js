import AuroraCmdReadFile from "./AuroraCmdReadFile";
import _ from "lodash";
import FileSystem from "fs";
import mkdirp from "mkdirp";

export default class AuroraCmdDownloadFile extends AuroraCmdReadFile {

    static defaultOptions = {

        writeStreamOptions: {
            highWaterMark: 1024
        }
    };

    constructor(srcPath, destPath, options) {

        super(srcPath, _.defaultsDeep(options, AuroraCmdDownloadFile.defaultOptions));
        
        this.destPath = destPath;
        this.respSuccess = destPath;
    }

    //since we are setting the stream in the overridden
    //exec function, we need to make sure we don't overwrite
    //the stream here so just initialize the response
    
    _setupRespSuccess() {

        this.respSuccess = "";
    }

    exec() {

        //let's make sure the directory exists before creating the write stream
        mkdirp(this.destPath.match(/(.*)[\/\\]/)[1] || '', (error) => {

            if (error) {
                this.triggerError(-1, error);
                return;
            }

            this.respSuccessStreamFront = FileSystem.createWriteStream(this.destPath, {highWaterMark: this.options.writeStreamOptions});
            this.respSuccessStreamBack = this.respSuccessStreamFront;

            super.exec();
        });

    }

}
