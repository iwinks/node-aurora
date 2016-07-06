import AuroraCmd from "./AuroraCmd";
import _ from 'lodash';

export default class AuroraCmdDeleteDir extends AuroraCmd {

    static defaultOptions = {

        respWatchdogTimeout: 5000
    };

    constructor(dir, options) {

        dir = _.trim(dir, "/");
        
        super('sd-dir-del', [dir], _.defaultsDeep(options, AuroraCmdDeleteDir.defaultOptions));

        this.dir = dir;
    }
}
