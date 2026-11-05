// Called once a day by Vercel Cron ("crons" in vercel.json). Compares the
// Medium feed with the blog list production serves and, only when they
// differ, triggers a rebuild through a Vercel Deploy Hook.
//
// Environment variables (Vercel > Project > Settings > Environment Variables):
//   DEPLOY_HOOK_URL  the hook from Settings > Git > Deploy Hooks (branch master)
//   CRON_SECRET      any long random string; Vercel Cron sends it as
//                    "Authorization: Bearer <CRON_SECRET>", and requests
//                    without it are refused so nobody else can trigger deploys
const { blogFeedChanged } = require('../tools/check-blog-feed');

module.exports = async function refreshBlog(req, res) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== 'Bearer ' + secret) {
        return res.status(401).json({ error: 'unauthorized' });
    }
    const hook = process.env.DEPLOY_HOOK_URL;
    if (!hook) {
        return res.status(500).json({ error: 'DEPLOY_HOOK_URL is not set' });
    }

    let result;
    try {
        result = await blogFeedChanged();
    } catch (err) {
        // Nothing is deployed; the next daily run checks again.
        return res.status(502).json({ error: 'Medium feed unreadable: ' + err.message });
    }
    if (!result.changed) {
        return res.status(200).json(Object.assign({ deployed: false }, result));
    }

    const deploy = await fetch(hook, { method: 'POST' });
    if (!deploy.ok) {
        return res.status(502).json(Object.assign({ deployed: false, error: 'Deploy hook HTTP ' + deploy.status }, result));
    }
    console.log('[refresh-blog] deploy triggered: ' + result.added.length + ' added, ' + result.removed.length + ' removed');
    return res.status(200).json(Object.assign({ deployed: true }, result));
};
