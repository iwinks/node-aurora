import AuroraCmdReadFile from "./AuroraCmdReadFile";
import AuroraCmdTransformBinary from "./AuroraCmdTransformBinary";

import _ from "lodash";
import FileSystem from "fs";
import mkdirp from "mkdirp";

export default class AuroraCmdDownloadFile extends AuroraCmdReadFile {

    static defaultOptions = {

        writeStreamOptions: {
            highWaterMark: 127
        },

        binaryDataType: false
    };

    constructor(srcPath, destPath, options) {

        super(srcPath, _.defaultsDeep(options, AuroraCmdDownloadFile.defaultOptions));
        
        this.destPath = destPath;
        this.respSuccess = destPath;
    }

    //since we are setting the stream in the overridden
    //exec function, we need to make sure we don't overwrite
    //the stream here so just create a dummy implementation
    
    _setupRespSuccess() {

        console.log('setup resp success, download file', this.options);
    }

    exec() {

        //let's make sure the directory exists before creating the write stream
        mkdirp(this.destPath.match(/(.*)[\/\\]/)[1] || '', (error) => {

            if (error) {
                this.triggerError(-1, error);
                return;
            }

            super._setupRespSuccess();

            if (this.options.binaryDataType !== false){

                this.respSuccessStreamBack = this.respSuccessStreamBack.pipe(new AuroraCmdTransformBinary({dataType: this.options.binaryDataType}));
            }

            this.respSuccessStreamBack = this.respSuccessStreamBack.pipe(FileSystem.createWriteStream(this.destPath, {highWaterMark: this.options.writeStreamOptions}));

            super.exec();
        });

    }

}
