import split from 'split';

module.exports = async function(connector = 'any') {

    const profileListReadResp = await this.readFile('profiles/_profiles.list', split(), connector);

    const profilesInList = profileListReadResp.output.filter(String).map((prof, index) => {

        const profile = {};
        const profParts = prof.trim().split(':');

        if (profParts.length == 3){

            profile.active = false;
            profile.name = profParts[1];
            profile.id = profParts[2];
        }
        else {

            profile.active = true;
            profile.name = profParts[0];
            profile.id = profParts[1];
        }

        profile.key = `${index}_${profile.id}_${profile.name}`;

        return profile;

    });

    const {response} = await this.queueCmd('sd-dir-read profiles 1 *.prof', connector);
    const profiles = [];

    for (let profile of response) {

        try {

            const readCmdWithResponse = await this.readFile(`profiles/${profile.name}`, false, connector);

            const p = {active: false, content: readCmdWithResponse.output, key: '_' + profile.name};

            Object.assign(p, profile, profilesInList.find((prof) => prof.name == profile.name));

            profiles.push(p);
        }
        catch (error) {

        }
    }

   return profiles.sort((a,b) => a.key > b.key ? 1 : (a.key < b.key ? -1 : 0));

};