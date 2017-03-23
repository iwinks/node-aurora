module.exports = async function(profiles, connector = 'any') {

    await this.queueCmd('sd-dir-del profiles');
    await this.queueCmd('sd-dir-create profiles');

    const activeProfiles = [];

    for (let profile of profiles) {

        const profWriteCmd = await this.writeFile(`profiles/${profile.name}`, profile.content, true, connector);

        //TODO: decide if commands should output full path or just name
        //probably should be consistent with dir-read output
        //update name in case it changed because of a rename
        profile.name = profWriteCmd.response.file.replace('profiles/','');

        if (profile.active){

            activeProfiles.push(`${profile.name}:${profile.id}`);
        }
    }

    const listWriteCmd = await this.writeFile('profiles/_profiles.list', activeProfiles.join('\r\n'), false, connector);

    listWriteCmd.profiles = profiles;

    return listWriteCmd;
};