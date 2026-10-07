const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

// Serve clean URLs from dist the way static hosts do: /work -> dist/work.html,
// /blog/ -> dist/blog/index.html, anything else -> 404.html. Mirrors how the
// production host resolves routes, so links without .html work in dev too.
function cleanUrlMiddleware(req, res, next) {
    const url = req.url.split('?')[0];
    const filePath = path.join(DIST, url);
    // Real file, or the site root: let the static server handle it.
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return next();
    }
    if (url === '/' || url === '') {
        return next();
    }
    // Rewrite so the static server actually resolves the extensionless route.
    if (fs.existsSync(filePath + '.html')) {
        req.url = url + '.html' + req.url.slice(url.length);
        return next();
    }
    // Directory with an index.html (e.g. /blog/).
    if (fs.existsSync(path.join(filePath, 'index.html'))) {
        return next();
    }
    const file404 = path.join(DIST, '404.html');
    if (fs.existsSync(file404)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(fs.readFileSync(file404));
    }
    next();
}

module.exports = cleanUrlMiddleware;
