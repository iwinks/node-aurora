import test from 'tape';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import AuroraCommandResponseParser from '../../lib/AuroraCommandResponseParser';

test('Testing response line parsing (success cases)...', (t) => {

    const responseTypes = [

        {
            inputFile: 'CmdResponseArrayInput.mock',
            outputObject: require('./CmdResponseArrayOutput.mock').default,
            name: 'Array'
        },
        {
            inputFile: 'CmdResponseObjectInput.mock',
            outputObject: require('./CmdResponseObjectOutput.mock').default,
            name: 'Object'
        },
        {
            inputFile: 'CmdResponseObjectArrayInput.mock',
            outputObject: require('./CmdResponseObjectArrayOutput.mock').default,
            name: 'Object array'
        },
        {
            inputFile: 'CmdResponseObjectWithArrayInput.mock',
            outputObject: require('./CmdResponseObjectWithArrayOutput.mock').default,
            name: 'Object with nested array'
        },
        {
            inputFile: 'CmdResponseObjectWithObjectInput.mock',
            outputObject: require('./CmdResponseObjectWithObjectOutput.mock').default,
            name: 'Object with nested object'
        },
        {
            inputFile: 'CmdResponseObjectWithObjectArrayInput.mock',
            outputObject: require('./CmdResponseObjectWithObjectArrayOutput.mock').default,
            name: 'Object with nested object array'
        },
        {
            inputFile: 'CmdResponseKitchenSinkInput.mock',
            outputObject: require('./CmdResponseKitchenSinkOutput.mock').default,
            name: 'Object with everything imaginable'
        }
    ];

    const testPromises = responseTypes.map((responseType) => {

        return new Promise((resolve, reject) => {

            const lineReader = readline.createInterface({
                input: fs.createReadStream(path.join(__dirname, responseType.inputFile))
            });

            const parser = new AuroraCommandResponseParser();

            lineReader.on('line', line => parser.parseLine(line));

            lineReader.on('close', () => {

                t.deepEqual(parser.getResponse(),responseType.outputObject, `${responseType.name} input yielded properly parsed output.`);

                resolve();
            });
        });
    });

    Promise.all(testPromises).then(() => {

        t.end();
    });

});



