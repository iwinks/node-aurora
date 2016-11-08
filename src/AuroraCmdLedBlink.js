import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdLedBlink extends AuroraCmd {

    constructor(ledMask, color, brightness, blinkCount, blinkSpeed = 500, shutoffDelay = 0) {

        super('led-blink', [ledMask, color, brightness, blinkCount, blinkSpeed, shutoffDelay]);

        this.ledMask = ledMask;
        this.color = color;
        this.brightness = brightness;
        this.blinkCount = blinkCount;
        this.blinkSpeed = blinkSpeed;
        this.shutoffDelay = shutoffDelay;

    }
}