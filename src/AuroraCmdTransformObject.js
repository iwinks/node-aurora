import Stream from "stream";
import Flat from "flat";
import moment from 'moment';
import _ from 'lodash';

export default class AuroraCmdTransformObject extends Stream.Transform {
    
    static defaultOptions = {
        
        unflatten: true,
        unflattenDelimiter: '.',
        parseTypes: true
    };
    
    constructor(options) {
        
        super({objectMode: true, encoding: null});
        
        this.options = _.defaultsDeep(options, AuroraCmdTransformObject.defaultOptions);
        
        this._leftoverData = '';
    }
    
    _transform(respChunk, encoding, done) {
        
        respChunk = respChunk.toString();

        if (this._leftoverData) {
            respChunk = this._leftoverData + respChunk;
            this._leftoverData = '';
        }
        
        let lines = respChunk.split("\n");

        this._leftoverData = lines.pop();

        lines = _.compact(lines.map(line => {
            return line.trim()
        }));
        
        for (let line of lines) {
            
            this._processLine(line);
        }
        
        done();
    }
    
    _flush(done) {

        this._leftoverData = this._leftoverData.trim();
        if (this._leftoverData) {
            this._processLine(this._leftoverData);
            this._leftoverData = null;
        }
        
        done();
    }
    
    _processLine(line) {
        
        var key_value = line.split(':');
        
        if (key_value.length >= 2) {
            
            let object = {};
            let key = key_value.shift().trim();
            object[key] = key_value.join(':').trim();

            if (this.options.parseTypes) {

                const valWithoutNumericSymbols = object[key].replace(/[$%,]+/g,'');

                if (!isNaN(valWithoutNumericSymbols)) {
                    
                    object[key] = +valWithoutNumericSymbols;
                }
                else {

                    let date = moment(object[key], [moment.ISO_8601, "YYYY-MM-DD HH:mm:ss:SSS", "MMM  D YYYY - HH:mm:ss"], true);

                    if (date.isValid()){
                        object[key] = +date;
                    }
                    else if (object[key] === 'true' || object[key] === 'false') {
                        object[key] = object[key] === 'true';
                    }
                }
            }
            
            if (this.options.unflatten) {
                
                object = Flat.unflatten(object, {delimiter: this.options.unflattenDelimiter, object: true});
            }
            
            object = this._camelCaseKeys(object);

            this.push(object);
        }
        
    }
    
    _camelCaseKeys(object) {
        
        //current layer
        object = _.mapKeys(object, (value, key) => {
            return _.camelCase(key);
        });
        
        _.forIn(object, (val, key) => {
            
            if (_.isArray(val)) {
                
                for (let arrayVal of val) {
                    
                    if (_.isPlainObject(arrayVal)) {
                        
                        object[key] = this._camelCaseKeys(val);
                    }
                }
            }
            else if (_.isPlainObject(val)) {
                
                object[key] = this._camelCaseKeys(val);
            }
            
        });
        
        return object;
    }
    
}
