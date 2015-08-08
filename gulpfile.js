var gulp        = require('gulp');
var jshint      = require('gulp-jshint');
var mocha       = require('gulp-mocha');
var cover       = require('gulp-coverage');
var clean       = require('gulp-clean');
var runSequence = require('run-sequence');

gulp.task('lint', function () {
    return gulp.src(['**/*.js', '!**/node_modules/**', '!debug/**/*.js'])
        .pipe(jshint({lookup: true}))
        .pipe(jshint.reporter('default'))
        .pipe(jshint.reporter('fail'));
});

gulp.task('unit_pre', function () {
    return gulp.src(['*/**/*.unit.spec.js', '!**/node_modules/**/*.js'], {read: false})
        .pipe(cover.instrument({
            pattern: ['*.js', '*/**/*.js', '!*/**/*.spec.js', '!**/node_modules/**/*.js', '!debug/**/*.js', '!gulpfile.js'],
            debugDirectory: 'debug'
        }))
        .pipe(mocha({reporter: 'spec', timeout: '10000'}))
        .pipe(cover.gather())
        .pipe(cover.format({
            reporter: 'html',
            outFile: 'coverage-unit.html'
        }))
        .pipe(gulp.dest('coverage'))
        .pipe(cover.enforce({
            statements: 100,
            blocks: 100,
            lines: 100,
            uncovered: 0
        }))
        .once('error', function (err) {
            console.error(err);
            process.exit(1);
        });
});

gulp.task('clean', function () {
    return gulp.src(['.coverdata', 'debug', '.coverrun'], {read: false})
        .pipe(clean())
        .once('end', function () {
            process.exit();
        });
});

gulp.task('unit_test', function (callback) {
    runSequence(
        'lint',
        'unit_pre',
        'clean',
        callback);
});