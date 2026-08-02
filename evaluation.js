const STORAGE_KEY = 'catcherx-standardized-evaluation-v1';

const tlxDimensions = [
    { key: 'mental', label: '精神的要求' },
    { key: 'physical', label: '身体的要求' },
    { key: 'temporal', label: '時間的要求' },
    { key: 'performance', label: '作業成績' },
    { key: 'effort', label: '努力' },
    { key: 'frustration', label: '不満' }
];

const susItems = [
    'CatcherXを頻繁に利用したいと思う',
    'CatcherXは必要以上に複雑だと感じる',
    'CatcherXは使いやすいと感じる',
    'CatcherXを利用するには技術的な支援が必要だと思う',
    'CatcherXの各機能はうまく統合されていると感じる',
    'CatcherXには一貫していない部分が多いと感じる',
    '多くの人がCatcherXの使い方をすぐに習得できると思う',
    'CatcherXは扱いにくいと感じる',
    'CatcherXを利用することに自信がある',
    'CatcherXを使い始める前に多くのことを学ぶ必要がある'
];

const form = document.getElementById('evaluationForm');
const pairwiseContainer = document.getElementById('pairwiseComparisons');
const susContainer = document.getElementById('susQuestions');
const weightingPanel = document.getElementById('weightingPanel');

function createPairwiseComparisons() {
    const pairs = [];
    for (let i = 0; i < tlxDimensions.length; i += 1) {
        for (let j = i + 1; j < tlxDimensions.length; j += 1) {
            pairs.push([tlxDimensions[i], tlxDimensions[j]]);
        }
    }

    pairwiseContainer.innerHTML = pairs.map((pair, index) => `
        <fieldset class="pairwise-item">
            <legend>${index + 1}. より負荷に寄与した側面</legend>
            <label><input type="radio" name="pair${index}" value="${pair[0].key}"> ${pair[0].label}</label>
            <label><input type="radio" name="pair${index}" value="${pair[1].key}"> ${pair[1].label}</label>
        </fieldset>
    `).join('');
}

function createSusQuestions() {
    susContainer.innerHTML = susItems.map((item, index) => `
        <fieldset class="sus-item">
            <legend><span>${index + 1}</span>${item}</legend>
            <div class="sus-options" aria-label="設問${index + 1}の回答">
                ${[1, 2, 3, 4, 5].map(value => `
                    <label>
                        <input type="radio" name="sus${index + 1}" value="${value}">
                        <span>${value}</span>
                    </label>
                `).join('')}
            </div>
        </fieldset>
    `).join('');
}

function getTlxRatings() {
    return Object.fromEntries(tlxDimensions.map(dimension => {
        const input = form.elements[dimension.key];
        return [dimension.key, Number(input.value)];
    }));
}

function getPairwiseWeights() {
    const weights = Object.fromEntries(tlxDimensions.map(dimension => [dimension.key, 0]));
    let completed = 0;

    for (let index = 0; index < 15; index += 1) {
        const selected = form.querySelector(`input[name="pair${index}"]:checked`);
        if (selected) {
            weights[selected.value] += 1;
            completed += 1;
        }
    }

    return { weights, completed };
}

function calculateTlx() {
    const ratings = getTlxRatings();
    const method = form.elements.tlxMethod.value;
    const rawScore = Object.values(ratings).reduce((sum, value) => sum + value, 0) / 6;
    const { weights, completed } = getPairwiseWeights();
    const weightedScore = completed === 15
        ? tlxDimensions.reduce((sum, dimension) => sum + ratings[dimension.key] * weights[dimension.key], 0) / 15
        : null;

    return {
        method,
        ratings,
        weights,
        weightsCompleted: completed,
        rawScore,
        score: method === 'weighted' ? weightedScore : rawScore
    };
}

function getSusResponses() {
    return susItems.map((_, index) => {
        const selected = form.querySelector(`input[name="sus${index + 1}"]:checked`);
        return selected ? Number(selected.value) : null;
    });
}

