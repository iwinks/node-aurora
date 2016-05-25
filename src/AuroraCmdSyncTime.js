import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdSyncTime extends AuroraCmd {

    constructor(options) {

        super('clock-set', [], options);
    }

    toString() {

        let date = new Date();

        let ms_after_midnight = date.getHours() * 3600000 + date.getMinutes() * 60000 + date.getSeconds() * 1000 + date.getMilliseconds();

        let cmdStr = this.cmd + ' ' + date.getFullYear() + ' '
            + (date.getMonth() + 1) + ' '
            + date.getDate() + ' '
            + ms_after_midnight;

        return cmdStr;
    }

}
