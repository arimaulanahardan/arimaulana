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
const cleanUrlMiddleware = require('./tools/clean-urls');
const once = require('gulp-once');
// Clean dist folder.
// Clears the CONTENTS and leaves the directory itself in place: on Windows an
// editor or Explorer window sitting in dist/ keeps a handle on the directory,
// and rmdir'ing it then fails with EBUSY and kills the whole build.
function cleanDist() {
    // Top-level entries only ('dist/*', not 'dist/**/*'): clean() already
    // removes directories recursively, and handing it both a directory and
    // its children makes it lstat paths the recursive delete just removed.
    return gulp.src('dist/*', { read: false, allowEmpty: true, dot: true }).pipe(clean());
}
// Pages that are kept in src/views/pages but deliberately not published.
// They are not built into dist, so they are not served, linked or indexed;
// delete a name from this list to bring that page back.
const HIDDEN_PAGES = ['pricing', 'work-single', 'coming-soon', 'blog-details'];

// Include HTML files
function includeHtml() {
    const hidden = HIDDEN_PAGES.map(function (name) {
        return '!src/views/pages/' + name + '.html';
    });
    return gulp
        .src(['src/views/pages/*.html'].concat(hidden))
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

// Render the blog feed into static HTML at build time.
//
// The cards used to be injected client-side only, which left #medium-recent-blog
// and #medium-blog-list empty in the served HTML -- so Googlebot saw a blog page
// with zero articles unless it came back to render the JS. The snapshot is already
// on disk by this point, so render the same markup medium-feed.js produces and bake
// it straight into the HTML. medium-feed.js then sees the rendered container and
// stands down, staying as the fallback for a build where the fetch failed.
const BLOG_FALLBACK_IMAGES = [];
for (let i = 1; i <= 12; i++) BLOG_FALLBACK_IMAGES.push('https://picsum.photos/seed/ari-blog-' + i + '/800/500');

const MEDIUM_PROFILE = 'https://medium.com/@ari-dev';

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;');
}

function blogDateLabel(pubDate, content) {
    const date = new Date(pubDate);
    const dateStr = isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const words = String(content || '').replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return (dateStr ? dateStr + ' • ' : '') + minutes + ' min read';
}

function blogExcerpt(content) {
    const plain = String(content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (plain.length > 110) return plain.substring(0, 107) + '...';
    return plain || 'Read more on Medium.';
}

// Mirrors renderCard() in src/assets/js/medium-feed.js -- keep the two in step.
function blogCardHtml(item, index) {
    const fallback = BLOG_FALLBACK_IMAGES[index % BLOG_FALLBACK_IMAGES.length];
    const thumbnail = item.thumbnail && item.thumbnail.trim() ? item.thumbnail : fallback;
    const tags = (item.categories || []).filter(function (c) { return c && c.trim(); });
    const tag = tags.length ? tags[0] : 'Article';
    const title = item.title || 'Untitled';
    const link = item.link || MEDIUM_PROFILE;
    const dateStr = blogDateLabel(item.pubDate, item.content);
    const excerpt = blogExcerpt(item.description || item.content);

    return (
        '<div class="col-lg-4">' +
            '<div class="blog-card rounded-4 mb-lg-3 mb-md-5 mb-3">' +
                '<div class="blog-card__image position-relative">' +
                    '<div class="zoom-img rounded-3 overflow-hidden">' +
                        '<img class="w-100" src="' + escapeAttr(thumbnail) + '" alt="' + escapeAttr(title) + '" width="400" height="250" loading="lazy" decoding="async" ' +
                            'onerror="this.onerror=null;this.src=\'' + fallback + '\'" />' +
                        '<a class="position-absolute bottom-0 start-0 m-3 text-white-keep btn btn-gradient fw-medium rounded-3 px-3 py-2" ' +
                            'href="' + escapeAttr(link) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(tag) + '</a>' +
                        '<a href="' + escapeAttr(link) + '" target="_blank" rel="noopener noreferrer" ' +
                            'class="blog-card__link position-absolute top-50 start-50 translate-middle icon-md icon-shape bg-linear-1 rounded-circle" ' +
                            'aria-label="Read ' + escapeAttr(title) + ' on Medium">' +
                            '<i class="ri-arrow-right-up-line text-dark"></i>' +
                        '</a>' +
                    '</div>' +
                '</div>' +
                '<div class="blog-card__content position-relative text-center mt-4">' +
                    '<span class="blog-card__date fs-7">' + escapeHtml(dateStr) + '</span>' +
                    '<h3 class="blog-card__title h5">' + escapeHtml(title) + '</h3>' +
                    '<p class="blog-card__description fs-6">' + escapeHtml(excerpt) + '</p>' +
                    '<a href="' + escapeAttr(link) + '" target="_blank" rel="noopener noreferrer" ' +
                        'class="link-overlay position-absolute top-0 start-0 w-100 h-100" aria-label="Read article: ' + escapeAttr(title) + '"></a>' +
                '</div>' +
            '</div>' +
        '</div>'
    );
}

// ItemList schema so the blog index is eligible for a rich result instead of
// looking like a page of bare links.
function blogItemListJsonLd(items) {
    const elements = items.map(function (item, i) {
        return {
            '@type': 'ListItem',
            position: i + 1,
            url: item.link || MEDIUM_PROFILE,
            name: item.title || 'Untitled',
        };
    });
    const payload = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Articles by Ari Maulana',
        itemListElement: elements,
    };
    return '<script type="application/ld+json">' + JSON.stringify(payload) + '</' + 'script>';
}

