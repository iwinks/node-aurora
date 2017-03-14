import test from 'tape';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import AuroraCommandResponseParser from '../../../lib/AuroraCommandResponseParser';

test('Testing response line parsing (success cases)...', (t) => {

    const responseTypes = [

        {
            inputFile: 'CmdResponseObjectInput.mock',
            outputObject: require('./CmdResponseObjectOutput.mock').default,
            name: 'Object'
        },
        {
            inputFile: 'CmdResponseTableInput.mock',
            outputObject: require('./CmdResponseTableOutput.mock').default,
            name: 'Table'
        }
    ];

    const testPromises = responseTypes.map((responseType) => {

        return new Promise((resolve, reject) => {

            const lineReader = readline.createInterface({
                input: fs.createReadStream(path.join(__dirname, responseType.inputFile))
            });

            const parser = new AuroraCommandResponseParser();

            lineReader.on('line', line => parser.parseDetect(line));

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



