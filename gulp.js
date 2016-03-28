'use strict';

const _ = require('lodash');
const browserify = require('browserify');
const fs = require('fs');
const gulp = require('gulp');
const babel = require('gulp-babel');
const eslint = require('gulp-eslint');
const liveserver = require('gulp-live-server');
const notify = require('gulp-notify');
const plumber = require('gulp-plumber');
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
                Object.assign({}, require('./babel.json')),
            ],
        ],
    },
    jest: {
        logHeapUsage: true,
        config: {
            rootDir: path.join(__dirname, '../..'),
            testPathDirs: ['src'],
            collectCoverage: true,
            coverageReporters: ['text', 'lcov', 'clover'],
            scriptPreprocessor: path.join(__dirname, 'preprocessor.js'),
            unmockedModulePathPatterns: [
                '<rootDir>/node_modules/ansi-regex',
                '<rootDir>/node_modules/any-promise',
                '<rootDir>/node_modules/bluebird',
                '<rootDir>/node_modules/body-parser',
                '<rootDir>/node_modules/bookshelf/node_modules/bluebird',
                '<rootDir>/node_modules/bookshelf/node_modules/lodash',
                '<rootDir>/node_modules/depd',
                '<rootDir>/node_modules/fbjs',
                '<rootDir>/node_modules/knex/node_modules/bluebird',
                '<rootDir>/node_modules/knex/node_modules/lodash',
                '<rootDir>/node_modules/lodash',
                '<rootDir>/node_modules/react',
                '<rootDir>/node_modules/react-addons-test-utils',
                '<rootDir>/node_modules/react-dom',
                '<rootDir>/node_modules/sshpk',
            ],
        },
    },
    src: {
        config: 'config/*.json',
        src: 'src/**/*.js',
        tests: 'src/**/__tests__/**/*.js',
        mocks: 'src/**/__mocks__/**/*.js',
        browser: 'src/browser/**/*.js',
        server: 'src/server/**/*.js',
    },
};

const read = (dir) =>
    fs.readdirSync(dir)
        .map((item) => `${dir}/${item}`)
        .map((item) =>
            fs.statSync(item).isDirectory()
            ? read(item).concat([ item ])
            : [ item ]
        )
        .reduce((a, b) => a.concat(b), []);

