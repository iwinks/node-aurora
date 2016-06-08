import _ from 'lodash';
import AuroraCmd from "./AuroraCmd";
import AuroraCmdReadFile from "./AuroraCmdReadFile";

export default class AuroraCmdSessionInfo extends AuroraCmdReadFile {

    static defaultInfo = {
        startTime: 0,
        duration: 0,
        events: {},
        streams: {},
        sleepAwakenings: 0,
        sleepStages: {0: 0, 1: 0, 2: 0, 3: 0, 4: 0},
        sleepOnset: 0,
        sleepData: []
    };

    static defaultOptions = {
        respTypeSuccess: AuroraCmd.RespTypes.OBJECT
    };

    constructor(srcPath, options) {

        super(srcPath, _.defaultsDeep(options, AuroraCmdSessionInfo.defaultOptions));
    }

    _commandResponse() {

        this.respSuccess = _.defaultsDeep(this.respSuccess, AuroraCmdSessionInfo.defaultInfo);

        //TODO: consider some kind of corruption check here...

        if (this.respSuccess.events && this.respSuccess.events[15]) {

            let sleeping = false;

            let timeOffset = 0;
            let currentStageTime = 0;
            let currentStage = 0;
            let currentStageDate = 0;

            let totalSleepDuration = 0;
            let numEventsToProcess = _.keys(this.respSuccess.events[15]).length;

            _.forEach(this.respSuccess.events[15], (sleepEvent, key) => {

                let stage = Math.log2(sleepEvent.flags & 0x000000FF);

                if (!timeOffset){

                    timeOffset = sleepEvent.date;
                    currentStage = stage;
                    currentStageDate = sleepEvent.date;
                }

                let eventTime = sleepEvent.date - timeOffset;

                if (!sleeping && stage > 1) {
                    sleeping = true;
                    if (this.respSuccess.sleepOnset === false){
                        this.respSuccess.sleepOnset = eventTime;
                    }
                }

                if (sleeping && stage == 1) {
                    sleeping = false;
                    this.respSuccess.sleepAwakenings++;
                }


                //if this is the last event, we need to
                //mark the stage time even if it hasn't changed
                numEventsToProcess--;

                if (currentStage != stage || !numEventsToProcess){

                    let currentStageDuration = eventTime - currentStageTime;


                    this.respSuccess.sleepData.push({
                        date: currentStageDate,
                        time: currentStageTime,
                        stage: currentStage,
                        duration: currentStageDuration
                    });

                    this.respSuccess.sleepStages[currentStage] += currentStageDuration;

                    currentStageDate = sleepEvent.date;
                    currentStageTime = eventTime;
                    currentStage = stage;

                    totalSleepDuration += currentStageDuration;
                }



            });

            //is there any time left over?
            if (totalSleepDuration && this.respSuccess.duration > totalSleepDuration){

                //tack on remainder of sleep to current stage
                this.respSuccess.sleepStages[currentStage] += (this.respSuccess.duration - totalSleepDuration);
            }

        }

        //this means we never fell asleep
        if (this.respSuccess.sleepOnset === false){

            this.respSuccess.sleepOnset = this.respSuccess.duration;
        }

        super._commandResponse();
    }

}
