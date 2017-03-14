module.exports = function(connector='any') {

    const date = new Date();
    const msAfterMidnight = date.getHours() * 3600000 + date.getMinutes() * 60000 + date.getSeconds() * 1000 + date.getMilliseconds();

    return this.queueCmd(`clock-set ${date.getFullYear()} ${date.getMonth()+1} ${date.getDate()} ${msAfterMidnight}`, connector);
};
