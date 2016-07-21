import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdEnableEventOutput extends AuroraCmd {

    constructor(eventId, outputMask, options) {

        super('event-output-enable', [eventId, outputMask], options);

        this.eventId = eventId;
        this.outputMask = outputMask;
    }
}