const BLOG_TARGETS = [
    { file: 'index.html', containerId: 'medium-recent-blog', limit: 3, jsonLd: false },
    { file: 'blog-list.html', containerId: 'medium-blog-list', limit: 9, jsonLd: true },
];

function renderBlogCards(done) {
    const snapshot = path.join(__dirname, 'dist', 'assets', 'js', 'blog-feed.json');
    if (!fs.existsSync(snapshot)) {
        console.warn('[blog-static] no snapshot on disk, leaving client-side rendering in place');
        return done();
    }

    let items;
    try {
        const parsed = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
        items = parsed.items || [];
    } catch (err) {
        console.warn('[blog-static] unreadable snapshot, skipping:', err.message);
        return done();
    }
    if (!items.length) {
        console.warn('[blog-static] snapshot has 0 items, leaving client-side rendering in place');
        return done();
    }

    BLOG_TARGETS.forEach(function (target) {
        const file = path.join(__dirname, 'dist', target.file);
        if (!fs.existsSync(file)) return;
        const html = fs.readFileSync(file, 'utf8');

        // Match the container's opening tag through its closing </div>. The
        // container is always emitted empty by the include step, so there is no
        // nested markup to get lost here.
        const re = new RegExp('(<div[^>]*id="' + target.containerId + '"[^>]*>)([\\s\\S]*?)(</div>)');
        const match = html.match(re);
        if (!match) {
            console.warn('[blog-static] container #' + target.containerId + ' not found in ' + target.file);
            return;
        }

        const picked = items.slice(0, target.limit);
        const cards = picked.map(blogCardHtml).join('');
        const openTag = match[1].replace('>', ' data-static-rendered="true">');
        let out = html.replace(re, openTag + cards + match[3]);

        if (target.jsonLd) {
            out = out.replace('</head>', '    ' + blogItemListJsonLd(picked) + '\n</head>');
        }

        fs.writeFileSync(file, out);
        console.log('[blog-static] ' + target.file + ': ' + picked.length + ' cards baked into HTML');
    });

    done();
}
exports.renderBlogCards = renderBlogCards;

// Stamp the real intrinsic size onto the template showcase images.
//
// The 100 showcase screenshots are all 800px wide but range from 343px to
// 718px tall, so the single `aspect-ratio: 800/600` the stylesheet used to
// declare cropped roughly a third off most of them. Reading the true size
// off each file and writing it onto the <img> lets masonry place the cards
// from real heights -- nothing is cropped, and the space is still reserved
// before the lazy image loads, so the grid does not shift.
//
// Done at build time on purpose: hardcoding 100 height values in the loop
// data would silently rot the first time an image is replaced.
function webpSize(buf) {
    if (buf.length < 30) return null;
    if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
    const fmt = buf.toString('ascii', 12, 16);
    if (fmt === 'VP8 ') {
        return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    }
    if (fmt === 'VP8L') {
        const bits = buf.readUInt32LE(21);
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (fmt === 'VP8X') {
        const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
        const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
        return { w: w + 1, h: h + 1 };
    }
    return null;
}

const SHOWCASE_PREFIX = 'assets/imgs/templates/showcase/';

function stampShowcaseDimensions(done) {
    const file = path.join(__dirname, 'dist', 'templates.html');
    if (!fs.existsSync(file)) {
        console.warn('[img-dims] dist/templates.html not found, skipping');
        return done();
    }

    let html = fs.readFileSync(file, 'utf8');
    const cache = new Map();
    let stamped = 0;
    let missing = 0;

    html = html.replace(/<img\b[^>]*>/g, function (tag) {
        if (tag.indexOf('width=') !== -1) return tag;
        const m = tag.match(/src="([^"]+)"/);
        if (!m || m[1].indexOf(SHOWCASE_PREFIX) !== 0) return tag;

        const rel = m[1];
        if (!cache.has(rel)) {
            const abs = path.join(__dirname, 'dist', rel);
            let size = null;
            try {
                if (fs.existsSync(abs)) size = webpSize(fs.readFileSync(abs));
            } catch (err) {
                size = null;
            }
            cache.set(rel, size);
        }
        const size = cache.get(rel);
        if (!size) {
            missing++;
            return tag;
        }
        stamped++;
        return tag.replace('<img', '<img width="' + size.w + '" height="' + size.h + '"');
    });

    fs.writeFileSync(file, html);
    console.log('[img-dims] templates.html: ' + stamped + ' showcase images stamped' + (missing ? ', ' + missing + ' unreadable' : ''));
    done();
}
exports.stampShowcaseDimensions = stampShowcaseDimensions;

