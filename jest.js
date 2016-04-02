'use strict';

const _ = require('lodash');
const jest = require('jest-cli');
const path = require('path');

const config = require('./jest.json');
const rootDir = path.join(__dirname, '../..');
const scriptPreprocessor = path.join(__dirname, 'preprocessor.js');

const ci = process.env.CI === 'true';

jest.runCLI(
    _.defaultsDeep({
        verbose: ci,
        config: {
            rootDir,
            scriptPreprocessor,
        }
    }, config),
    path.join(__dirname, '../..'),
    (succeeded) => {
        if (!succeeded) return process.exit(1);
    }
);
