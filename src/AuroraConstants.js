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

    EVENT_MONITOR: 0,
    BUTTON_MONITOR: 1,
    SDCARD_MONITOR: 2,
    BATTERY_MONITOR: 3,
    CLOCK_MONITOR: 4,
    CLOCK_TIMER_FIRE: 5,
    CLOCK_TIMER_COMPLETE: 6,
    CLOCK_ALARM_FIRE: 7,
    USB_MONITOR: 8,
    STREAM_BUFFER_FULL: 9,
    STREAM_BUFFER_OVERFLOW: 10,
    STREAM_BUFFER_PROCESSED: 11,
    ALGO_DB_READY: 12,
    ALGO_START: 13,
    ALGO_COMPLETE: 14,
    SLEEP_STAGE_MONITOR: 15
};

module.exports.Events = Events;

const EventOutputs = {

    USB: 1,
    LOG: 2,
    SESSION_FILE: 4,
    PROFILE: 8,
    BLUETOOTH: 16
};

module.exports.EventOutputs = EventOutputs;

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