module.exports = function(opts) {
    opts = _.defaultsDeep(opts || {}, DefaultOptions);
    opts.browserify.transform[0][1].presets = opts.babel.presets;

    const src = Object.assign({}, opts.src, {
        babel: [opts.src.src, `!${opts.src.tests}`, `!${opts.src.mocks}`],
        browserify: [
            opts.src.src,
            `!${opts.src.tests}`,
            `!${opts.src.mocks}`,
            `!${opts.src.server}`,
        ],
        eslint: [opts.src.src],
        jsonlint: [opts.src.config],
        jest: [opts.src.src],
        server: [
            'config/*.*',
            opts.src.src,
            `!${opts.src.tests}`,
            `!${opts.src.mocks}`,
            `!${opts.src.browser}`,
        ],
        notify: ['dist/**/*', 'public/**/*', 'views/**/*'],
        sloc: [opts.src.src],
    });

    let app;

    gulp.task('default', ['build', 'test', 'sloc']);

    gulp.task('build', ['babel', 'browserify', 'sloc']);
    gulp.task('test', ['lint', 'jest', 'sloc']);
    gulp.task('lint', ['jsonlint', 'eslint', 'sloc']);
    gulp.task('production', ['test', 'build', 'uglify']);
    gulp.task('serve', ['server']);

    gulp.task('watch', () => {
        gulp.watch(src.babel, ['babel']);
        gulp.watch(src.browserify, ['browserify']);
        gulp.watch(src.eslint, ['eslint']);
        gulp.watch(src.jsonlint, ['jsonlint']);
        gulp.watch(src.jest, ['jest']);
        gulp.watch(src.sloc, ['sloc']);

        if (opts.server) {
            gulp.watch(src.server, ['server']);
            if (opts.browser) {
                gulp.watch(src.notify, (file) => {
                    if (app.isRunning) app.notify.call(app, file);
                });
            }
        }
    });

    gulp.task('sloc', () =>
        gulp.src([opts.src.src])
            .pipe(sloc())
    );

    gulp.task('eslint', ['eslint:default', 'eslint:jest'])
    gulp.task('eslint:default', () =>
        gulp.src([opts.src.src, `!${opts.src.tests}`, `!${opts.src.mocks}`])
            .pipe(plumber({errorHandler: notify.onError({
                title: 'ESLint (default) Error',
                message: '<%= error %>',
            })}))
            .pipe(eslint(opts.eslint.default))
            .pipe(eslint.format())
            .pipe(eslint.failAfterError())
    );
    gulp.task('eslint:jest', () =>
        gulp.src([opts.src.tests, opts.src.mocks])
            .pipe(plumber({errorHandler: notify.onError({
                title: 'ESLint (jest) Error',
                message: '<%= error %>',
            })}))
            .pipe(eslint(opts.eslint.jest))
            .pipe(eslint.format())
            .pipe(eslint.failAfterError())
    );

    gulp.task('jsonlint', () =>
        gulp.src([opts.src.config])
            .pipe(plumber({errorHandler: notify.onError({
                title: 'JSONLint Error',
                message: '<%= error %>',
            })}))
            .pipe(through.obj((file, encode, next) => {
                jsonlint.parse(file.contents.toString(encode));
                next();
            }))
    );

    gulp.task('jest', (next) => {
        const ci = process.env.CI === 'true';

        jest.runCLI(
            _.defaultsDeep({verbose: ci}, opts.jest),
            path.join(__dirname, '../..'),
            (succeeded) => {
                if (succeeded) return next();

                notify.onError({
                    title: 'Jest Error',
                    message: '<%= error %>',
                }).call(this, new Error('Test Failed'));

                return next('Test Failed');
            }
        );
    });

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
        () => gulp.src(src.babel)
            .pipe(plumber({errorHandler: notify.onError({
                title: 'Babel Error',
                message: '<%= error %>',
            })}))
            .pipe(babel(opts.babel))
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest('lib'))
    );

    if (opts.server) {
        app = liveserver.new('.');

        gulp.task('server', ['babel'], (next) => {
            try {
                app.start.call(app);
                app.isRunning = true;
                next();
            } catch (e) {
                notify.onError({
                    title: 'Server Error',
                    message: '<%= error %>',
                }).call(new Buffer([]), e);
                next(e);
            }
        });
    } else {
        gulp.task('server', (next) => next());
    }

    if (opts.browser) {
        const bundle = (b) => () =>
            b.bundle()
                .on('error', function () {
                    notify.onError({
                        title: 'Browserify Error',
                        message: '<%= error %>',
                    }).apply(this, arguments);
                    this.emit('end');
                })
                .pipe(source('browser.js'))
                .pipe(buffer())
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(sourcemaps.write('.'))
                .pipe(gulp.dest('dist/js'));

        const w = watchify(browserify(Object.assign(
            {},
            watchify.args,
            opts.browserify
        )));

        w.on('update', bundle);
        w.on('log', gutil.log);
        gulp.task('watchify', bundle(w));
        gulp.task('browserify', bundle(browserify(opts.browserify)));

        gulp.task('uglify', ['browserify'], () =>
            gulp.src('dist/js/browser.js')
                .pipe(plumber({errorHandler: notify.onError({
                    title: 'Uglify Error',
                    message: '<%= error %>',
                })}))
                .pipe(rename({
                    extname: '.min.js'
                }))
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(uglify())
                .pipe(sourcemaps.write('.'))
                .pipe(gulp.dest('dist/js'))
        );
    } else {
        gulp.task('watchify', (next) => next());
        gulp.task('browserify', (next) => next());
        gulp.task('uglify', (next) => next());
    }
};