import {SleepStages, EventIds} from './AuroraConstants';

export default class AuroraSessionParser {

    static parseSessionTxtObject = (sessionTxtObject) => {

        if (typeof sessionTxtObject != 'object') return Promise.reject('Session object invalid.');

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
            }
        };

        //TODO: consider using deep assign
        Object.assign(session, sessionTxtObject);

        //if (!session.version < 20001) return Promise.reject('Aurora firmware version no longer supported.');

        if (!session.date || !session.profile || !session.duration) return Promise.reject('Session corrupted.');

        if (!Array.isArray(session.events) || !session.events.length) return Promise.reject('Session has no events.');

        //if (session.duration < 1000 * 60 * 30) return Promise.reject('Session is shorter than 30 minutes.');

        let signalPresent = false;

        for (const event of session.events) {

            if (typeof event.id == 'undefined' || typeof event.time == 'undefined' || typeof event.flags == 'undefined') {

                return Promise.reject('One or more session events are corrupted.');
            }

            if (event.id == EventIds.SLEEP_TRACKER_MONITOR && event.flags != SleepStages.UNKNOWN) {

                signalPresent = true;
            }

            event.date = session.date + event.time;
        }

        if (!signalPresent) return Promise.reject('Session does not contain a clean EEG signal.');

        if (session.streams) {

            if (!Array.isArray(session.streams)) return Promise.reject('Session stream array corrupted.');

            for (const stream of session.streams) {

                if (typeof stream.id == 'undefined' || typeof stream.time == 'undefined' || typeof stream.type == 'undefined' || !stream.file) {

                    return Promise.reject('One or more session streams are corrupted.');
                }

                stream.date = session.date + stream.time;
            }
        }

        let firstSignalStageTime = 0;
        let currentStage = 0;
        let currentStageTime = 0;

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

            session.sleepScore = Math.floor((session.sleepDuration.deep + session.sleepDuration.rem) / session.sleepDuration.total * 200);
        }

        return Promise.resolve(session);
    };

};

