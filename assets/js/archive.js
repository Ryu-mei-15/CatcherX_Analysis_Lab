'use strict';

(function () {
    const container = document.getElementById('eventArchive');
    const events = window.catcherXEvents;
    if (!container || !Array.isArray(events)) return;

    events.forEach(function (event) {
        const article = document.createElement('article');
        article.className = 'archive-event-card ' + event.type;

        const top = document.createElement('div');
        top.className = 'archive-event-top';
        const year = document.createElement('span');
        year.className = 'archive-event-year';
        year.textContent = event.year;
        const status = document.createElement('span');
        status.className = 'archive-status ' + event.type;
        status.textContent = event.status;
        top.append(year, status);

        const stage = document.createElement('p');
        stage.className = 'archive-event-stage';
        stage.textContent = event.stage;
        const title = document.createElement('h3');
        title.textContent = event.shortTitle;
        const description = document.createElement('p');
        description.className = 'archive-event-description';
        description.textContent = event.description;
        const link = document.createElement('a');
        link.href = event.path;
        link.textContent = event.links.length ? '発表ページを見る →' : '記録枠を見る →';
        link.setAttribute('aria-label', event.title + 'の発表ページを見る');

        article.append(top, stage, title, description, link);
        container.appendChild(article);
    });
})();
