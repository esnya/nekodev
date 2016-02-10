/* eslint strict: 0 */
/* eslint no-sync: 0 */
module.exports = function(options) {
    'use strict';

    if (!options) options = {};

    const browserify = require('browserify');
    const fs = require('fs');
    const gulp = require('gulp');
    const babel = require('gulp-babel');
    const eslint = require('gulp-eslint');
    const liveserver = require('gulp-live-server');
    const rename = require('gulp-rename');
    const sloc = require('gulp-sloc');
    const sourcemaps = require('gulp-sourcemaps');
    const uglify = require('gulp-uglify');
    const gutil = require('gulp-util');
    const jest = require('jest-cli');
    const path = require('path');
    const source = require('vinyl-source-stream');
    const buffer = require('vinyl-buffer');
    const watchify = require('watchify');

    const server = liveserver.new('.');

    const config = {};
    config.eslint = {
        extends: path.join(__dirname, '.eslintrc'),
    };
    config.babel = {
        presets: [
            'react',
            'es2015',
            'stage-2',
        ],
        sourceMaps: 'inline',
        sourceRoot: 'src'
    };
    config.browserify = {
        entries: ['src/browser'],
        debug: true,
        transform: [
            [
                'babelify',
                {
                    presets: config.babel.presets,
                },
            ],
        ],
    };

    gulp.task('default', ['build']);

    gulp.task('lint', ['eslint']);

    gulp.task('build', ['build:server', 'build:browser']);
    gulp.task('build:server', ['babel']);
    gulp.task('build:browser', ['uglify']);

    gulp.task('test', ['eslint', 'jest']);

    gulp.task('serve', ['server']);

    gulp.task('watch', ['watch:server', 'watch:browser', 'sloc'], () => {
        gulp.watch(['.eslintrc', 'gulpfile.js'], ['eslint']);
        gulp.watch('src/**/*', ['sloc']);
    });
    gulp.task('watch:server', ['jest', 'server'], () => {
        gulp.watch(['src/**/*', '!src/browser/**/*', 'config/**/*'], ['jest', 'server']);
        gulp.watch(
            ['dist/**/*', 'public/**/*', 'views/**/*'],
            (file) => server.notify(file)
        );
    });
    gulp.task('watch:browser', ['jest', 'wuglify'], () =>
        gulp.watch(['src/**/*', '!src/server/**/*', 'config/**/*'], ['jest', 'wuglify']));

    gulp.task('eslint', () =>
        gulp.src(['src/**/*.js', 'gulpfile.js'])
            .pipe(eslint(config.eslint))
            .pipe(eslint.format())
            .pipe(eslint.failAfterError())
    );

    gulp.task('sloc', () =>
        gulp.src('src/**/*.js')
            .pipe(sloc())
    );

    gulp.task(
        'sync-lib',
        (next) => {
            if (!fs.existsSync('lib')) return next();

            const read = (dir) =>
                fs.readdirSync(dir)
                    .map((item) => `${dir}/${item}`)
                    .map((item) => 
                        fs.statSync(item).isDirectory()
                        ? read(item).concat([ item ])
                        : [ item ]
                    )
                    .reduce((a, b) => a.concat(b), []);

            read('lib')
                .filter((item) => !fs.existsSync(item.replace(/^lib/, 'src')))
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
        'babel', ['eslint', 'sync-lib'],
        () => gulp.src('src/**/*.js')
            .pipe(babel(config.babel))
            .pipe(gulp.dest('lib'))
    );

    const bundle = function(b) {
        if (options.browser === false) {
            return (next) => {
                gutil.log('Skip browser');
                next();
            };
        }

        return function() {
            return b.bundle()
                .on('error', (e) => {
                    throw e;
                })
                .pipe(source('browser.js'))
                .pipe(buffer())
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(sourcemaps.write('.'))
                .pipe(gulp.dest('dist/js'));
        };
    };
    const w = watchify(browserify(Object.assign(
        {},
        watchify.args,
        config.browserify
    )));

    w.on('update', bundle);
    w.on('log', gutil.log);
    gulp.task('watchify', ['eslint'], bundle(w));
    gulp.task('browserify', ['eslint'], bundle(browserify(config.browserify)));

    gulp.task('uglify', ['browserify'], () =>
        gulp.src('dist/js/browser.js')
            .pipe(rename({
              extname: '.min.js'
            }))
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(uglify())
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest('dist/js'))
    );

    gulp.task('wuglify', ['watchify'], () =>
        gulp.src('dist/js/browser.js')
            .pipe(rename({
              extname: '.min.js'
            }))
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(uglify())
            .pipe(sourcemaps.write('.'))
            .pipe(gulp.dest('dist/js'))
    );

    gulp.task('jest', ['babel'], (next) => {
        const ci = process.env.CI === 'true';
        jest.runCLI({
            runInBand: ci,
            verbose: ci,
        }, path.join(__dirname, '../../lib'), (succeeded) => {
            next(!succeeded && new Error('Test failured'));
        });
    });

    gulp.task('server', ['babel'], (next) => {
        server.start();
        next();
    });
};