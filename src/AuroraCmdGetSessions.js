import AuroraTransformObject from './AuroraTransformObject';
import AuroraSessionParser from './AuroraSessionParser';

module.exports = async function(destPath, connector = 'any') {

    const sessions = [];

    const dirReadCmd = await this.queueCmd('sd-dir-read sessions 0 *@*', connector);

    const sessionDirs = dirReadCmd.response;

    for (let sessionDir of sessionDirs) {

        let readSessionTxtCmd;
        let sessionDirFiles;

        try {

            if (sessionDir.isFile) continue;

            const sessionDirReadCmd = await this.queueCmd(`sd-dir-read ${sessionDir.name} 1`);

            sessionDirFiles = sessionDirReadCmd.response;

            const sessionTxtFile = sessionDirFiles.find((file) => file.name == 'session.txt');

            //make sure text file exists and it's size is reasonable
            if (!sessionTxtFile || sessionTxtFile.size < 75 || sessionTxtFile.size > 512*1024) continue;

            readSessionTxtCmd = await this.readFile(`${sessionDir.name}/session.txt`, new AuroraTransformObject(), connector);
        }
        catch (error) {

            continue;
        }

        let session = {
            auroraDir: sessionDir.name,
            streams: []
        };

        try {

            const parsedSession = await AuroraSessionParser.parseSessionTxtObject(readSessionTxtCmd.output[0]);

            Object.assign(session, parsedSession);

            //make sure sessions actually exist on disk and that the size is reasonable
            for (let i = 0; i < session.streams.length; i++) {

                const streamFile = sessionDirFiles.find((file) => file.name == session.streams[i].file);

                if (!streamFile || !streamFile.size || streamFile.size > 100*1024*1024){

                    delete session.streams[i];
                    continue;
                }

                session.streams[i].size = streamFile.size;
            }
        }
        catch (error) {

            session.error = error;
        }

        sessions.push(session);
    }

    return sessions;

};