// Fail the build on unresolved @@include placeholders. A leaked @@canonical
// renders as a relative URL and points the canonical tag at a 404, which is
// exactly the kind of bug that is invisible in the browser but costly in Search.
function verifyBuild(done) {
    const dir = path.join(__dirname, 'dist');
    const problems = [];
    fs.readdirSync(dir)
        .filter(function (f) { return f.endsWith('.html'); })
        .forEach(function (f) {
            const html = fs.readFileSync(path.join(dir, f), 'utf8');
            const leaked = html.match(/@@[a-zA-Z][a-zA-Z0-9_]*/g);
            if (leaked) problems.push(f + ': unresolved ' + Array.from(new Set(leaked)).join(', '));
            if (!/<link rel="canonical" href="https:\/\//.test(html)) problems.push(f + ': missing or non-absolute canonical');
            if (!/<meta name="description" content="[^"]{40,}"/.test(html) && !/content="noindex/.test(html)) problems.push(f + ': indexable page without a meta description');
        });
    if (problems.length) {
        done(new Error('[verify] SEO checks failed:\n  - ' + problems.join('\n  - ')));
        return;
    }
    console.log('[verify] all pages: canonical + description + no leaked placeholders');
    done();
}
exports.verifyBuild = verifyBuild;

// Generate sitemap.xml at build time so <lastmod> always reflects the
// latest deploy instead of a hardcoded date that goes stale.
const SITE_URL = 'https://aridev.vercel.app';

const SITEMAP_PAGES = [
    { loc: '/', changefreq: 'weekly', priority: '1.0' },
    { loc: '/services', changefreq: 'monthly', priority: '0.9' },
    { loc: '/work', changefreq: 'monthly', priority: '0.9' },
    { loc: '/templates', changefreq: 'monthly', priority: '0.9' },
    { loc: '/blog-list', changefreq: 'weekly', priority: '0.8' },
    { loc: '/work-ai-avatar-chatbot', changefreq: 'monthly', priority: '0.7' },
    { loc: '/work-ai-career-accelerator', changefreq: 'monthly', priority: '0.7' },
    { loc: '/work-dashboard-benchmarking', changefreq: 'monthly', priority: '0.7' },
    { loc: '/work-hr-voice-reservation', changefreq: 'monthly', priority: '0.7' },
    { loc: '/work-neotechpark', changefreq: 'monthly', priority: '0.7' },
    { loc: '/work-hipmi-marketplace', changefreq: 'monthly', priority: '0.7' },
    { loc: '/work-qarigenerator', changefreq: 'monthly', priority: '0.7' },
];

function generateSitemap(done) {
    const today = new Date().toISOString().slice(0, 10);
    const rows = SITEMAP_PAGES.map(function (p) {
        return '  <url><loc>' + SITE_URL + p.loc + '</loc><lastmod>' + today + '</lastmod><changefreq>' + p.changefreq + '</changefreq><priority>' + p.priority + '</priority></url>';
    });
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows.join('\n') + '\n</urlset>\n';
    fs.writeFileSync(path.join(__dirname, 'dist', 'sitemap.xml'), xml);
    console.log('[sitemap] generated with lastmod ' + today);
    done();
}
exports.generateSitemap = generateSitemap;

// Build task: clean dist first, then rebuild everything fresh.
// generateSitemap runs after copyRootFiles so the generated sitemap
// (fresh lastmod) overwrites the static copy from src/.
gulp.task('build', gulp.series(cleanDist, includeHtml, beautifyHtml, buildStyles, copyAssets, fetchBlogFeed, renderBlogCards, stampShowcaseDimensions, copyRootFiles, generateSitemap, verifyBuild));

// Initialize BrowserSync and track changes
gulp.task(
    'dev',
    gulp.series('build', function () {
        // Watch tasks
        gulp.watch('src/views/**/*.html', gulp.series(includeHtml, stampShowcaseDimensions));
        gulp.watch('src/assets/scss/**/**/*', gulp.series(buildStyles));
        gulp.watch(['src/assets/css/**/*', 'src/assets/fonts/**/*', 'src/assets/images/**/*', 'src/assets/imgs/**/*', 'src/assets/img/**/*', 'src/assets/js/**/*'], copyAssetsChanged);
        browserSync.init({
            server: {
                baseDir: 'dist',
                middleware: [cleanUrlMiddleware],
            },
            hot: true,
        });
    }),
);
// Default action
gulp.task('default', gulp.series('dev'));
