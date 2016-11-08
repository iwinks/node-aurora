import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdLedAlternate extends AuroraCmd {

    constructor(ledMask1, color1, brightness1, duration1,
                ledMask2, color2, brightness2, duration2,
                altCount, shutoffDelay = 0) {

        super('led-alternate', [ledMask1, color1, brightness1, duration1, ledMask2, color2, brightness2, duration2, altCount, shutoffDelay]);

        this.ledMask1 = ledMask1;
        this.color1 = color1;
        this.brightness1 = brightness1;
        this.duration1 = duration1;
        this.ledMask2 = ledMask2;
        this.color2 = color2;
        this.brightness2 = brightness2;
        this.duration2 = duration2;
        this.altCount = altCount;
        this.shutoffDelay = shutoffDelay;

    }
}