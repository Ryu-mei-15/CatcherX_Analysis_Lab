const resultData = {
    overall: {
        description: '予稿に掲載した全体集計値．',
        columns: ['集計', '試行数', '平均制球誤差', '平均ミット補正量', '平均誤差減少量', '低減率中央値', '集計低減率', '改善試行率'],
        rows: [
            ['全体', '1,946', '16.9 cm', '12.9 cm', '4.0 cm', '30.4%', '23.9%', '75.5%']
        ],
        visual: [{ label: '全体', control: 16.9, correction: 12.9 }]
    },
    speed: {
        description: '100，130，158 km/hの球速条件ごとの集計値．',
        columns: ['球速条件', '試行数', '平均制球誤差', '平均ミット補正量', '平均誤差減少量', '低減率中央値', '集計低減率', '改善試行率'],
        rows: [
            ['100 km/h', '644', '17.0 cm', '11.5 cm', '5.5 cm', '34.2%', '32.4%', '80.9%'],
            ['130 km/h', '642', '16.5 cm', '13.2 cm', '3.3 cm', '28.2%', '19.9%', '73.4%'],
            ['158 km/h', '660', '17.2 cm', '13.8 cm', '3.3 cm', '27.1%', '19.4%', '72.3%']
        ],
        visual: [
            { label: '100 km/h', control: 17.0, correction: 11.5 },
            { label: '130 km/h', control: 16.5, correction: 13.2 },
            { label: '158 km/h', control: 17.2, correction: 13.8 }
        ]
    },
    participant: {
        description: '実験ログのPlayer 1，2，3，5，6，7ごとの集計値．',
        columns: ['参加者', '試行数', '平均制球誤差', '平均ミット補正量', '平均誤差減少量', '低減率中央値', '集計低減率', '改善試行率'],
        rows: [
            ['Player 1', '326', '16.4 cm', '10.5 cm', '5.9 cm', '38.8%', '36.1%', '81.9%'],
            ['Player 2', '322', '17.0 cm', '16.1 cm', '0.9 cm', '13.0%', '5.1%', '61.5%'],
            ['Player 3', '344', '17.0 cm', '13.5 cm', '3.5 cm', '34.1%', '20.5%', '74.4%'],
            ['Player 5', '291', '16.6 cm', '10.5 cm', '6.1 cm', '39.9%', '36.7%', '83.2%'],
            ['Player 6', '353', '16.6 cm', '10.9 cm', '5.8 cm', '35.9%', '34.6%', '83.0%'],
            ['Player 7', '310', '17.7 cm', '15.7 cm', '2.0 cm', '14.4%', '11.5%', '68.7%']
        ],
        visual: [
            { label: 'P1', control: 16.4, correction: 10.5 },
            { label: 'P2', control: 17.0, correction: 16.1 },
            { label: 'P3', control: 17.0, correction: 13.5 },
            { label: 'P5', control: 16.6, correction: 10.5 },
            { label: 'P6', control: 16.6, correction: 10.9 },
            { label: 'P7', control: 17.7, correction: 15.7 }
        ]
    }
};

const participantSummaries = {
    overall: {
        label: '全体', trials: '1,946', control: '16.9', correction: '12.9',
        reduction: '4.0 cm', medianRate: '30.4%', aggregateRate: '23.9%', improvement: '75.5'
    },
    'Player 1': {
        label: 'Player 1', trials: '326', control: '16.4', correction: '10.5',
        reduction: '5.9 cm', medianRate: '38.8%', aggregateRate: '36.1%', improvement: '81.9'
    },
    'Player 2': {
        label: 'Player 2', trials: '322', control: '17.0', correction: '16.1',
        reduction: '0.9 cm', medianRate: '13.0%', aggregateRate: '5.1%', improvement: '61.5'
    },
    'Player 3': {
        label: 'Player 3', trials: '344', control: '17.0', correction: '13.5',
        reduction: '3.5 cm', medianRate: '34.1%', aggregateRate: '20.5%', improvement: '74.4'
    },
    'Player 5': {
        label: 'Player 5', trials: '291', control: '16.6', correction: '10.5',
        reduction: '6.1 cm', medianRate: '39.9%', aggregateRate: '36.7%', improvement: '83.2'
    },
    'Player 6': {
        label: 'Player 6', trials: '353', control: '16.6', correction: '10.9',
        reduction: '5.8 cm', medianRate: '35.9%', aggregateRate: '34.6%', improvement: '83.0'
    },
    'Player 7': {
        label: 'Player 7', trials: '310', control: '17.7', correction: '15.7',
        reduction: '2.0 cm', medianRate: '14.4%', aggregateRate: '11.5%', improvement: '68.7'
    }
};

function renderParticipantSummary(key) {
    const summary = participantSummaries[key] || participantSummaries.overall;
    const isOverall = key === 'overall';

    document.getElementById('summaryTrials').textContent = summary.trials;
    document.getElementById('summaryControl').textContent = summary.control;
    document.getElementById('summaryCorrection').textContent = summary.correction;
    document.getElementById('summaryImprovement').textContent = summary.improvement;
    document.getElementById('summaryReduction').textContent = summary.reduction;
    document.getElementById('summaryMedianRate').textContent = summary.medianRate;
    document.getElementById('summaryAggregateRate').textContent = summary.aggregateRate;
    document.getElementById('summaryTrialsNote').textContent = isOverall
        ? '全参加者の有効試行'
        : `${summary.label}の有効試行`;
    document.getElementById('summaryCorrectionNote').textContent = isOverall
        ? '全参加者の集計値'
        : `${summary.label}の集計値`;
    document.getElementById('summaryScopeDescription').textContent = isOverall
        ? '全参加者1,946試行の集計値を表示している．'
        : `${summary.label}の${summary.trials}試行について，身体的補正の主要結果を表示している．`;
}

function renderResult(viewName) {
    const data = resultData[viewName];
    const table = document.getElementById('resultTable');
    const visual = document.getElementById('comparisonVisual');

    document.getElementById('tableDescription').textContent = data.description;
    table.innerHTML = `
        <thead><tr>${data.columns.map(column => `<th scope="col">${column}</th>`).join('')}</tr></thead>
        <tbody>${data.rows.map(row => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    `;

    visual.innerHTML = `
        <div class="visual-legend"><span class="control-key">平均制球誤差</span><span class="correction-key">平均ミット補正量</span><small>単位：cm</small></div>
        <div class="visual-rows">
            ${data.visual.map(item => `
                <div class="visual-row">
                    <strong>${item.label}</strong>
                    <div class="visual-bars">
                        <span class="data-bar control" style="width:${item.control / 20 * 100}%"><i>${item.control.toFixed(1)}</i></span>
                        <span class="data-bar correction" style="width:${item.correction / 20 * 100}%"><i>${item.correction.toFixed(1)}</i></span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('[data-view]').forEach(tab => tab.setAttribute('aria-selected', 'false'));
        button.setAttribute('aria-selected', 'true');
        renderResult(button.dataset.view);
    });
});

document.getElementById('participantResultSelect').addEventListener('change', event => {
    renderParticipantSummary(event.target.value);
});

renderParticipantSummary('overall');
renderResult('overall');
