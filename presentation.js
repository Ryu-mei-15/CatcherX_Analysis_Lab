'use strict';

(function () {
    const container = document.getElementById('presentationMaterials');
    const status = document.getElementById('presentationReleaseStatus');
    const config = window.presentationMaterialsConfig;

    if (!container || !status || !config) return;

    const publishedMaterials = config.materials.filter(function (material) {
        return material.published;
    });
    const allPublished = publishedMaterials.length === config.materials.length;
    status.classList.toggle('is-published', publishedMaterials.length > 0);
    status.querySelector('strong').textContent = allPublished ? 'すべて公開中' : 'ポスター公開中';
    status.querySelector('span').textContent = allPublished
        ? '発表資料をブラウザ内で閲覧できる．'
        : '発表スライドは発表終了後に公開予定';

    container.innerHTML = config.materials.map(function (material) {
        const state = material.published
            ? '<button type="button" class="material-open-button" data-material-id="' + material.id + '">ブラウザ内で閲覧する</button>'
            : '<span class="material-locked-label" aria-label="現在は非公開">' + material.releaseLabel + '</span>';
        const metadata = material.published
            ? '<dl><div><dt>ページ数</dt><dd>' + material.pages + 'ページ</dd></div>' +
                '<div><dt>ファイル容量</dt><dd>' + material.fileSize + '</dd></div>' +
                '<div><dt>公開状態</dt><dd>公開中</dd></div></dl>'
            : '<dl><div><dt>公開状態</dt><dd>' + material.releaseLabel + '</dd></div></dl>';
        return '<article class="presentation-material-card" data-material="' + material.id + '">' +
            '<div class="material-document-mark" aria-hidden="true">' + (material.id === 'slides' ? 'SL' : 'PO') + '</div>' +
            '<div class="material-card-content"><div class="material-card-heading"><div><span>EC2026 PRESENTATION MATERIAL</span>' +
            '<h3>' + material.title + '</h3></div>' + state + '</div>' +
            '<p>' + material.description + '</p>' +
            metadata +
            '<div class="material-viewer-slot" id="viewer-' + material.id + '"></div></div></article>';
    }).join('');

    container.querySelectorAll('.material-open-button').forEach(function (button) {
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', function () {
            const material = config.materials.find(function (item) {
                return item.id === button.dataset.materialId;
            });
            if (!material) return;

            const slot = document.getElementById('viewer-' + material.id);
            const isOpen = slot.hasChildNodes();
            container.querySelectorAll('.material-viewer-slot').forEach(function (otherSlot) {
                otherSlot.replaceChildren();
            });
            container.querySelectorAll('.material-open-button').forEach(function (otherButton) {
                otherButton.textContent = 'ブラウザ内で閲覧する';
                otherButton.setAttribute('aria-expanded', 'false');
            });
            if (isOpen) return;

            const viewer = document.createElement('div');
            viewer.className = 'presentation-pdf-viewer';
            const guard = document.createElement('div');
            guard.className = 'paper-viewer-guard';
            guard.innerHTML = '<span><i></i>閲覧専用表示</span><small>' + material.title + '</small>';
            const frame = document.createElement('iframe');
            frame.className = 'paper-frame';
            frame.src = material.path + '#toolbar=0&navpanes=0&scrollbar=1&view=FitH';
            frame.title = material.title + ' 全' + material.pages + 'ページ';
            frame.loading = 'lazy';
            frame.referrerPolicy = 'no-referrer';
            viewer.append(guard, frame);
            slot.appendChild(viewer);
            button.textContent = '閲覧を閉じる';
            button.setAttribute('aria-expanded', 'true');
            slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });
})();
