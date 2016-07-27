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
        respWatchdogTimeout: 3000,                      //how long the command has to finish before timing out
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
                this.respSuccessStreamFront = new Stream.PassThrough();
                this.respSuccessStreamBack = new AuroraCmdTransformLines(this.options.respTypeSuccessOptions);
                break;
            
            case AuroraCmd.RespTypes.OBJECT:
                this.respSuccess = {};
                this.respSuccessStreamFront = new Stream.PassThrough();
                this.respSuccessStreamBack = new AuroraCmdTransformObject(this.options.respTypeSuccessOptions);
                
                break;

            case AuroraCmd.RespTypes.STRING:
            default:
                this.respSuccess = "";
                this.respSuccessStreamFront = new Stream.PassThrough();
                this.respSuccessStreamBack = new Stream.PassThrough();

        }

        //forward front streams to back streams
        this.respSuccessStreamFront.pipe(this.respSuccessStreamBack);
    }

    _setupRespError() {
    
        switch (this.options.respTypeError){
        
            case AuroraCmd.RespTypes.ARRAY:
                this.respError = [];
                this.respErrorStreamFront = new Stream.PassThrough();
                this.respErrorStreamBack = new AuroraCmdTransformLines(this.options.respTypeErrorOptions);
                break;
        
            case AuroraCmd.RespTypes.OBJECT:
                this.respError = {};
                this.respErrorStreamFront = new Stream.PassThrough();
                this.respErrorStreamBack = new AuroraCmdTransformObject(this.options.respTypeErrorOptions);
                break;

            case AuroraCmd.RespTypes.STRING:
            default:
                this.respError = "";
                this.respErrorStreamFront = new Stream.PassThrough();
                this.respErrorStreamBack = new Stream.PassThrough();
        }

        //forward front streams to back streams
        this.respErrorStreamFront.pipe(this.respErrorStreamBack);
    }

    //called when a command is ready to be processed
    exec() {

        this.petWatchdog();

        this._setupRespSuccess();
        this._setupRespError();

        this.respSuccessStreamBack.on('data', this.onRespSuccessData.bind(this));
        this.respErrorStreamBack.on('data', this.onRespErrorData.bind(this));


        this.respSuccessStreamBack.on('finish', this.onSuccess.bind(this));
        this.respErrorStreamBack.on('finish', this.onError.bind(this));

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

        this.respTypeError = AuroraCmd.RespTypes.OBJECT;
        this.respError = { error: errorCode, message: errorMessage};

        this.respErrorStreamFront.end();
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


    //process response
    onRespSuccessData(data){

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

    onRespErrorData(data){

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

    onError(){

        clearTimeout(this.respTimer);

        this._destroyResponseStreams();

        this._reject(this.respError);
    }

    onSuccess(){

        clearTimeout(this.respTimer);

        this._destroyResponseStreams();

        this._fulfill(this.respSuccess);
    };

    _destroyResponseStreams(){

        if (this.respSuccessStreamBack) {

            this.respSuccessStreamBack.removeListener('data', this.onRespSuccessData);
            this.respSuccessStreamBack.removeListener('finish', this.onSuccess);
            this.respSuccessStreamBack = null;
        }

        if (this.respErrorStreamBack) {

            this.respErrorStreamBack.removeListener('data', this.onRespErrorData);
            this.respErrorStreamBack.removeListener('finish', this.onError);
            this.respErrorStreamBack = null;
        }

        this.respSuccessStreamFront = null;
        this.respErrorStreamFront = null;
    }
}
