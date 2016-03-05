const babel = require('babel-core');
const jestPreset = require('babel-preset-jest');

const config = require('./babel.json');

module.exports = {
    process: function (src, filename) { 
        if (filename.match(/node_modules/)) return src;

        return babel.transform(src, Object.assign({}, config, {
            filename: filename,
            presets: [jestPreset].concat(config.presets),
            retainLines: true,
            auxiliaryCommentBefore: "istanbul ignore next",
        })).code;
    }
};