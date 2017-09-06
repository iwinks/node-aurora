exports.AURORA_USB_VID = '0x0483';
exports.AURORA_USB_SERIAL_PID = '0x5740';
exports.AURORA_USB_MSD_PID = '0xABED';

exports.MSD_DRIVE_NAME = 'Aurora Drive';

exports.LOW_BATTERY_THRESHOLD = 25;

exports.BLE_CMD_MAX_PACKET_LENGTH = 20;

exports.BLE_CMD_MAX_PAYLOAD = 120;

exports.BleCmdStates = {
    IDLE: 0,
    CMD_EXECUTE: 1,
    CMD_RESP_OBJECT_READY: 2,
    CMD_RESP_TABLE_READY: 3,
    CMD_INPUT_REQUESTED: 4
};

exports.BleAuroraService = '6175726f7261454daf7942b381af0204';

exports.BleAuroraChars = {

    AURORA_EVENT_INDICATED: '6175726f726149ce8077a614a0dda570',
    AURORA_EVENT_NOTIFIED: '6175726f726149ce8077a614a0dda571',

    CMD_DATA: '6175726f726149ce8077b954b033c880',
    CMD_STATUS: '6175726f726149ce8077b954b033c881',
    CMD_OUTPUT_INDICATED: '6175726f726149ce8077b954b033c882',
    CMD_OUTPUT_NOTIFIED: '6175726f726149ce8077b954b033c883',

    STREAM_DATA_INDICATED: '6175726f726149ce8077b954b033c890',
    STREAM_DATA_NOTIFIED: '6175726f726149ce8077b954b033c891'
};

