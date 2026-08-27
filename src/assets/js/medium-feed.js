/**
 * medium-feed.js
 * Fetches Medium articles via rss2json API and renders Zelio blog cards.
 *
 * Fix: rss2json free tier does NOT support the `count` param — removed.
 *      Items are sliced client-side after fetch.
 *
 * Targets:
 *   #medium-recent-blog  → Homepage "Recent Blog" section (limit: 3)
 *   #medium-blog-list    → Blog List page (limit: 9)
 */
(function () {
    'use strict';

    /* =========================================================
     * CONFIG
     * ========================================================= */
    var CONFIG = {
        username: 'ari-dev',
        homeLimit: 3,
        listLimit: 9,
        // NOTE: do NOT append &count=N — that requires a paid API key.
        // rss2json returns up to 10 items on free tier by default.
        apiUrl: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fmedium.com%2Ffeed%2F%40ari-dev',
        fallbackImages: [
            'assets/imgs/blog/blog-1/img-1.png',
            'assets/imgs/blog/blog-1/img-2.png',
            'assets/imgs/blog/blog-1/img-3.png',
            'assets/imgs/blog/blog-1/img-4.png',
            'assets/imgs/blog/blog-1/img-5.png',
            'assets/imgs/blog/blog-1/img-6.png',
            'assets/imgs/blog/blog-1/img-7.png',
            'assets/imgs/blog/blog-1/img-8.png',
            'assets/imgs/blog/blog-1/img-9.png',
            'assets/imgs/blog/blog-1/img-10.png',
            'assets/imgs/blog/blog-1/img-11.png',
            'assets/imgs/blog/blog-1/img-12.png',
        ],
    };

    /* =========================================================
     * HELPERS
     * ========================================================= */

    /** Extract first real <img> src from HTML, skip tracking pixels */
    function extractImageFromContent(html) {
        if (!html) return null;
        var imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
        var match;
        while ((match = imgRegex.exec(html)) !== null) {
            var tag = match[0];
            // Skip 1x1 tracking pixels
            if (tag.indexOf('width="1"') !== -1 || tag.indexOf('height="1"') !== -1) continue;
            if (match[1].indexOf('stat?event') !== -1) continue;
            return match[1];
        }
        return null;
    }

    function getThumbnail(item, index) {
        // rss2json gives thumbnail as a direct property
        if (item.thumbnail && item.thumbnail.trim().length > 0) {
            return item.thumbnail;
        }
        // Try extracting from content HTML
        var fromContent = extractImageFromContent(item.content || '');
        if (fromContent) return fromContent;
        // Local fallback cycling
        return CONFIG.fallbackImages[index % CONFIG.fallbackImages.length];
    }

    function getTag(item) {
        if (item.categories && item.categories.length > 0) {
            var tags = item.categories.filter(function (c) { return c && c.trim().length > 0; });
            if (tags.length > 0) return tags[0];
        }
        return 'Article';
    }

    function formatDate(pubDate, content) {
        var date = new Date(pubDate);
        var options = { year: 'numeric', month: 'short', day: 'numeric' };
        var dateStr = isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', options);
        // Estimate read time from stripped word count
        var wordCount = (content || '').replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
        var minutes = Math.max(1, Math.round(wordCount / 200));
        return (dateStr ? dateStr + ' \u2022 ' : '') + minutes + ' min read';
    }

    function buildDescription(content) {
        var plain = (content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (plain.length > 110) return plain.substring(0, 107) + '...';
        return plain || 'Read more on Medium.';
    }

    /* =========================================================
     * SECURITY HELPERS
     * ========================================================= */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeAttr(str) {
        return String(str).replace(/"/g, '&quot;');
    }

    /* =========================================================
     * SKELETON LOADER
     * ========================================================= */
    function renderSkeletons(container, count) {
        if (!document.getElementById('medium-skeleton-styles')) {
            var style = document.createElement('style');
            style.id = 'medium-skeleton-styles';
            style.textContent =
                '@keyframes medium-pulse{0%,100%{opacity:1}50%{opacity:0.35}}' +
                '.medium-skeleton{background:var(--tc-neutral-800,#2a2a3e);border-radius:4px;animation:medium-pulse 1.5s ease-in-out infinite}';
            document.head.appendChild(style);
        }
        var html = '';
        for (var i = 0; i < count; i++) {
            var delay = (i * 0.15) + 's';
            html +=
                '<div class="col-lg-4">' +
                    '<div class="blog-card rounded-4 mb-lg-3 mb-md-5 mb-3">' +
                        '<div class="blog-card__image position-relative">' +
                            '<div class="zoom-img rounded-3 overflow-hidden">' +
                                '<div class="medium-skeleton w-100" style="height:220px;animation-delay:' + delay + '"></div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="blog-card__content position-relative text-center mt-4">' +
                            '<div class="medium-skeleton mx-auto mb-3" style="height:11px;width:55%;animation-delay:' + delay + '"></div>' +
                            '<div class="medium-skeleton mx-auto mb-2" style="height:17px;width:80%;animation-delay:' + delay + '"></div>' +
                            '<div class="medium-skeleton mx-auto" style="height:12px;width:65%;animation-delay:' + delay + '"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }
        container.innerHTML = html;
    }

    /* =========================================================
     * CARD TEMPLATE — identical structure to blog-card.html
     * ========================================================= */
    function renderCard(item, index) {
        var thumbnail   = getThumbnail(item, index);
        var tag         = getTag(item);
        var dateStr     = formatDate(item.pubDate, item.content);
        var description = buildDescription(item.description || item.content);
        var link        = item.link || ('https://medium.com/@' + CONFIG.username);
        var title       = item.title || 'Untitled';
        var fallback    = CONFIG.fallbackImages[index % CONFIG.fallbackImages.length];

        return (
            '<div class="col-lg-4">' +
                '<div class="blog-card rounded-4 mb-lg-3 mb-md-5 mb-3">' +
                    '<div class="blog-card__image position-relative">' +
                        '<div class="zoom-img rounded-3 overflow-hidden">' +
                            '<img class="w-100" src="' + escapeAttr(thumbnail) + '" alt="' + escapeAttr(title) + '" ' +
                                'onerror="this.onerror=null;this.src=\'' + fallback + '\'" />' +
                            '<a class="position-absolute bottom-0 start-0 m-3 text-white-keep btn btn-gradient fw-medium rounded-3 px-3 py-2" ' +
                                'href="' + escapeAttr(link) + '" target="_blank" rel="noopener noreferrer">' +
                                escapeHtml(tag) +
                            '</a>' +
                            '<a href="' + escapeAttr(link) + '" target="_blank" rel="noopener noreferrer" ' +
                                'class="blog-card__link position-absolute top-50 start-50 translate-middle icon-md icon-shape bg-linear-1 rounded-circle">' +
                                '<i class="ri-arrow-right-up-line text-dark"></i>' +
                            '</a>' +
                        '</div>' +
                    '</div>' +
                    '<div class="blog-card__content position-relative text-center mt-4">' +
                        '<span class="blog-card__date fs-7">' + escapeHtml(dateStr) + '</span>' +
                        '<h5 class="blog-card__title">' + escapeHtml(title) + '</h5>' +
                        '<p class="blog-card__description fs-6">' + escapeHtml(description) + '</p>' +
                        '<a href="' + escapeAttr(link) + '" target="_blank" rel="noopener noreferrer" ' +
                            'class="link-overlay position-absolute top-0 start-0 w-100 h-100"></a>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    /* =========================================================
     * ERROR STATE
     * ========================================================= */
    function renderError(container, message) {
        container.innerHTML =
            '<div class="col-12 text-center py-5">' +
                '<p class="text-200 fs-5 mb-4">' + (message || 'Could not load articles right now.') + '</p>' +
                '<a href="https://medium.com/@' + CONFIG.username + '" ' +
                    'target="_blank" rel="noopener noreferrer" class="btn btn-gradient">' +
                    'Read on Medium &nbsp;<i class="ri-external-link-line"></i>' +
                '</a>' +
            '</div>';
    }

    /* =========================================================
     * FETCH — rss2json (free tier, no count param)
     * ========================================================= */
    function fetchFeed(limit, onSuccess, onError) {
        fetch(CONFIG.apiUrl)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                if (data.status !== 'ok') {
                    throw new Error('rss2json error: ' + (data.message || data.status));
                }
                if (!data.items || data.items.length === 0) {
                    throw new Error('Feed returned 0 items');
                }
                onSuccess(data.items.slice(0, limit));
            })
            .catch(function (err) {
                console.error('[medium-feed]', err.message);
                onError();
            });
    }

    /* =========================================================
     * INIT
     * ========================================================= */
    function initHomeBlog() {
        var container = document.getElementById('medium-recent-blog');
        if (!container) return;

        renderSkeletons(container, CONFIG.homeLimit);

        fetchFeed(
            CONFIG.homeLimit,
            function (items) {
                var html = '';
                items.forEach(function (item, i) { html += renderCard(item, i); });
                container.innerHTML = html;
            },
            function () { renderError(container); }
        );
    }

    function initBlogList() {
        var container = document.getElementById('medium-blog-list');
        if (!container) return;

        renderSkeletons(container, CONFIG.listLimit);

        fetchFeed(
            CONFIG.listLimit,
            function (items) {
                var html = '';
                items.forEach(function (item, i) { html += renderCard(item, i); });
                container.innerHTML = html;
            },
            function () { renderError(container); }
        );
    }

    /* =========================================================
     * BOOTSTRAP — safe for script-at-bottom-of-body placement
     * ========================================================= */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initHomeBlog();
            initBlogList();
        });
    } else {
        // DOM already ready (script loaded after DOMContentLoaded fired)
        initHomeBlog();
        initBlogList();
    }

})();
