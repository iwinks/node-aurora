import AuroraCmd from "./AuroraCmd";
import _ from "lodash";

export default class AuroraCmdFlash extends AuroraCmd {

    static defaultOptions = {

        respTimeout: 60000
    };

    constructor(options) {

        super('os-flash', [], _.defaultsDeep(options, AuroraCmdFlash.defaultOptions));
    }
}
