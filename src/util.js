exports.sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

exports.promisify = (fn, context = null) => {

    return (...args) => {

        return new Promise((resolve, reject) => {

            fn.apply(context, args.concat((error, result) => {

                if (error) return reject(error);

                resolve(result);

            }));
        });
    }
};

exports.promisifyStream = (stream) => {

    return new Promise((resolve, reject) =>  {

        stream.once('close', resolve);
        stream.once('error', reject);
    });

};