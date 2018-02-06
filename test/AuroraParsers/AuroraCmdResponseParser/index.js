import test from 'tape';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import AuroraCmdResponseParser from '../../../lib/AuroraCmdResponseParser';

test('Testing response line parsing (success cases)...', (t) => {

    const responseTypes = [

        {
            inputFile: 'CmdResponseObjectInput.mock',
            outputObject: require('./CmdResponseObjectOutput.mock').default,
            name: 'Object',
            parseAs: 'detect'
        },
        {
            inputFile: 'CmdResponseTableInput.mock',
            outputObject: require('./CmdResponseTableOutput.mock').default,
            name: 'Table',
            parseAs: 'detect'
        },
        {
            inputFile: 'CmdResponseTableCondensedInput.mock',
            outputObject: require('./CmdResponseTableCondensedOutput.mock').default,
            name: 'Table (condensed)',
            parseAs: 'table'
        }
    ];

    const testPromises = responseTypes.map((responseType) => {

        return new Promise((resolve, reject) => {

            const lineReader = readline.createInterface({
                input: fs.createReadStream(path.join(__dirname, responseType.inputFile))
            });

            const parser = new AuroraCmdResponseParser();

            if (responseType.parseAs == 'object'){

                lineReader.on('line', line => parser.parseObject(line));
            }
            else if (responseType.parseAs == 'table'){

                lineReader.on('line', line => parser.parseTable(line));
            }
            else {

                lineReader.on('line', line => parser.parseDetect(line));
            }

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