function calculateSus(responses) {
    if (responses.some(value => value === null)) return null;
    const contribution = responses.reduce((sum, response, index) => {
        return sum + (index % 2 === 0 ? response - 1 : 5 - response);
    }, 0);
    return contribution * 2.5;
}

function updateLiveScores() {
    const tlx = calculateTlx();
    const tlxScore = document.getElementById('tlxLiveScore');
    const tlxMethod = document.getElementById('tlxScoreMethod');

    if (tlx.method === 'weighted' && tlx.score === null) {
        tlxScore.textContent = '—';
        tlxMethod.textContent = `一対比較 ${tlx.weightsCompleted} / 15`;
    } else {
        tlxScore.textContent = tlx.score.toFixed(1);
        tlxMethod.textContent = tlx.method === 'weighted' ? '重み付きNASA-TLX' : 'Raw TLX';
    }

    tlxDimensions.forEach(dimension => {
        const input = form.elements[dimension.key];
        const output = input.closest('.scale-slider').querySelector('output');
        output.textContent = input.value;
    });

    const susResponses = getSusResponses();
    const completed = susResponses.filter(value => value !== null).length;
    const susScore = calculateSus(susResponses);
    document.getElementById('susLiveScore').textContent = susScore === null ? '—' : susScore.toFixed(1);
    document.getElementById('susCompletion').textContent = `${completed} / 10項目回答`;
}

function updateMethodVisibility() {
    const weighted = form.elements.tlxMethod.value === 'weighted';
    weightingPanel.open = weighted;
    weightingPanel.classList.toggle('required-weighting', weighted);
    updateLiveScores();
}