exports.DataTypes = {
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

exports.EventIds = {

    SIGNAL_MONITOR: 0,
    SLEEP_TRACKER_MONITOR: 1,
    MOVEMENT_MONITOR: 2,
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

exports.EventIdsToNames = {

    [exports.EventIds.SIGNAL_MONITOR]: 'signal-monitor',
    [exports.EventIds.SLEEP_TRACKER_MONITOR]: 'st-monitor',
    [exports.EventIds.MOVEMENT_MONITOR]: 'movement-monitor',
    [exports.EventIds.STIM_PRESENTED]: 'stim-presented',

    [exports.EventIds.AWAKENING]: 'awakening',
    [exports.EventIds.AUTO_SHUTDOWN]: 'auto-shutdown',
    [exports.EventIds.EVENT_RESERVED1]: 'rsvd1',
    [exports.EventIds.EVENT_RESERVED2]: 'rsvd2',

    [exports.EventIds.EVENT_RESERVED3]: 'rsvd3',
    [exports.EventIds.EVENT_RESERVED4]: 'rsvd4',
    [exports.EventIds.EVENT_RESERVED5]: 'rsvd5',
    [exports.EventIds.EVENT_RESERVED6]: 'rsvd6',

    [exports.EventIds.EVENT_RESERVED7]: 'rsvd7',
    [exports.EventIds.EVENT_RESERVED8]: 'rsvd8',
    [exports.EventIds.EVENT_RESERVED9]: 'rsvd9',
    [exports.EventIds.EVENT_RESERVED10]: 'rsvd10',

    [exports.EventIds.BUTTON_MONITOR]: 'button-monitor',
    [exports.EventIds.SDCARD_MONITOR]: 'sdcard-monitor',
    [exports.EventIds.USB_MONITOR]: 'usb-monitor',
    [exports.EventIds.BATTERY_MONITOR]: 'batt-monitor',

    [exports.EventIds.BUZZ_MONITOR]: 'buzz-monitor',
    [exports.EventIds.LED_MONITOR]: 'led-monitor',
    [exports.EventIds.EVENT_RESERVED11]: 'rsvd11',
    [exports.EventIds.EVENT_RESERVED12]: 'rsvd12',

    [exports.EventIds.BLE_MONITOR]: 'ble-monitor',
    [exports.EventIds.BLE_NOTIFY]: 'ble-notify',
    [exports.EventIds.BLE_INDICATE]: 'ble-indicate',
    [exports.EventIds.CLOCK_ALARM_FIRE]: 'clock-alarm-fire',

    [exports.EventIds.CLOCK_TIMER0_FIRE]: 'clock-timer0-fire',
    [exports.EventIds.CLOCK_TIMER1_FIRE]: 'clock-timer1-fire',
    [exports.EventIds.CLOCK_TIMER2_FIRE]: 'clock-timer2-fire',
    [exports.EventIds.CLOCK_TIMER_FIRE]: 'clock-timer-fire'
};

exports.EVENT_ID_MAX = 31;

exports.EventOutputIds = {

    USB: 0,
    LOG: 1,
    SESSION_FILE: 2,
    PROFILE: 3,
    BLUETOOTH: 4
};

exports.StreamIds = {
    
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

exports.STREAM_ID_MAX = 31;

exports.StreamIdsToNames = {

    [exports.StreamIds.SIGNAL_QUALITY]: 'signal',
    [exports.StreamIds.RAW_EEG]: 'eeg',
    [exports.StreamIds.HEART_RATE]: 'heart',
    [exports.StreamIds.ACCEL_X]: 'accel-x',

    [exports.StreamIds.ACCEL_Y]: 'accel-y',
    [exports.StreamIds.ACCEL_Z]: 'accel-z',
    [exports.StreamIds.GYRO_X]: 'gyro-x',
    [exports.StreamIds.GYRO_Y]: 'gyro-y',

    [exports.StreamIds.GYRO_Z]: 'gyro-z',
    [exports.StreamIds.TEMPERATURE]: 'temp',
    [exports.StreamIds.BATTERY]: 'batt',
    [exports.StreamIds.STREAM_RESERVED1]: 'rsvd1',

    [exports.StreamIds.STREAM_RESERVED2]: 'rsvd2',
    [exports.StreamIds.STREAM_RESERVED3]: 'rsvd3',
    [exports.StreamIds.STREAM_RESERVED4]: 'rsvd4',
    [exports.StreamIds.STREAM_RESERVED5]: 'rsvd5',

    [exports.StreamIds.SLEEP_FEATURES]: 'sf',
    [exports.StreamIds.SLEEP_STAGES]: 'ss',
    [exports.StreamIds.SLEEP_TRACKER]: 'st',
    [exports.StreamIds.STREAM_RESERVED6]: 'rsvd6',

    [exports.StreamIds.STREAM_RESERVED7]: 'rsvd7',
    [exports.StreamIds.STREAM_RESERVED8]: 'rsvd8',
    [exports.StreamIds.STREAM_RESERVED9]: 'rsvd9',
    [exports.StreamIds.STREAM_RESERVED10]: 'rsvd10',

    [exports.StreamIds.ACCEL_MAGNITUDE]: 'accel-mag',
    [exports.StreamIds.GYRO_MAGNITUDE]: 'gyro-mag',
    [exports.StreamIds.ROTATION_ROLL]: 'roll',
    [exports.StreamIds.ROTATION_PITCH]: 'pitch',

    [exports.StreamIds.STREAM_RESERVED11]: 'rsvd11',
    [exports.StreamIds.STREAM_RESERVED12]: 'rsvd12',
    [exports.StreamIds.STREAM_RESERVED13]: 'rsvd13',
    [exports.StreamIds.STREAM_RESERVED14]: 'rsvd14'
};

exports.StreamOutputIds = {

    SILENT: 0,
    FILE_CSV: 1,
    FILE_RAW: 2,
    CONSOLE: 3,
    DATA_LOG: 4,
    BLE: 5
};

exports.SleepStages = {
  UNKNOWN: 0,
  AWAKE: 1,
  LIGHT: 2,
  DEEP: 3,
  REM: 4
};

exports.LogTypeIds = {

    DATA: 0,
    INFO: 1,
    EVENT: 2,
    WARNING: 3,
    ERROR: 4,
    DEBUG: 5
};

exports.LogNamesToTypeIds = {

    DATA: exports.LogTypeIds.DATA,
    INFO: exports.LogTypeIds.INFO,
    EVNT: exports.LogTypeIds.EVENT,
    WARN: exports.LogTypeIds.WARNING,
    ERRO: exports.LogTypeIds.ERROR,
    DBUG: exports.LogTypeIds.DEBUG
};

exports.BuzzerSongs = [
    { file: 'arpeggio.buzz', title: 'Arpeggio'},
    { file: 'axels-theme.buzz', title: 'Axel\s Theme'},
    { file: 'bach-minuet.buzz', title: 'Bach Minuet'},
    { file: 'bach-prelude.buzz', title: 'Bach Prelude'},
    { file: 'chromatic-scale.buzz', title: 'Chromatic Scale'},
    { file: 'debussy-arabesque.buzz', title: 'Debussy Arabesque'},
    { file: 'freedom-jazz-dance.buzz', title: 'Freedom Jazz Dance'},
    { file: 'grandfather-clock.buzz', title: 'Grandfather Clock'},
    { file: 'la-cucaracha.buzz', title: 'La Cucaracha'},
    { file: 'mario-theme.buzz', title: 'Mario Theme'},
    { file: 'morning-mood.buzz', title: 'Morning Mood'},
    { file: 'pink-panther-theme.buzz', title: 'Pink Panther Theme'},
    { file: 'reveille.buzz', title: 'Reveille'},
    { file: 'simpsons-theme.buzz', title: 'Simpson\s Theme'},
    { file: 'spain.buzz', title: 'Spain'},
    { file: 'whole-tone-scale.buzz', title: 'Whole Tone Scale'},
    { file: 'zelda-secret.buzz', title: 'Zelda Secret'}
];

exports.LedColors = [
    { name: 'white', value: '#FFFFFF'},
    { name: 'red', value: '#FF0000'},
    { name: 'orange',value: '#FFFF00'},
    { name: 'pink', value: '#FF00FF'},
    { name: 'cyan', value: '#00FFFF'},
    { name: 'green', value: '#00FF00'},
    { name: 'blue', value: '#0000FF'},
    { name: 'yellow', value: '#FF7700'}
];
