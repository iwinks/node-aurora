import AuroraCmd from "./AuroraCmd";
import _ from 'lodash';

export default class AuroraCmdDeleteDir extends AuroraCmd {

    constructor(dir, options) {

        dir = _.trim(dir, "/");

        super('sd-dir-del', [dir], options);

        this.dir = dir;
    }
}
