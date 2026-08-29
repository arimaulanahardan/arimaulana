const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const clean = require('gulp-clean');
const sass = require('gulp-sass')(require('sass'));
const sassOptions = {
    api: 'modern',
    silenceDeprecations: ['legacy-js-api', 'import'],
};
const sourcemaps = require('gulp-sourcemaps');
const autoprefixer = require('gulp-autoprefixer');
const includeHTML = require('gulp-file-include');
const beautify = require('gulp-html-beautify');
const browserSync = require('browser-sync').create();
const once = require('gulp-once');
// Clean dist folder
function cleanDist() {
    return gulp.src('dist', { read: false, allowEmpty: true }).pipe(clean());
}
// Include HTML files
function includeHtml() {
    return gulp
        .src(['src/views/pages/*.html'])
        .pipe(
            includeHTML({
                prefix: '@@',
                basepath: '@file',
            }),
        )
        .pipe(gulp.dest('dist'))
        .pipe(browserSync.stream());
}
// Beautify HTML
function beautifyHtml() {
    return gulp
        .src('dist/**/*.html')
        .pipe(beautify({ indent_size: 4 }))
        .pipe(gulp.dest('dist'));
}
// Copy other resource files
function copyAssets() {
    return gulp.src(['src/assets/css/**/*', 'src/assets/fonts/**/*', 'src/assets/images/**/*', 'src/assets/imgs/**/*', 'src/assets/img/**/*', 'src/assets/js/**/*'], { base: 'src/assets' }).pipe(gulp.dest('dist/assets'));
}
// Copy other resource files
function copyAssetsChanged() {
    return gulp.src(['src/assets/css/**/*', 'src/assets/fonts/**/*', 'src/assets/images/**/*', 'src/assets/imgs/**/*', 'src/assets/img/**/*', 'src/assets/js/**/*'], { base: 'src/assets' }).pipe(once()).pipe(gulp.dest('dist/assets')).pipe(browserSync.stream());
}
// Sass
function buildStyles() {
    return gulp.src('src/assets/scss/main.scss').pipe(sourcemaps.init()).pipe(sass(sassOptions).on('error', sass.logError)).pipe(autoprefixer()).pipe(sourcemaps.write('')).pipe(gulp.dest('src/assets/css/'));
}
// Build task: clean dist first, then rebuild everything fresh
gulp.task('build', gulp.series(cleanDist, includeHtml, beautifyHtml, buildStyles, copyAssets));
// Initialize BrowserSync and track changes
gulp.task(
    'dev',
    gulp.series('build', function () {
        // Watch tasks
        gulp.watch('src/views/**/*.html', gulp.series(includeHtml));
        gulp.watch('src/assets/scss/**/**/*', gulp.series(buildStyles));
        gulp.watch(['src/assets/css/**/*', 'src/assets/fonts/**/*', 'src/assets/images/**/*', 'src/assets/imgs/**/*', 'src/assets/img/**/*', 'src/assets/js/**/*'], copyAssetsChanged);
        browserSync.init({
            server: {
                baseDir: 'dist',
                middleware: [
                    function (req, res, next) {
                        const url = req.url.split('?')[0];
                        const filePath = path.join(__dirname, 'dist', url);
                        // If file exists directly or is root directory, proceed normally
                        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                            return next();
                        }
                        if (url === '/' || url === '') {
                            return next();
                        }
                        // If .html file exists for this route (clean URLs support)
                        if (fs.existsSync(filePath + '.html')) {
                            return next();
                        }
                        // Otherwise serve 404.html
                        const file404 = path.join(__dirname, 'dist', '404.html');
                        if (fs.existsSync(file404)) {
                            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                            return res.end(fs.readFileSync(file404));
                        }
                        next();
                    },
                ],
            },
            hot: true,
        });
    }),
);
// Default action
gulp.task('default', gulp.series('dev'));
