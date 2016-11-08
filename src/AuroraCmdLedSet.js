import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdLedSet extends AuroraCmd {

    constructor(ledMask, color, brightness, duration) {

        super('led-set', [ledMask, color, brightness, duration]);

        this.ledMask = ledMask;
        this.color = color;
        this.brightness = brightness;
        this.duration = duration;
    }
}
