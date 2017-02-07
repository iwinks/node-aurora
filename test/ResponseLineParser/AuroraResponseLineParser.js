import test from 'tape';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import AuroraResponseLineParser from '../../lib/AuroraResponseLineParser';

test('Testing response line parsing (success cases)...', (t) => {

    const responseTypes = [

        {
            inputFile: 'ResponseLineArrayInput.mock',
            outputObject: require('./ResponseLineArrayOutput.mock').default,
            name: 'Array'
        },
        {
            inputFile: 'ResponseLineObjectInput.mock',
            outputObject: require('./ResponseLineObjectOutput.mock').default,
            name: 'Object'
        },
        {
            inputFile: 'ResponseLineObjectArrayInput.mock',
            outputObject: require('./ResponseLineObjectArrayOutput.mock').default,
            name: 'Object array'
        },
        {
            inputFile: 'ResponseLineObjectWithArrayInput.mock',
            outputObject: require('./ResponseLineObjectWithArrayOutput.mock').default,
            name: 'Object with nested array'
        },
        {
            inputFile: 'ResponseLineObjectWithObjectInput.mock',
            outputObject: require('./ResponseLineObjectWithObjectOutput.mock').default,
            name: 'Object with nested object'
        },
        {
            inputFile: 'ResponseLineObjectWithObjectArrayInput.mock',
            outputObject: require('./ResponseLineObjectWithObjectArrayOutput.mock').default,
            name: 'Object with nested object array'
        },
        {
            inputFile: 'ResponseLineKitchenSinkInput.mock',
            outputObject: require('./ResponseLineKitchenSinkOutput.mock').default,
            name: 'Object with everything imaginable'
        }
    ];

    const testPromises = responseTypes.map((responseType) => {

        const lineReader = readline.createInterface({
            input: fs.createReadStream(path.join(__dirname, responseType.inputFile))
        });

        const parser = new AuroraResponseLineParser();

        lineReader.on('line', line => parser.parseLine(line));

        lineReader.on('close', () => {

            t.deepEqual(parser.getResponse(),responseType.outputObject, `${responseType.name} input yielded properly parsed output.`);
        });

    });

    Promise.all(testPromises).then(() => {

        t.end();
    });

});



