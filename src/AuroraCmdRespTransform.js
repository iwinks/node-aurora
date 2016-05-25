import Stream from "stream";

export default class AuroraCmdRespTransform extends Stream.Transform {

    constructor(cmd) {

        super({writableHighWaterMark: 256, readableHighWaterMark: 256});

        this.cmd = cmd;
        this._leftoverData = null;

        this.cmd.state = 'init';

        this._respStep = 0;

        this._errorCount = 0;
    }

    _transform(respChunk, encoding, done) {

        respChunk = respChunk.toString('binary');
        console.log(respChunk);

        if (this._leftoverData) {
            respChunk = this._leftoverData + respChunk;
            this._leftoverData = null;
        }

        while (this._respStep < 3) {

            if (!respChunk.length) {
                done();
                return;
            }

            //  console.log(respChunk);

            let matches = false;
            //  console.log('step:' + this._respStep);
            switch (this._respStep) {

                case 0 :
                    //matches everything before bash, the command name, any parameters, and final newline(s)
                    matches = respChunk.match(new RegExp('^[\\s\\S]*#? ' + this.cmd.cmd + '.*[\\n\\r]+'));
                    if (matches) {
                        respChunk = respChunk.substr(matches[0].length);
                        this._respStep++;
                    }
                    else {
                        this._leftoverData = respChunk;
                        done();
                        return;
                    }
                    break;

                case 1 :
                    //matches header
                    matches = respChunk.match(/^(-|~){64,}\s+/);
                    if (matches) {
                        respChunk = respChunk.substr(matches[0].length);
                        this._respStep++;
                        //if this is an error response, let command know
                        if (matches[1].charAt(0) == '~') {
                            this.cmd.error = true;
                        }
                    }
                    else {
                        this._leftoverData = respChunk;
                        done();
                        return;
                    }
                    break;
                case 2 :
                    //first look for a complete footer, matching any trailing response
                    matches = respChunk.match(/^([\s\S]*?)\n?(?:-|~){64,}\s*/);
                    if (matches) {
                        //console.log(matches);
                        this.push(matches[1], 'binary'); // the first matching group contains any trailing response
                        this._respStep++;
                        respChunk = respChunk.substr(matches[0].length); //the entire match should be consumed since we are done

                        //  console.log('command complete');
                    }
                    //no complete footer found, so try to match response without eating potential footer
                    else {

                        //a footer is always preceeded by a newline, so look for that
                        //this should be faster than a regex
                        let nextNewlineIndex = respChunk.indexOf('\n');

                        //if no newline is found we can safely consume the entire chunk
                        if (nextNewlineIndex == -1) {

                            this.push(respChunk, 'binary');
                            respChunk = ''

                            //  console.log('consumed entire chunk because no newline was present');

                            done();
                            return;

                            //otherwise check to see if character after newline is present and not a footer character
                            //if so we can safely consume up until the newline
                        }
                        else {

                            let charAfterNewline = respChunk.charAt(nextNewlineIndex + 1);
                            //  console.log('char after newline: "' + charAfterNewline + '"');

                            if (charAfterNewline != '' && charAfterNewline != '~' && charAfterNewline != '-') {

                                this.push(respChunk.substr(0, nextNewlineIndex + 1), 'binary');
                                respChunk = respChunk.substr(nextNewlineIndex + 1);
                            }
                            else {
                                //    console.log('not enough chars');
                                this._leftoverData = respChunk;
                                done();
                                return;
                            }
                        }
                    }

                    break;
            }
        }

        if (respChunk.trim().length) {
      
            this._leftoverData = respChunk.trim();
        }

        this.push(null);

        done();
    }

    _flush(done) {
        console.log('flush response');
        if (this._leftoverData != null) {
            console.log('leftover data: ' + this._leftoverData);
            this.push(this._leftoverData, 'binary');
            this.leftoverData = null;
        }

        done();
    }

}
