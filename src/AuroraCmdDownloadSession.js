import split from 'split';

module.exports = async function(connector = 'any') {

    const profileListReadResp = await this.readFile('profiles/_profiles.list', split(), connector);

    const profileIds = profileListReadResp.output.filter(String).map((prof) => {

        const [profileName, profileId] = prof.trim().split(':');

        return {profileName, profileId};

    });

    const cmdWithResponse = await this.queueCmd('sd-dir-read profiles 1 *.prof', connector);

    const profiles = cmdWithResponse.response;

    for (let profile of profiles) {

        const readCmdWithResponse = await this.readFile(`profiles/${profile.name}`, false, connector);

        profile.content = readCmdWithResponse.output;

        const prof = profileIds.find((prof) => prof.profileName === profile.name);

        if (prof) {

            profile.active = true;
            profile.id = prof.profileId;
        }
        else {

            profile.active = false;
        }
    }

    profileListReadResp.profiles = profiles;

    return profileListReadResp;

};