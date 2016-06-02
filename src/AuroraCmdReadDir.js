import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdReadDir extends AuroraCmd {

    constructor(dir, filter, options) {

        super('sd-dir-read', [], options);

        this.dir = dir;
        this.filter = filter;
    }
}