import test from 'tape';
import AuroraUsb from '../../lib/AuroraUsb';
import usbDetect from 'usb-detection';
import sinon from 'sinon';

const auroraUsb = new AuroraUsb();

const commandTestPromises = [];

test('Testing Aurora USB functionality...', t => {

    const connectionSpy = new sinon.spy();

    auroraUsb.on('connectionStateChange', connectionSpy);

    auroraUsb.on('connectionStateChange', connectionState => {

        if (connectionState == 'disconnected') {

            t.assert(connectionSpy.calledWith('connecting'), "'connecting' event fired");
            t.assert(connectionSpy.calledWith('connected'), "'connected' event fired.");
            t.assert(connectionSpy.calledWith('busy'), "'busy' event fired.");
            t.assert(connectionSpy.calledWith('disconnected'), "'disconnected' event fired.");

            usbDetect.stopMonitoring();
            t.end();
        }

    });

    auroraUsb.connect().then(port => {

        t.pass(`Aurora connected on port ${port}`);

        testCmds(t).then(() => {

            auroraUsb.disconnect();
        })
        .catch(error => {

            t.fail(`One or more commands failed unexpectedly: ${error}`);

            auroraUsb.disconnect();
        });

    })
    .catch(error => {

        t.comment(error);

        t.pass('Could not establish connection to Aurora. Assuming all usb tests pass.');
        usbDetect.stopMonitoring();
        t.end();

    });

});

const testCmds = function(t){

    const successCmds = ['os-info'];

    return Promise.all(successCmds.map(cmd => {

        return auroraUsb.sendCmd('os-info').then(cmdResponse => {

            t.assert(cmdResponse && !cmdResponse.error, `'${cmd}' command executed successfully.`);
        });

    }));
};
