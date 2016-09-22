import _ from 'lodash';
import AuroraCmd from "./AuroraCmd";
import AuroraCmdReadFile from "./AuroraCmdReadFile";
import {SleepStages, Events} from './AuroraConstants';
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
            firmware_version: 0,
            aurora_profile_id: '',
            aurora_profile_name: '',
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
            asleep_at: 0,
            awake_at: 0,
            session_at: 0
        };

        const streams = [];
        const events = [];

        let firstSignalStageTime = 0;
        let currentStage = 0;
        let currentStageTime = 0;

        const stageDurations = new Array(Object.keys(SleepStages).length).fill(0);

        if (sessionObj.date && sessionObj.duration){

            session.session_at = moment(sessionObj.date).valueOf();
            session.session_duration = sessionObj.duration;
    
            const version = sessionObj.version.match(/(\d+).(\d+).(\d+)/);

            session.firmware_version = (parseInt(version[1]) * 10000) + (parseInt(version[2]) * 100) + parseInt(version[3]);

            if (sessionObj.profile){
                if (sessionObj.profile.name){
                    session.aurora_profile_name = sessionObj.profile.name;
                }
                if (sessionObj.profile.id){
                    session.aurora_profile_id = sessionObj.profile.id;
                }
            }
        }

        for (let [key, val] of Object.entries(sessionObj)){

            if (key == 'streams'){

                for (let [streamId, streamObject] of Object.entries(val)){

                    for (const stream of Object.values(streamObject)){

                        if (typeof stream.duration == 'undefined' || typeof stream.time == 'undefined'){

                            console.log('corrupt stream ' + streamId, stream);
                            continue;
                        }


                        streams.push({
                            aurora_stream_id: streamId,
                            file: stream.file,
                            duration: stream.duration,
                            data_type: stream.type,
                            stream_at: session.session_at + stream.time
                        });
                    }
                }
            }
            else if (key == 'events'){

                for (let [eventId, eventObject] of Object.entries(val)){

                    eventId = parseInt(eventId);

                    for (const event of Object.values(eventObject)){

                        if (typeof event.flags == 'undefined' ||typeof event.time == 'undefined') {
                            console.log('corrupt event ' + eventId, event);
                            continue;
                        }

                        const newEvent = {
                            aurora_event_id: eventId,
                            flags: event.flags
                        };

                        newEvent.event_at = session.session_at + event.time;
                        newEvent.time = event.time;

                        //sleep events
                        if (eventId == Events.SLEEP_TRACKER_MONITOR){

                            const stage = newEvent.flags;

                            if (!firstSignalStageTime && stage > SleepStages.UNKNOWN){

                                firstSignalStageTime = newEvent.time;
                            }

                            if (currentStageTime){

                                stageDurations[currentStage] += (newEvent.time - currentStageTime);
                            }

                            //is this a non-awake stage?
                            if (stage > SleepStages.AWAKE){

                                //is this the first non-awake sleep stage?
                                if (!session.asleep_at){

                                    session.asleep_at = newEvent.event_at;
                                    session.sleep_onset = newEvent.time - firstSignalStageTime;
                                }
                            }
                            //is this an awake stage and have we found the first sleep event?
                            else if (stage == SleepStages.AWAKE && session.asleep_at){

                                session.awake_at = newEvent.event_at;
                            }

                            //update current stage/time
                            currentStage = stage;
                            currentStageTime = newEvent.time;
                        }
                        else if (eventId == Events.AUTO_SHUTDOWN){

                            session.incomplete = true;
                        }

                        events.push(newEvent);
                    }
                }
            }
        }

        session.no_signal_duration = stageDurations[SleepStages.UNKNOWN];
        session.awake_duration = stageDurations[SleepStages.AWAKE];
        session.light_duration = stageDurations[SleepStages.LIGHT];
        session.deep_duration = stageDurations[SleepStages.DEEP];
        session.rem_duration = stageDurations[SleepStages.REM];
        sesssion.sleep_duration = session.light_duration + session.deep_duration + session.rem_duration;

        session.sleep_score = session.sleep_duration ? Math.floor((session.deep_duration + session.rem_duration) / session.sleep_duration * 200): 0;

        return { session, streams, events};
    };

}
