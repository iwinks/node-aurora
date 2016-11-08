import AuroraCmd from "./AuroraCmd";

export default class AuroraCmdLedTransition extends AuroraCmd {

    constructor(ledMask1, color1, brightness1,
                ledMask2, color2, brightness2,
                transitionDuration, rewind, shutoffDelay = 0) {

        super('led-transition', [ledMask1, color1, brightness1, ledMask2, color2, brightness2, transitionDuration, rewind=false, shutoffDelay=0]);

        this.ledMask1 = ledMask1;
        this.color1 = color1;
        this.brightness1 = brightness1;
        this.ledMask2 = ledMask2;
        this.color2 = color2;
        this.brightness2 = brightness2;
        this.transitionDuration = transitionDuration;
        this.rewind = rewind;
        this.shutoffDelay = shutoffDelay;

    }
}