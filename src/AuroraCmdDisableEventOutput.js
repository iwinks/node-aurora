import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdDisableEventOutput extends AuroraCmd {

    constructor(eventId, outputMask, options) {

        super('event-output-disable', [eventId, outputMask], options);

        this.eventId = eventId;
        this.outputMask = outputMask;
    }
}
