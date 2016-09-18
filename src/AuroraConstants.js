const ResponseStates = {

    NO_COMMAND: 0,
    COMMAND_HEADER: 1,
    COMMAND_RESPONSE_SUCCESS: 2,
    COMMAND_RESPONSE_ERROR: 3,
    COMMAND_FOOTER_SUCCESS: 4,
    COMMAND_FOOTER_ERROR: 5,
    FLUSHING_RESPONSE: 6
};

module.exports.ResponseStates = ResponseStates;

const AURORA_USB_VID = "0x0483";
module.exports.AURORA_USB_VID = AURORA_USB_VID;

const AURORA_PACKET_SYNC_BYTE = 0xAA;
module.exports.AURORA_PACKET_SYNC_BYTE = AURORA_PACKET_SYNC_BYTE;

const AURORA_PACKET_OK_BYTE = 0xAA;
module.exports.AURORA_PACKET_OK_BYTE = AURORA_PACKET_OK_BYTE;

const AURORA_PACKET_ERROR_BYTE = 0xCC;
module.exports.AURORA_PACKET_ERROR_BYTE = AURORA_PACKET_ERROR_BYTE;

const AURORA_PACKET_MAX_RETRIES = 3;
module.exports.AURORA_PACKET_MAX_RETRIES = AURORA_PACKET_MAX_RETRIES;

const COMMAND_PROMPT = "# ";
module.exports.COMMAND_PROMPT = COMMAND_PROMPT;

const COMMAND_DIVIDER_SUCCESS_CHAR = '-';
module.exports.COMMAND_DIVIDER_SUCCESS_CHAR = COMMAND_DIVIDER_SUCCESS_CHAR;

const COMMAND_DIVIDER_SUCCESS_STRING = '----------------------------------------------------------------';
module.exports.COMMAND_DIVIDER_SUCCESS_STRING = COMMAND_DIVIDER_SUCCESS_STRING;

const COMMAND_DIVIDER_ERROR_CHAR = '~';
module.exports.COMMAND_DIVIDER_ERROR_CHAR = COMMAND_DIVIDER_ERROR_CHAR;

const COMMAND_DIVIDER_ERROR_STRING = '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~';
module.exports.COMMAND_DIVIDER_ERROR_STRING = COMMAND_DIVIDER_ERROR_STRING;


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

module.exports.DataTypes = DataTypes;

const Events = {

    SIGNAL_MONITOR: 0,
    SLEEP_TRACKER_MONITOR: 1,
    MOVEMENT: 2,
    STIM_PRESENTED: 3,

    AWAKENING: 4,
    AUTO_SHUTDOWN: 5,

    BUTTON_MONITOR: 16,
    SDCARD_MONITOR: 17,
    USB_MONITOR: 18,
    CLOCK_TIMER_FIRE: 19,

    CLOCK_TIMER_COMPLETE: 20,
    CLOCK_ALARM_FIRE: 21,
    BATTERY_MONITOR: 22,

    EVENT_MONITOR: 24,
    STREAM_BUFFER_FULL: 25,
    STREAM_BUFFER_OVERFLOW: 26,
    ALGO_DB_READY: 27
};

module.exports.Events = Events;

const EventOutputs = {

    USB: 0,
    LOG: 1,
    SESSION_FILE: 2,
    PROFILE: 3,
    BLUETOOTH: 4
};

module.exports.EventOutputs = EventOutputs;

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

    SLEEP_FEATURES: 16,
    SLEEP_STAGES: 17,
    SLEEP_TRACKER: 18,

    ACCEL_MAGNITUDE: 24,
    GYRO_MAGNITUDE: 25,
    ROTATION_ROLL: 26,
    ROTATION_PITCH: 27
};

module.exports.Streams = Streams;

const StreamOutputs = {

    SILENT: 0,
    FILE_CSV: 1,
    FILE_RAW: 2,
    CONSOLE: 3,
    DATA_LOG: 4,
    BLE: 5
};

module.exports.StreamOutputs = StreamOutputs;

const LogTypes = {

    DATA: 0,
    INFO: 1,
    EVENT: 2,
    WARNING: 3,
    ERROR: 4
};

module.exports.LogTypes = LogTypes;

const LogNamesToTypes = {

    DATA: LogTypes.DATA,
    INFO: LogTypes.INFO,
    EVNT: LogTypes.EVENT,
    WARN: LogTypes.WARNING,
    ERRO: LogTypes.ERROR
};

module.exports.LogNamesToTypes = LogNamesToTypes;