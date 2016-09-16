import _ from 'lodash';
import AuroraCmd from "./AuroraCmd";
import AuroraCmdReadFile from "./AuroraCmdReadFile";
import moment from 'moment';

export default class AuroraCmdSessionInfo extends AuroraCmdReadFile {

    static defaultOptions = {
        respTypeSuccess: AuroraCmd.RespTypes.OBJECT
    };

    constructor(srcPath, options) {

        super(srcPath, _.defaultsDeep(options, AuroraCmdSessionInfo.defaultOptions));
    }

    onSuccess() {

        this.respSuccess = AuroraCmdSessionInfo.processSession(this.respSuccess);

        super.onSuccess();
    }

    static processSession = (sessionObj) => {

        const session = {
            firmware_version: null,
            aurora_profile_id: null,
            awakenings: 0,
            sleep_onset: 0,
            session_duration: 0,
            sleep_duration: 0,
            no_signal_duration: 0,
            awake_duration: 0,
            light_duration: 0,
            deep_duration: 0,
            rem_duration: 0,
            sleep_score: 0,
            incomplete: false,
            asleep_at: null,
            awake_at: null,
            session_at: null
        };

        const streams = [];
        const events = [];

        let firstSignalStageTime = 0;
        let currentStage = 0;
        let currentStageTime = 0;
        let lastAwakeningTime = 0;


        const stageDurations = [0, 0, 0, 0, 0];

        if (sessionObj.date && sessionObj.duration){

            session.session_at = moment(sessionObj.date).valueOf();
            session.firmware_version = sessionObj.version;
            session.session_duration = sessionObj.duration;
        }

        for (let [key, val] of Object.entries(sessionObj)){

            if (key == 'streams'){

                for (let [streamId, streamObject] of Object.entries(val)){

                    for (const stream of Object.values(streamObject)){

                        streams.push({
                            aurora_stream_id: streamId,
                            stream_duration: stream.duration,
                            stream_at: stream.date
                        });
                    }
                }
            }
            else if (key == 'events'){

                for (let [eventId, eventObject] of Object.entries(val)){

                    for (const event of Object.values(eventObject)){

                        const newEvent = {
                            aurora_event_id: eventId,
                            flags: event.flags
                        };

                        if (event.date){
                            newEvent.event_at = moment(event.date).valueOf();
                            newEvent.time = newEvent.event_at - session.session_at;
                        }
                        else if (event.time){
                            newEvent.event_at = session.session_at + event.time;
                            newEvent.time = event.time;
                        }

                        //sleep events
                        if (eventId == '15'){

                            const stage =  Math.log2(newEvent.flags & 0x000000FF);

                            if (!firstSignalStageTime && stage > 0){

                                firstSignalStageTime = newEvent.time;
                            }

                            if (currentStageTime){

                                stageDurations[currentStage] += (newEvent.time - currentStageTime);
                            }

                            //is this a non-awake stage?
                            if (stage > 1){

                                //is this the first non-awake sleep stage?
                                if (!session.asleep_at){

                                    session.asleep_at = newEvent.event_at;
                                    session.sleep_onset = newEvent.time - firstSignalStageTime;
                                }
                                //was the previous stage awake
                                //and did the last awakening occur more than
                                //5 minutes ago
                                else if (currentStage == 1 && (newEvent.time - lastAwakeningTime) > 1000*60*5){

                                    lastAwakeningTime = newEvent.time;

                                    events.push({
                                        aurora_event_id: 16,
                                        flags: 1,
                                        time: currentStageTime,
                                        event_at: session.session_at + currentStageTime
                                    });

                                    session.awakenings++;
                                }
                            }
                            //is this an awake stage and have we found the first sleep event?
                            else if (stage == 1 && session.asleep_at){

                                session.awake_at = newEvent.event_at;
                                session.sleep_duration = session.awake_at - session.asleep_at;
                            }

                            //update current stage/time
                            currentStage = stage;
                            currentStageTime = newEvent.time;
                        }

                        events.push(newEvent);
                    }
                }
            }
        }

        session.no_signal_duration = stageDurations[0];
        session.awake_duration = stageDurations[1];
        session.light_duration = stageDurations[2];
        session.deep_duration = stageDurations[3];
        session.rem_duration = stageDurations[4];
        session.sleep_score = Math.floor((session.deep_duration + session.rem_duration) / session.sleep_duration * 200);

        return { session, streams, events};
    };

}
