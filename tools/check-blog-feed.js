// Is production's blog list behind Medium?
//
// The blog cards are baked into the HTML at build time (fetchBlogFeed +
// renderBlogCards in gulpfile.js), so a new Medium article only appears after
// a rebuild. api/refresh-blog.js runs this once a day (Vercel Cron) and
// triggers a deploy only when it reports a change.
//
// Items are matched the same way fetchBlogFeed builds them: link (without the
// ?source= tracking query) plus title, so a new, removed or renamed article
// all count as a change.
//
// Run it locally to see the current state: node tools/check-blog-feed.js
const MEDIUM_FEED_URL = 'https://medium.com/feed/@ari-dev';
const LIVE_SNAPSHOT_URL = 'https://aridev.vercel.app/assets/js/blog-feed.json';

function decodeCdata(str) {
    if (!str) return '';
    return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function itemKey(link, title) {
    return (link || '').split('?')[0] + ' | ' + (title || '');
}

function mediumKeys(xml) {
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    return itemBlocks.map(function (block) {
        const pick = function (tag) {
            const m = block.match(new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>'));
            return m ? decodeCdata(m[1]) : '';
        };
        return itemKey(pick('guid') || pick('link'), pick('title'));
    });
}

// Throws when Medium itself cannot be read: that is "unknown", not "changed".
async function blogFeedChanged() {
    const res = await fetch(MEDIUM_FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; zelio-build)' } });
    if (!res.ok) throw new Error('Medium feed HTTP ' + res.status);
    const latest = mediumKeys(await res.text());
    if (!latest.length) throw new Error('Medium feed returned 0 items');

    // A missing or unreadable live snapshot counts as "behind": rebuilding is
    // the fix for that too.
    let live = [];
    let liveError = null;
    try {
        const liveRes = await fetch(LIVE_SNAPSHOT_URL);
        if (!liveRes.ok) throw new Error('HTTP ' + liveRes.status);
        live = ((await liveRes.json()).items || []).map(function (item) {
            return itemKey(item.link, item.title);
        });
    } catch (err) {
        liveError = err.message;
    }

    const added = latest.filter(function (k) { return live.indexOf(k) === -1; });
    const removed = live.filter(function (k) { return latest.indexOf(k) === -1; });
    return {
        changed: added.length > 0 || removed.length > 0,
        medium: latest.length,
        live: live.length,
        liveError: liveError,
        added: added,
        removed: removed,
    };
}

module.exports = { blogFeedChanged: blogFeedChanged };

if (require.main === module) {
    blogFeedChanged().then(
        function (result) { console.log(JSON.stringify(result, null, 2)); },
        function (err) {
            console.error('Could not read the Medium feed: ' + err.message);
            process.exitCode = 1;
        },
    );
}
