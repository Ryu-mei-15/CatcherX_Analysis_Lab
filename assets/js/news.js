'use strict';

(function () {
    const newsItems = window.catcherXNews;
    if (!Array.isArray(newsItems)) return;

    document.querySelectorAll('[data-news-list]').forEach(function (container) {
        const limit = Number.parseInt(container.dataset.newsLimit || '', 10);
        const items = Number.isFinite(limit) ? newsItems.slice(0, limit) : newsItems;
        const compact = container.dataset.newsLayout === 'compact';

        items.forEach(function (item) {
            const time = document.createElement('time');
            time.dateTime = item.date;
            time.textContent = item.displayDate;

            const category = document.createElement('span');
            category.className = 'news-tag ' + item.categoryType;
            category.textContent = item.category;

            if (compact) {
                const link = document.createElement('a');
                link.href = item.href;
                const title = document.createElement('strong');
                title.textContent = item.title;
                const arrow = document.createElement('span');
                arrow.setAttribute('aria-hidden', 'true');
                arrow.textContent = '→';
                link.append(time, category, title, arrow);
                container.appendChild(link);
                return;
            }

            const article = document.createElement('article');
            const meta = document.createElement('div');
            meta.className = 'news-entry-meta';
            meta.append(time, category);
            const content = document.createElement('div');
            const title = document.createElement('h3');
            title.textContent = item.title;
            const summary = document.createElement('p');
            summary.textContent = item.summary;
            const link = document.createElement('a');
            link.href = item.href;
            link.textContent = item.linkLabel + ' →';
            content.append(title, summary, link);
            article.append(meta, content);
            container.appendChild(article);
        });
    });
})();
