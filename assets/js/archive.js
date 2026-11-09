'use strict';

(function () {
    const container = document.getElementById('eventArchive');
    const events = window.catcherXEvents;
    if (!container || !Array.isArray(events)) return;

    events.forEach(function (event) {
        const card = document.createElement('a');
        card.className = 'archive-event-card ' + event.type;
        card.href = event.path;

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
        const linkLabel = document.createElement('span');
        linkLabel.className = 'archive-event-link-label';
        linkLabel.textContent = event.links.length ? '発表ページを見る →' : '記録枠を見る →';

        card.append(top, stage, title, description, linkLabel);
        container.appendChild(card);
    });
})();
