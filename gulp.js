'use strict';

const _ = require('lodash');
const browserify = require('browserify');
const fs = require('fs');
const gulp = require('gulp');
const babel = require('gulp-babel');
const eslint = require('gulp-eslint');
const liveserver = require('gulp-live-server');
const rename = require('gulp-rename');
const sequence = require('gulp-sequence');
const sloc = require('gulp-sloc');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify');
const gutil = require('gulp-util');
const jest = require('jest-cli');
const jsonlint = require('jsonlint');
const path = require('path');
const through = require('through2');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const watchify = require('watchify');

const DefaultOptions = {
    browser: true,
    server: true,
    eslint: {
        default: { extends: path.join(__dirname, 'eslint/default.yml') },
        jest: { extends: path.join(__dirname, 'eslint/jest.yml') },
    },
    babel: require('./babel.json'),
    browserify: {
        entries: ['src/browser'],
        debug: true,
        transform: [
            [
                'babelify',
                require('./babel.json'),
            ],
        ],
    },
    jest: {
        verbose: true,
        config: {
            rootDir: path.join(__dirname, '../..'),
            testPathDirs: ['src'],
            collectCoverage: true,
            coverageReporters: ['text', 'lcov', 'clover'],
            scriptPreprocessor: path.join(__dirname, 'preprocessor.js'),
        },
    },
    src: {
        config: 'config/*.json',
        src: 'src/**/*.js',
        tests: 'src/**/__tests__/**/*.js',
        mocks: '__mocks__/**/*.js',
        browser: 'src/browser/**/*.js',
        server: 'src/server/**/*.js',
    },
};

function common(opts) {
    const filter = (deps) =>
        deps.filter((dep) => {
            if (dep.match(/:browser$/) && !opts.browser) return false;
            else if (dep.match(/:server$/) && !opts.server) return false;
            return true;
        });

    gulp.task('default', ['build', 'test']);

    gulp.task('lint', ['eslint', 'jsonlint']);

    gulp.task('build', filter(['build:server', 'build:browser', 'sloc']));
    gulp.task('test', ['eslint', 'jest', 'sloc', 'jsonlint']);

    gulp.task('watch', filter(['watch:server', 'watch:browser', 'build', 'test']), () => {
        gulp.watch([opts.src.src], ['babel']);
        gulp.watch([opts.src.src, `!${opts.src.tests}`], ['eslint:default']);
        gulp.watch([opts.src.tests, opts.src.mocks], ['eslint:jest']);
        gulp.watch([opts.src.src, opts.src.mocks], ['jest']);
        gulp.watch([opts.src.src], ['sloc']);
        gulp.watch([opts.src.config], ['jsonlint']);
    });

    gulp.task('eslint', ['eslint:default', 'eslint:jest'])
    gulp.task('eslint:default', () =>
        gulp.src([opts.src.src, `!${opts.src.tests}`])
            .pipe(eslint(opts.eslint.default))
            .pipe(eslint.format())
            .pipe(eslint.failAfterError())
    );
    gulp.task('eslint:jest', () =>
        gulp.src([opts.src.tests])
            .pipe(eslint(opts.eslint.jest))
            .pipe(eslint.format())
            .pipe(eslint.failAfterError())
    );

    gulp.task('sloc', () =>
        gulp.src([opts.src.src])
            .pipe(sloc())
    );

    gulp.task('jsonlint', () =>
        gulp.src([opts.src.config])
            .pipe(through.obj((file, encode, next) => {
                jsonlint.parse(file.contents.toString(encode));
                next();
            }))
    );

    const read = (dir) =>
        fs.readdirSync(dir)
            .map((item) => `${dir}/${item}`)
            .map((item) =>
                fs.statSync(item).isDirectory()
                ? read(item).concat([ item ])
                : [ item ]
            )
            .reduce((a, b) => a.concat(b), []);

    gulp.task(
        'sync-lib',
        (next) => {
            if (!fs.existsSync('lib')) return next();

            read('lib')
                .filter((item) =>
                    !fs.existsSync(item.replace(/^lib/, 'src').replace(/\.map$/, ''))
                )
                .forEach((item) => {
                    gutil.log(`rm ${item}`);
                    if (fs.statSync(item).isDirectory()) {
                        fs.rmdirSync(item);
                    } else {
                        fs.unlinkSync(item);
                    }
                });
            return next();
        }
    );

    gulp.task(
        'babel', ['sync-lib'],
        () => gulp.src([opts.src.src])
            .pipe(babel(opts.babel))
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest('lib'))
    );

    gulp.task('jest', (next) => {
        // Jest issue#433
        const collectCoverageOnlyFrom = read('src').reduce((result, path) => {
            result[path] = true;
            return result;
        }, {});

        const ci = process.env.CI === 'true';

        jest.runCLI(_.defaultsDeep({
            runInBand: ci,
            verbose: ci,
            config: {
                collectCoverageOnlyFrom: collectCoverageOnlyFrom,
            },
        }, opts.jest), path.join(__dirname, '../..'), (succeeded) => {
            next(!succeeded && new Error('Test failured'));
        });
    });
}

function browser(opts) {
    function bundle(b) {
        return () =>
            b.bundle()
                .on('error', (e) => {
                    throw e;
                })
                .pipe(source('browser.js'))
                .pipe(buffer())
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(sourcemaps.write('.'))
                .pipe(gulp.dest('dist/js'));
    }

    const w = watchify(browserify(Object.assign(
        {},
        watchify.args,
        opts.browserify
    )));

    gulp.task('build:browser', ['uglify:build']);

    gulp.task('watch:browser', () =>
        gulp.watch([opts.src.src, `!${opts.src.server}`, `!${opts.src.tests}`], ['uglify:watch']));

    w.on('update', bundle);
    w.on('log', gutil.log);
    gulp.task('watchify', bundle(w));
    gulp.task('browserify', bundle(browserify(opts.browserify)));

    gulp.task('uglify:common', () =>
        gulp.src('dist/js/browser.js')
            .pipe(rename({
              extname: '.min.js'
            }))
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(uglify())
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest('dist/js'))
    );
    gulp.task('uglify:build', (next) => sequence('browserify', 'uglify:common', next));
    gulp.task('uglify:watch', (next) => sequence('watchify', 'uglify:common', next));
}

function server(opts) {
    const app = liveserver.new('.');

    gulp.task('serve', ['server']);

    gulp.task('build:server', ['babel']);
    gulp.task('watch:server', ['server'], () => {
        gulp.watch(
            [opts.src.src, opts.src.config, `!${opts.src.browser}`, `!${opts.src.tests}`,],
            ['server']
        );
        gulp.watch(
            ['dist/**/*', 'public/**/*', 'views/**/*'],
            (file) => app.notify(file)
        );
    });

    gulp.task('server', ['babel'], (next) => {
        app.start();
        next();
    });
}

module.exports = function(opts) {
    opts = _.defaultsDeep(opts || {}, DefaultOptions);
    opts.browserify.transform[0][1].presets = opts.babel.presets;

    common(opts);
    if (opts.browser) browser(opts);
    if (opts.server) server(opts);
};