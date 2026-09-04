'use strict';

(function () {
    const events = window.catcherXEvents;
    const root = document.getElementById('eventPage');
    if (!root || !Array.isArray(events)) return;

    const id = document.body.dataset.eventId || new URLSearchParams(window.location.search).get('id') || 'ec-2026';
    const rootPrefix = document.body.dataset.rootPrefix || '';
    const event = events.find(function (item) { return item.id === id; });
    if (!event) {
        document.title = '発表記録が見つかりません | CatcherX';
        root.innerHTML = '<section class="event-empty"><p class="section-kicker">NOT FOUND</p><h1>発表記録が見つかりません</h1><p>URLを確認するか，発表アーカイブへ戻ってください．</p><a href="' + rootPrefix + 'index.html#archive">発表アーカイブへ戻る</a></section>';
        return;
    }

    document.title = event.title + ' | CatcherX Research Archive';
    document.getElementById('eventYear').textContent = event.year;
    document.getElementById('eventStage').textContent = event.stage;
    document.getElementById('eventTitle').textContent = event.title;
    const subtitle = document.getElementById('eventSubtitle');
    subtitle.textContent = event.subtitle || event.description;
    const status = document.getElementById('eventStatus');
    status.textContent = event.status;
    status.classList.add(event.type);
    document.getElementById('eventDescription').textContent = event.description;
    document.getElementById('eventNote').textContent = event.note;

    const contents = document.getElementById('eventContents');
    if (!event.links.length) {
        const empty = document.createElement('div');
        empty.className = 'event-content-empty';
        empty.innerHTML = '<strong>公開資料を整理しています</strong><p>内容を確認できた資料から，このページへ追加します．</p>';
        contents.appendChild(empty);
        return;
    }

    const groups = [];
    event.links.forEach(function (link) {
        if (!groups.includes(link.group)) groups.push(link.group);
    });
    groups.forEach(function (groupName) {
        const section = document.createElement('section');
        section.className = 'event-link-group';
        const heading = document.createElement('h2');
        heading.textContent = groupName;
        const grid = document.createElement('div');
        grid.className = 'event-link-grid';
        event.links.filter(function (link) { return link.group === groupName; }).forEach(function (link) {
            const anchor = document.createElement('a');
            anchor.href = link.href;
            const label = document.createElement('strong');
            label.textContent = link.label;
            const detail = document.createElement('span');
            detail.textContent = link.detail;
            anchor.append(label, detail);
            grid.appendChild(anchor);
        });
        section.append(heading, grid);
        contents.appendChild(section);
    });
})();
