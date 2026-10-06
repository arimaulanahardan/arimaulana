const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const clean = require('gulp-clean');
const sass = require('gulp-sass')(require('sass'));
const sassOptions = {
    api: 'modern',
    style: 'compressed',
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
const assetSources = [
    'src/assets/css/**/*',
    'src/assets/fonts/**/*',
    '!src/assets/fonts/remixicon/*.json',
    '!src/assets/fonts/remixicon/remixicon.symbol.svg',
    '!src/assets/fonts/remixicon/remixicon.svg',
    'src/assets/images/**/*',
    'src/assets/imgs/**/*',
    'src/assets/img/**/*',
    'src/assets/js/**/*',
    '!src/assets/**/*.map',
];
// Copy other resource files
function copyAssets() {
    return gulp.src(assetSources, { base: 'src/assets' }).pipe(gulp.dest('dist/assets'));
}
// Copy root SEO files (robots.txt, sitemap.xml)
function copyRootFiles() {
    return gulp.src(['src/robots.txt', 'src/sitemap.xml'], { allowEmpty: true }).pipe(gulp.dest('dist'));
}
// Copy other resource files
function copyAssetsChanged() {
    return gulp.src(assetSources, { base: 'src/assets' }).pipe(once()).pipe(gulp.dest('dist/assets')).pipe(browserSync.stream());
}
// Sass
function buildStyles() {
    return gulp.src('src/assets/scss/main.scss').pipe(sass(sassOptions).on('error', sass.logError)).pipe(autoprefixer()).pipe(gulp.dest('src/assets/css/'));
}
exports.buildStyles = buildStyles;
exports.copyAssets = copyAssets;

// Fetch Medium RSS at build time and write a static snapshot JSON.
// Runtime blog cards read this first (fresh as of last deploy, no CORS
// proxy dependency); rss2json stays as a runtime fallback.
const MEDIUM_FEED_URL = 'https://medium.com/feed/@ari-dev';

function decodeCdata(str) {
    if (!str) return '';
    return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function extractFirstImage(html) {
    if (!html) return '';
    const regex = /<img[^>]+src="([^"]+)"[^>]*/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        const tag = match[0];
        if (tag.indexOf('width="1"') !== -1 || tag.indexOf('height="1"') !== -1) continue;
        if (match[1].indexOf('stat?event') !== -1) continue;
        return match[1];
    }
    return '';
}

async function fetchBlogFeed(done) {
    try {
        const res = await fetch(MEDIUM_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; zelio-build)' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const xml = await res.text();
        const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        const items = itemBlocks.map(function (block) {
            const pick = function (tag) {
                const m = block.match(new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>'));
                return m ? decodeCdata(m[1]) : '';
            };
            const contentEncoded = block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/);
            const content = contentEncoded ? decodeCdata(contentEncoded[1]) : '';
            const mediaContent = block.match(/<media:content[^>]*url="([^"]+)"/);
            const mediaThumb = block.match(/<media:thumbnail[^>]*url="([^"]+)"/);
            const categories = [];
            const catRegex = /<category>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/g;
            let catMatch;
            while ((catMatch = catRegex.exec(block)) !== null) {
                const v = catMatch[1].trim();
                if (v) categories.push(v);
            }
            const thumbnail =
                (mediaContent && mediaContent[1]) ||
                (mediaThumb && mediaThumb[1]) ||
                extractFirstImage(content) ||
                '';
            const link = pick('guid') || pick('link');
            return {
                title: pick('title'),
                link: link,
                pubDate: pick('pubDate'),
                content: content,
                description: pick('description') || content,
                categories: categories,
                thumbnail: thumbnail,
            };
        });
        const out = path.join(__dirname, 'dist', 'assets', 'js', 'blog-feed.json');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify({ status: 'ok', items: items }, null, 2));
        console.log('[blog-feed] snapshot written: ' + items.length + ' items');
    } catch (err) {
        console.warn('[blog-feed] fetch failed, skipping snapshot:', err.message);
    }
    done();
}
exports.fetchBlogFeed = fetchBlogFeed;

// Build task: clean dist first, then rebuild everything fresh
gulp.task('build', gulp.series(cleanDist, includeHtml, beautifyHtml, buildStyles, copyAssets, fetchBlogFeed, copyRootFiles));
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
