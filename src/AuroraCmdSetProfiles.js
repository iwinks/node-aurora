import pick from 'lodash/pick';

module.exports = async function(newProfiles, connector = 'any') {

    await this.queueCmd('sd-dir-del profiles');
    await this.queueCmd('sd-dir-create profiles');

    const profiles = [];
    const profileList = [];

    for (let i = 0; i < newProfiles.length; i++) {

        const profWriteCmd = await this.writeFile(`profiles/${newProfiles[i].name}`, newProfiles[i].content, true, connector);

        const profile = pick(newProfiles[i], ['id','active','content']);

        profile.name = profWriteCmd.response.file.slice(9);
        profile.key = i + profile.id + profile.name;

        //add leading ':' to mark profile as inactive
        profileList.push(`${profile.active ? '' : ':'}${profile.name}:${profile.id}`);

        profiles.push(profile);
    }

    await this.writeFile('profiles/_profiles.list', profileList.join('\r\n'), false, connector);

    return profiles;
};