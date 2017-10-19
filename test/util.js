exports.spiesCalled = function(t, events, eventSpies, omitEvents = []){

    for (const event of events) {

        if (omitEvents.includes(event)) continue;

        t.assert(eventSpies[event].called, `${event} event called.`);

    }
};

exports.spiesCalledOnce = function(t, events, eventSpies, omitEvents = []){

    for (const event of events) {

        if (omitEvents.includes(event)) continue;

        t.assert(eventSpies[event].calledOnce, `${event} event called once.`);
    }
};

exports.spiesNeverCalled = function(t, events, eventSpies, omitEvents = []){

    for (const event of events) {

        if (omitEvents.includes(event)) continue;

        t.assert(!eventSpies[event].called, `${event} never called.`);
    }
};

exports.spiesCalledOnceWith = function(t, events, eventSpies, args, omitEvents = []){

    for (const event of events){

        if (omitEvents.includes(event)) continue;

        for (const arg of args){

            t.assert(eventSpies[event].withArgs(arg).calledOnce, `"${arg}" ${event} event called once.`);
        }
    }
};

exports.spiesNeverCalledWith = function(t, events, eventSpies, args, omitEvents = []){

    for (const event of events){

        if (omitEvents.includes(event)) continue;

        for (const arg of args){

            t.assert(!eventSpies[event].withArgs(arg).called, `"${arg}" ${event} event never called.`);
        }
    }
};

exports.assertCommand = function(t, cmd, responseType, isError = false){

    if (isError) {

        if (cmd.error !== false){
            t.pass(`'${cmd.command}' ${cmd.origin} command successfully responded with error.`);
        }
        else {
            t.fail(`'${cmd.command}' ${cmd.origin} command was expected to fail.`);
        }
    }
    else {

        t.assert(cmd && cmd.error === false, `'${cmd.command}' ${cmd.origin} command executed successfully.`);
        console.log(cmd.response);
    }

    switch (responseType) {

        case 'table':
            t.assert(Array.isArray(cmd.response) && typeof cmd.response[0] === 'object', `'${cmd.command}' ${cmd.origin} command response is ${responseType}.`);
            break;

        case 'object' :
        default:
            t.assert(typeof cmd.response === responseType, `'${cmd.command}' ${cmd.origin} command response is ${responseType}.`);
            break;
    }

};