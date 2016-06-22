import Aurora from "./Aurora";
import AuroraCmdTransformLines from "./AuroraCmdTransformLines";
import AuroraCmdTransformObject from "./AuroraCmdTransformObject";
import AuroraConstants from "./AuroraConstants";

import Stream from "stream";
import _ from "lodash";

export default class AuroraCmd {
    
    static RespTypes = {
        
        STRING: 0,
        ARRAY: 1,
        OBJECT: 2
    };
    
    static defaultOptions = {

        packetMode: false,                              //commands that return a lot of data can use this mode
        respWatchdogTimeout: 1000,                      //how long the command has to finish before timing out
        respTypeSuccess: AuroraCmd.RespTypes.ARRAY,     //by default, success response returns array of lines
        respTypeError: AuroraCmd.RespTypes.OBJECT,      //and error returns object { error: #, message: "" }
        respTypeSuccessOptions: {},
        respTypeErrorOptions: {}
    };
    
    constructor(cmd, args, options) {

        this.options = _.defaultsDeep(options, AuroraCmd.defaultOptions);

        this.cmd = cmd;
        this.args = args || [];

        this._reject = function () {};
        this._fulfill = function () {};

        //used to indicate whether response piped to respOutputStream is an error response
        this.error = false;
    }

    //called when a command is added to the processing queue
    queue() {

        //returns a promise so the Aurora can be notified
        //when a command is finished
        return new Promise((fulfill, reject) => {

            this._fulfill = fulfill;
            this._reject = reject;
        });

    }

    _setupRespSuccess() {

        switch (this.options.respTypeSuccess){
            
            case AuroraCmd.RespTypes.ARRAY:

                this.respSuccess = [];
                this.respSuccessStreamFront = new Stream.PassThrough({decodeStrings: true, encoding: null});
                this.respSuccessStreamBack = new AuroraCmdTransformLines(this.options.respTypeSuccessOptions);
                break;
            
            case AuroraCmd.RespTypes.OBJECT:
                this.respSuccess = {};
                this.respSuccessStreamFront = new Stream.PassThrough({decodeStrings: true, encoding: null});
                this.respSuccessStreamBack = new AuroraCmdTransformObject(this.options.respTypeSuccessOptions);
                
                break;

            case AuroraCmd.RespTypes.STRING:
            default:
                this.respSuccess = "";
                this.respSuccessStreamFront = new Stream.PassThrough({decodeStrings: true, encoding: null});
                this.respSuccessStreamBack = new Stream.PassThrough({decodeStrings: true, encoding: null });

        }

        //forward front streams to back streams
        this.respSuccessStreamFront.pipe(this.respSuccessStreamBack);
    }

    _setupRespError() {
    
        switch (this.options.respTypeError){
        
            case AuroraCmd.RespTypes.ARRAY:
                this.respError = [];
                this.respErrorStreamFront = new Stream.PassThrough({decodeStrings: true, encoding: null});
                this.respErrorStreamBack = new AuroraCmdTransformLines(this.options.respTypeErrorOptions);
                break;
        
            case AuroraCmd.RespTypes.OBJECT:
                this.respError = {};
                this.respErrorStreamFront = new Stream.PassThrough({decodeStrings: true, encoding: null});
                this.respErrorStreamBack = new AuroraCmdTransformObject(this.options.respTypeErrorOptions);
                break;

            case AuroraCmd.RespTypes.STRING:
            default:
                this.respError = "";
                this.respErrorStreamFront = new Stream.PassThrough({decodeStrings: true, encoding: null});
                this.respErrorStreamBack = new Stream.PassThrough({decodeStrings: true, encoding: null });
        }

        //forward front streams to back streams
        this.respErrorStreamFront.pipe(this.respErrorStreamBack);
    }

    //called when a command is ready to be processed
    exec() {

        this.petWatchdog();

        this._setupRespSuccess();
        this._setupRespError();

        this.error = false;

        this.respSuccessStreamBack.on('data', this._onRespSuccessData.bind(this));
        this.respErrorStreamBack.on('data', this._onRespErrorData.bind(this));

        this.respSuccessStreamBack.on('finish', this._commandResponse.bind(this));
        this.respErrorStreamBack.on('finish', this._commandResponse.bind(this));

        //write command string to input stream,
        Aurora._serial.write(this.toString() + '\n');
    }

    petWatchdog() {

        //this timer fires if the command response
        //isn't received within the specified time
        if (this.options.respWatchdogTimeout) {

            clearTimeout(this.respTimer);

            this.respTimer = setTimeout(() => {

                this.triggerError(-1, "Aurora command timed out.");

            }, this.options.respWatchdogTimeout);
        }

    }

    triggerError(errorCode, errorMessage){

        this.error = true;
        this.respTypeError = AuroraCmd.RespTypes.OBJECT;
        this.respError = { error: errorCode, message: errorMessage};

        //TODO: make sure this is still necessary
        Aurora._responseUnparsedBuffer = null;
        Aurora._responseState = AuroraConstants.ResponseStates.NO_COMMAND;
        
        this.respErrorStreamFront.end();
    }

    //process response
    _onRespSuccessData(data) {

        this.cmdCurrent.petWatchdog();

        switch (this.options.respTypeSuccess){

            case AuroraCmd.RespTypes.ARRAY:
                this.respSuccess = this.respSuccess.concat(data);
                break;

            case AuroraCmd.RespTypes.OBJECT:
                this.respSuccess = _.merge(this.respSuccess, data);
                break;

            case AuroraCmd.RespTypes.STRING:
            default:
                this.respSuccess += data.toString();
        }

    }

    _onRespErrorData(data) {

        this.cmdCurrent.petWatchdog();

        switch (this.options.respTypeError){

            case AuroraCmd.RespTypes.ARRAY:
                this.respError = this.respError.concat(data);
                break;

            case AuroraCmd.RespTypes.OBJECT:
                this.respError = _.merge(this.respError, data);
                break;

            case AuroraCmd.RespTypes.STRING:
            default:
                this.respError += data.toString();
        }
    }

    _commandResponse(){

        clearTimeout(this.respTimer);

        this.respSuccessStreamFront.removeAllListeners();
        this.respErrorStreamFront.removeAllListeners();
        this.respSuccessStreamBack.removeAllListeners();
        this.respErrorStreamBack.removeAllListeners();

        if (this.error) {
            this._reject(this.respError);
        }
        else {
            this._fulfill(this.respSuccess);
        }
    }

    toString() {
        let cmdStr = this.cmd;
        if (this.args) {

            for (var i = 0; i < this.args.length; i++) {
                cmdStr += ' ' + (typeof this.args[i] == 'boolean' ? +this.args[i] : this.args[i].toString());
            }
        }
        return cmdStr;
    }
}
