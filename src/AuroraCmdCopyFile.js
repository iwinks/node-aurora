import AuroraCmdWriteFile from "./AuroraCmdWriteFile";
import FileSystem from "fs";
import _ from "lodash";

export default class AuroraCmdCopyFile extends AuroraCmdWriteFile {

    constructor(destPath, sourceFile, options) {
        
        let readStream = FileSystem.createReadStream(sourceFile).setEncoding('binary');

        super(destPath, readStream, _.defaultsDeep(options, AuroraCmdCopyFile.defaultOptions));

        this.destPath = destPath;
        this.sourceFile = sourceFile;
    }

}
