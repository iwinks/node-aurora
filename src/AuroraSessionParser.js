import {SleepStages, EventIds} from './AuroraConstants';

export default class AuroraSessionParser {

    static parseSessionTxtObject = (sessionTxtObject) => {

        const session = {
            awakenings: 0,
            sleepOnset: 0,
            incomplete: false,
            awakeAt: 0,
            asleepAt: 0,
            sleepScore: 0,
            sleepDuration: {
                total: 0,
                unknown: 0,
                awake: 0,
                light: 0,
                deep: 0,
                rem: 0
            },
            events: [],
            streams: []
        };

        const throwError = (error) => {

            session.error = error;
            return Promise.reject(session);
        };

        if (typeof sessionTxtObject != 'object') return throwError('Session object invalid.');

        //TODO: consider using deep assign
        Object.assign(session, sessionTxtObject);

        if (!session.version || !session.date || !session.profile || !session.duration) return throwError('Session corrupted.');

        if (parseInt(session.version) < 20001) return throwError('Aurora firmware version no longer supported.');

        if (!Array.isArray(session.events)) return throwError('Session event array corrupted.');

        if (!Array.isArray(session.streams)) return throwError('Session stream array corrupted.');

       //if (session.duration < 1000 * 60 * 30) return throwError('Session is shorter than 30 minutes.');

        for (let i = 0; i < session.events.length; i++) {

            const event = session.events[i];

            if (!event || typeof event != 'object'){

                //todo: fix this mess...
                //console.log('Missing event at index: ' + i);
                session.events.splice(i, 1);
                i--;
                continue;
            }

            if (typeof event.id == 'undefined' || typeof event.time == 'undefined' || typeof event.flags == 'undefined') {

                //console.log('Session event corrupted at index: ' + i);
                session.events.splice(i, 1);
                i--;
                continue;
            }

            event.date = session.date + event.time;
        }

        if (session.streams) {

            for (let i = 0; i < session.streams.length; i++) {

                const stream = session.streams[i];

                if (!stream || typeof stream != 'object'){

                    //console.log('Missing stream at index: ' + i);
                    session.streams.splice(i, 1);
                    i--;
                    continue;
                }

                if (typeof stream.id == 'undefined' || typeof stream.time == 'undefined' || typeof stream.type == 'undefined' || !stream.file) {

                    //console('Session stream corrupted at index: ' + i);
                    session.streams.splice(i, 1);
                    i--;
                    continue;
                }

                stream.date = session.date + stream.time;
            }
        }

        let firstSignalStageTime = 0;
        let currentStage = 0;
        let currentStageTime = 0;
        let currentStageDate = 0;

        const stageDurations = new Array(Object.keys(SleepStages).length).fill(0);

        for (const event of session.events) {

            switch (event.id) {

                case EventIds.SLEEP_TRACKER_MONITOR:

                    const stage = event.flags;

                    if (!firstSignalStageTime && stage > SleepStages.UNKNOWN) {

                        firstSignalStageTime = event.time;
                    }

                    if (currentStageTime) {

                        stageDurations[currentStage] += (event.time - currentStageTime);
                    }

                    //is this a non-awake stage?
                    if (stage > SleepStages.AWAKE) {

                        //is this the first non-awake sleep stage?
                        if (!session.asleepAt) {

                            session.asleepAt = event.date;
                            session.sleepOnset = event.time - firstSignalStageTime;
                        }
                    }
                    //is this an awake stage and have we found the first sleep event?
                    else if (stage == SleepStages.AWAKE && session.asleepAt) {

                        session.awakeAt = event.date;
                    }

                    //update current stage/time
                    currentStage = stage;
                    currentStageTime = event.time;
                    currentStageDate = event.date;

                    break;

                case EventIds.AUTO_SHUTDOWN:

                    session.incomplete = true;

                    break;

                case EventIds.AWAKENING:

                    session.awakenings++;

                    break;
            }
        }

        session.sleepDuration.total = stageDurations.reduce((p, c) => p + c);
        session.sleepDuration.unknown = stageDurations[SleepStages.UNKNOWN];
        session.sleepDuration.awake = stageDurations[SleepStages.AWAKE];
        session.sleepDuration.light = stageDurations[SleepStages.LIGHT];
        session.sleepDuration.deep = stageDurations[SleepStages.DEEP];
        session.sleepDuration.rem = stageDurations[SleepStages.REM];

        if (session.sleepDuration.total) {

            session.sleepScore = Math.floor((session.sleepDuration.deep + session.sleepDuration.rem) / session.sleepDuration.total * 100);
        }

        //if we have a complete session with a valid sleep start time
        //figure out when the awake time occurred
        if (session.asleepAt && !session.incomplete) {

            //is the last stage was awake (as it should be in the general case)
            //we can use the last stage time as the awake time
            if (currentStage == SleepStages.AWAKE){

                session.awakeAt = currentStageDate;
            }
            //for any other known stages, (/or if the last known stage was short enough)
            //we'll just use the session end time
            else if (currentStage != SleepStages.UNKNOWN || (session.duration - currentStageTime) < (1000 * 60 * 15)){

                session.awakeAt = session.date + session.duration;
            }
        }

        return Promise.resolve(session);
    };

};

