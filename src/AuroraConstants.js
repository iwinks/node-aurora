const AURORA_USB_VID = "0x0483";
exports.AURORA_USB_VID = AURORA_USB_VID;

const DataTypes = {
    UNKNOWN: 0,
    BOOL: 1,
    CHAR: 2,
    UINT8: 3,
    INT8: 4,
    UINT16: 5,
    INT16: 6,
    UINT32: 7,
    INT32: 8,
    FLOAT: 9,
    STR: 10,
    PTR: 11
};

exports.DataTypes = DataTypes;

const Events = {

    SIGNAL_MONITOR: 0,
    SLEEP_TRACKER_MONITOR: 1,
    MOVEMENT: 2,
    STIM_PRESENTED: 3,

    AWAKENING: 4,
    AUTO_SHUTDOWN: 5,
    EVENT_RESERVED1: 6,
    EVENT_RESERVED2: 7,

    EVENT_RESERVED3: 8,
    EVENT_RESERVED4: 9,
    EVENT_RESERVED5: 10,
    EVENT_RESERVED6: 11,

    EVENT_RESERVED7: 12,
    EVENT_RESERVED8: 13,
    EVENT_RESERVED9: 14,
    EVENT_RESERVED10: 15,

    BUTTON_MONITOR: 16,
    SDCARD_MONITOR: 17,
    USB_MONITOR: 18,
    BATTERY_MONITOR: 19,

    BUZZ_MONITOR: 20,
    LED_MONITOR: 21,
    EVENT_RESERVED11: 22,
    EVENT_RESERVED12: 23,

    BLE_MONITOR: 24,
    BLE_NOTIFY: 25,
    BLE_INDICATE: 26,
    CLOCK_ALARM_FIRE: 27,

    CLOCK_TIMER0_FIRE: 28,
    CLOCK_TIMER1_FIRE: 29,
    CLOCK_TIMER2_FIRE: 30,
    CLOCK_TIMER_FIRE: 31
};


exports.Events = Events;

const EventOutputs = {

    USB: 0,
    LOG: 1,
    SESSION_FILE: 2,
    PROFILE: 3,
    BLUETOOTH: 4
};

exports.EventOutputs = EventOutputs;

const Streams = {
    
    SIGNAL_QUALITY: 0,
    RAW_EEG: 1,
    HEART_RATE: 2,
    ACCEL_X: 3,
    
    ACCEL_Y: 4,
    ACCEL_Z: 5,
    GYRO_X: 6,
    GYRO_Y: 7,
    
    GYRO_Z: 8,
    TEMPERATURE: 9,
    BATTERY: 10,
    STREAM_RESERVED1: 11,
    
    STREAM_RESERVED2: 12,
    STREAM_RESERVED3: 13,
    STREAM_RESERVED4: 14,
    STREAM_RESERVED5: 15,

    SLEEP_FEATURES: 16,
    SLEEP_STAGES: 17,
    SLEEP_TRACKER: 18,
    STREAM_RESERVED6: 19,

    STREAM_RESERVED7: 20,
    STREAM_RESERVED8: 21,
    STREAM_RESERVED9: 22,
    STREAM_RESERVED10: 23,

    ACCEL_MAGNITUDE: 24,
    GYRO_MAGNITUDE: 25,
    ROTATION_ROLL: 26,
    ROTATION_PITCH: 27,
    
    STREAM_RESERVED11: 28,
    STREAM_RESERVED12: 29,
    STREAM_RESERVED13: 30,
    STREAM_RESERVED14: 31
};


exports.Streams = Streams;

const StreamOutputs = {

    SILENT: 0,
    FILE_CSV: 1,
    FILE_RAW: 2,
    CONSOLE: 3,
    DATA_LOG: 4,
    BLE: 5
};

exports.StreamOutputs = StreamOutputs;

const SleepStages = {
  UNKNOWN: 0,
  AWAKE: 1,
  LIGHT: 2,
  DEEP: 3,
  REM: 4
};

exports.SleepStages = SleepStages;

const LogTypes = {

    DATA: 0,
    INFO: 1,
    EVENT: 2,
    WARNING: 3,
    ERROR: 4,
    DEBUG: 5
};

exports.LogTypes = LogTypes;

const LogNamesToTypes = {

    DATA: LogTypes.DATA,
    INFO: LogTypes.INFO,
    EVNT: LogTypes.EVENT,
    WARN: LogTypes.WARNING,
    ERRO: LogTypes.ERROR,
    DBUG: LogTypes.DEBUG
};

exports.LogNamesToTypes = LogNamesToTypes;