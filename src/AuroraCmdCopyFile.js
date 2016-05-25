import AuroraCmdWriteFile from "./AuroraCmdWriteFile";
import FileSystem from "fs";
import _ from "lodash";

export default class AuroraCmdCopyFile extends AuroraCmdWriteFile {

    static defaultOptions = {

        respTimeout: 180000
    };

    constructor(destPath, sourceFile, options) {

        console.log(destPath);
        console.log(sourceFile);

        let readStream = FileSystem.createReadStream(sourceFile).setEncoding('binary');

        super(destPath, readStream, _.defaultsDeep(options, AuroraCmdCopyFile.defaultOptions));

        this.destPath = destPath;
        this.sourceFile = sourceFile;
    }

}
