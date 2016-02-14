const babel = require('babel-core');

module.exports = {
    process: function (src, filename) { 
        if (filename.match(/node_modules/)) return src;

        return babel.transform(src, Object.assign({}, require('./babel.json'), {
            filename: filename,
            retainLines: true,
            auxiliaryCommentBefore: "istanbul ignore next",
        })).code;
    }
};