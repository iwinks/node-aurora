const ResponseStates = {

    NO_COMMAND: 0,
    COMMAND_HEADER: 1,
    COMMAND_RESPONSE: 2,
    COMMAND_FOOTER: 3
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