function loadRecords() {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values) {
    if (values.length < 2) return null;
    const average = mean(values);
    return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

function formatSummary(value, sd) {
    if (value === null || Number.isNaN(value)) return '—';
    return sd === null ? value.toFixed(1) : `${value.toFixed(1)} ± ${sd.toFixed(1)}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function groupRecords(records) {
    const groups = new Map();
    records.forEach(record => {
        if (!groups.has(record.condition)) groups.set(record.condition, []);
        groups.get(record.condition).push(record);
    });
    return Array.from(groups, ([condition, items]) => {
        const tlxValues = items.map(item => item.tlxScore);
        const susValues = items.map(item => item.susScore);
        return {
            condition,
            n: items.length,
            tlxMean: mean(tlxValues),
            tlxSd: sampleSd(tlxValues),
            susMean: mean(susValues),
            susSd: sampleSd(susValues)
        };
    });
}

function renderComparison() {
    const records = loadRecords();
    const empty = document.getElementById('comparisonEmpty');
    const content = document.getElementById('comparisonContent');

    if (records.length === 0) {
        empty.hidden = false;
        content.hidden = true;
        return;
    }

    empty.hidden = true;
    content.hidden = false;
    const groups = groupRecords(records);

    document.getElementById('conditionComparison').innerHTML = groups.map(group => `
        <article class="condition-result">
            <div><strong>${escapeHtml(group.condition)}</strong><span>n = ${group.n}</span></div>
            <label><span>NASA-TLX</span><i class="tlx-bar" style="width:${group.tlxMean}%"></i><b>${group.tlxMean.toFixed(1)}</b></label>
            <label><span>SUS</span><i class="sus-bar" style="width:${group.susMean}%"></i><b>${group.susMean.toFixed(1)}</b></label>
        </article>
    `).join('');

    document.getElementById('summaryTable').innerHTML = `
        <thead><tr><th scope="col">条件</th><th scope="col">n</th><th scope="col">NASA-TLX 平均 ± SD</th><th scope="col">SUS 平均 ± SD</th></tr></thead>
        <tbody>${groups.map(group => `
            <tr>
                <th scope="row">${escapeHtml(group.condition)}</th>
                <td>${group.n}</td>
                <td>${formatSummary(group.tlxMean, group.tlxSd)}</td>
                <td>${formatSummary(group.susMean, group.susSd)}</td>
            </tr>
        `).join('')}</tbody>
    `;

    document.getElementById('responseTable').innerHTML = `
        <thead><tr><th scope="col">参加者ID</th><th scope="col">条件</th><th scope="col">方式</th><th scope="col">NASA-TLX</th><th scope="col">SUS</th><th scope="col">測定日</th><th scope="col"></th></tr></thead>
        <tbody>${records.map(record => `
            <tr>
                <th scope="row">${escapeHtml(record.participantId)}</th>
                <td>${escapeHtml(record.condition)}</td>
                <td>${record.tlxMethod === 'weighted' ? '重み付き' : 'Raw'}</td>
                <td>${record.tlxScore.toFixed(1)}</td>
                <td>${record.susScore.toFixed(1)}</td>
                <td>${escapeHtml(record.recordedDate || '—')}</td>
                <td><button type="button" class="row-delete" data-id="${record.id}" aria-label="${escapeHtml(record.participantId)}の回答を削除">削除</button></td>
            </tr>
        `).join('')}</tbody>
    `;

    document.querySelectorAll('.row-delete').forEach(button => {
        button.addEventListener('click', () => {
            const next = loadRecords().filter(record => record.id !== button.dataset.id);
            saveRecords(next);
            renderComparison();
        });
    });
}

function csvEscape(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
    const records = loadRecords();
    if (records.length === 0) return;

    const headers = [
        'participant_id', 'condition', 'session_label', 'recorded_date', 'tlx_method',
        ...tlxDimensions.map(d => `tlx_${d.key}`),
        ...tlxDimensions.map(d => `tlx_weight_${d.key}`),
        'tlx_score', ...susItems.map((_, index) => `sus_${index + 1}`), 'sus_score'
    ];
    const rows = records.map(record => [
        record.participantId, record.condition, record.sessionLabel, record.recordedDate, record.tlxMethod,
        ...tlxDimensions.map(d => record.tlxRatings[d.key]),
        ...tlxDimensions.map(d => record.tlxWeights[d.key]),
        record.tlxScore, ...record.susResponses, record.susScore
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `catcherx_standard_scales_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

form.addEventListener('input', updateLiveScores);
form.elements.tlxMethod.forEach(input => input.addEventListener('change', updateMethodVisibility));

form.addEventListener('submit', event => {
    event.preventDefault();
    const message = document.getElementById('formMessage');
    const tlx = calculateTlx();
    const susResponses = getSusResponses();
    const susScore = calculateSus(susResponses);

    if (tlx.method === 'weighted' && tlx.score === null) {
        message.textContent = '重み付き方式では15組すべての一対比較に回答してください．';
        weightingPanel.open = true;
        weightingPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    if (susScore === null) {
        message.textContent = 'SUSの10項目すべてに回答してください．';
        document.getElementById('sus').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        participantId: form.elements.participantId.value.trim(),
        condition: form.elements.condition.value,
        sessionLabel: form.elements.sessionLabel.value.trim(),
        recordedDate: form.elements.recordedDate.value,
        tlxMethod: tlx.method,
        tlxRatings: tlx.ratings,
        tlxWeights: tlx.weights,
        tlxScore: tlx.score,
        susResponses,
        susScore,
        savedAt: new Date().toISOString()
    };

    const records = loadRecords();
    records.push(record);
    saveRecords(records);
    message.textContent = `${record.participantId}・${record.condition}の回答をこのブラウザに保存しました．`;
    renderComparison();
    document.getElementById('comparison').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

form.addEventListener('reset', () => {
    window.setTimeout(() => {
        document.getElementById('formMessage').textContent = '';
        updateMethodVisibility();
    }, 0);
});

document.getElementById('exportCsv').addEventListener('click', exportCsv);
document.getElementById('clearResponses').addEventListener('click', () => {
    if (!window.confirm('このブラウザに保存した標準尺度の回答をすべて削除しますか？')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderComparison();
});

createPairwiseComparisons();
createSusQuestions();
updateMethodVisibility();
renderComparison();
