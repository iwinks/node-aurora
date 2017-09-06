import {buzzSongObjToCmd} from './util';

module.exports = function(buzzSong, connector='any') {
    
    const cmd = typeof buzzSong == 'string' ? buzzSong : buzzSongObjToCmd(buzzSong);

    return this.queueCmd(cmd, connector);
};
    