const reactionOrder = ['見逃し', 'ハーフスイング', '空振り'];

const pitchTypeLabels = {
    Straight: 'ストレート',
    Splitter: 'スプリッター',
    Slider: 'スライダー',
    Sweeper: 'スイーパー',
    VSlider: 'Vスライダー',
    Curve: 'カーブ',
    Changeup: 'チェンジアップ',
    SinkingFast: 'シンキングファスト',
    Fork: 'フォーク',
    Shoot: 'シュート',
    Sinker: 'シンカー',
    Eephus: 'イーファス',
    TwoSeamGyro: 'ツーシームジャイロ',
    KnuckleCurve: 'ナックルカーブ',
    PalmChange: 'パームチェンジ',
    TwoSeam: 'ツーシーム',
    Slatter: 'スラッター',
    Drop: 'ドロップ',
    Splinker: 'スプリンカー',
    DCurve: 'Dカーブ',
    FourseamGyro: 'フォーシームジャイロ'
};

const courseLabels = {
    'High Inside Ball': '内角高めボール',
    'High Inside Center Ball': '内角高めボール',
    'High Center Ball': '高めボール',
    'High Outside Center Ball': '外角高め寄りボール',
    'High Outside Ball': '外角高めボール',
    'Mid-High Inside Ball': '内角高めボール',
    'High Inside': '内角高め',
    'High Center': '高め',
    'High Outside': '外角高め',
    'Mid-High Outside Ball': '外角高めボール',
    'Mid Inside Ball': '内角ボール',
    'Mid Inside': '内角',
    'Mid Center': '真ん中',
    'Mid Outside': '外角',
    'Mid Outside Ball': '外角ボール',
    'Mid-Low Inside Ball': '内角低めボール',
    'Low Inside': '内角低め',
    'Low Center': '低め',
    'Low Outside': '外角低め',
    'Mid-Low Outside Ball': '外角低めボール',
    'Low Inside Ball': '内角低めボール',
    'Low Inside Center Ball': '内角低めボール',
    'Low Center Ball': '低めボール',
    'Low Outside Center Ball': '外角低めボール',
    'Low Outside Ball': '外角低めボール'
};

const catchResultLabels = {
    Strike: 'ストライク・捕球',
    Strike_PassedBall: 'ストライク・後逸',
    Strike_Missed: 'ストライク・捕球失敗',
    Ball: 'ボール・捕球',
    Ball_PassedBall: 'ボール・後逸',
    Ball_Missed: 'ボール・捕球失敗'
};

const pitchTones = ['#0b4f8a', '#176aa5', '#2f78b7', '#4f8fbd', '#6aa3c8'];

const outcomeDefinitions = {
    pitch_changed: {
        number: 'ANALYSIS 01',
        title: '球種変更率',
        description: '直前球と次球で，選択された球種が変わった割合を比較する．',
        categories: [false, true],
        labels: ['維持', '変更'],
        colors: ['#c8d5df', '#0b4f8a'],
        sensitivityP: 0.2374,
        pairwise: true
    },
    course_changed: {
        number: 'ANALYSIS 02',
        title: 'コース変更率',
        description: '直前球と次球で，選択された投球コースが変わった割合を比較する．',
        categories: [false, true],
        labels: ['維持', '変更'],
        colors: ['#c8d5df', '#2f78b7'],
        sensitivityP: 0.3229,
        pairwise: true
    },
    next_pitch_group: {
        number: 'ANALYSIS 03',
        title: '次球種の選択',
        description: '打者反応後の次球を，ストレートと変化球に分類して比較する．',
        categories: ['ストレート', '変化球'],
        labels: ['ストレート', '変化球'],
        colors: ['#86a8c0', '#0b4f8a'],
        sensitivityP: 0.8713,
        pairwise: false
    },
    next_course_height: {
        number: 'ANALYSIS 04',
        title: '次コースの高さ',
        description: '打者反応後の次コースを，高め・真ん中・低めに分類して比較する．',
        categories: ['高め', '真ん中', '低め'],
        labels: ['高め', '真ん中', '低め'],
        colors: ['#8eb8d5', '#3f7fac', '#0b4f8a'],
        sensitivityP: 0.3198,
        pairwise: false
    }
};

let phase3Data = null;
let analysisResults = {};

function buildTable(key, definition) {
    return reactionOrder.map(reaction => definition.categories.map(category =>
        phase3Data.transitions.filter(item =>
            item.previous_reaction === reaction && item[key] === category
        ).length
    ));
}

function tableStatistics(table) {
    const rowTotals = table.map(row => row.reduce((sum, value) => sum + value, 0));
    const columnTotals = table[0].map((_, column) => table.reduce((sum, row) => sum + row[column], 0));
    const total = rowTotals.reduce((sum, value) => sum + value, 0);
    let chiSquare = 0;
    let minimumExpected = Infinity;

    table.forEach((row, rowIndex) => row.forEach((observed, columnIndex) => {
        const expected = rowTotals[rowIndex] * columnTotals[columnIndex] / total;
        chiSquare += (observed - expected) ** 2 / expected;
        minimumExpected = Math.min(minimumExpected, expected);
    }));

    const degreesFreedom = (table.length - 1) * (table[0].length - 1);
    const cramersV = Math.sqrt(chiSquare / (total * Math.min(table.length - 1, table[0].length - 1)));
    return { rowTotals, columnTotals, total, chiSquare, degreesFreedom, cramersV, minimumExpected };
}

function createLogFactorials(maximum) {
    const values = [0];
    for (let value = 1; value <= maximum; value += 1) {
        values[value] = values[value - 1] + Math.log(value);
    }
    return values;
}

function enumerateRows(total, capacities, callback, position = 0, current = []) {
    if (position === capacities.length - 1) {
        if (total >= 0 && total <= capacities[position]) callback([...current, total]);
        return;
    }

    const remainingCapacity = capacities.slice(position + 1).reduce((sum, value) => sum + value, 0);
    const minimum = Math.max(0, total - remainingCapacity);
    const maximum = Math.min(capacities[position], total);
    for (let value = minimum; value <= maximum; value += 1) {
        enumerateRows(total - value, capacities, callback, position + 1, [...current, value]);
    }
}

function exactConditionalP(table) {
    const stats = tableStatistics(table);
    const rows = table.length;
    const columns = table[0].length;
    const logFactorial = createLogFactorials(stats.total);
    const logConstant = stats.rowTotals.reduce((sum, value) => sum + logFactorial[value], 0)
        + stats.columnTotals.reduce((sum, value) => sum + logFactorial[value], 0)
        - logFactorial[stats.total];
    const logProbability = candidate => logConstant - candidate.reduce(
        (sum, row) => sum + row.reduce((rowSum, value) => rowSum + logFactorial[value], 0), 0
    );
    const observedLogProbability = logProbability(table);
    let exactP = 0;
    let enumeratedTables = 0;

    function enumerateTable(rowIndex, remainingColumns, currentRows) {
        if (rowIndex === rows - 1) {
            if (remainingColumns.reduce((sum, value) => sum + value, 0) !== stats.rowTotals[rowIndex]) return;
            const candidate = [...currentRows, remainingColumns];
            const candidateLogProbability = logProbability(candidate);
            enumeratedTables += 1;
            if (candidateLogProbability <= observedLogProbability + 1e-12) {
                exactP += Math.exp(candidateLogProbability);
            }
            return;
        }

        enumerateRows(stats.rowTotals[rowIndex], remainingColumns, row => {
            const nextColumns = remainingColumns.map((value, index) => value - row[index]);
            enumerateTable(rowIndex + 1, nextColumns, [...currentRows, row]);
        });
    }

    enumerateTable(0, stats.columnTotals, []);
    return { p: Math.min(1, exactP), enumeratedTables, ...stats };
}

function formatP(value) {
    if (value < 0.001) return '< .001';
    return `= ${value.toFixed(3).replace(/^0/, '')}`;
}

function effectLabel(value) {
    if (value < 0.1) return 'ごく小さい効果量';
    if (value < 0.3) return '小さい効果量';
    if (value < 0.5) return '中程度の効果量';
    return '大きい効果量';
}

function renderBars(table, definition) {
    const legend = `<div class="reaction-legend">${definition.labels.map((label, index) =>
        `<span><i style="background:${definition.colors[index]}"></i>${label}</span>`
    ).join('')}</div>`;

    const rows = reactionOrder.map((reaction, rowIndex) => {
        const total = table[rowIndex].reduce((sum, value) => sum + value, 0);
        return `
            <div class="reaction-bar-row">
                <div><strong>${reaction}</strong><small>n = ${total}</small></div>
                <div class="stacked-reaction-bar">
                    ${table[rowIndex].map((value, index) => {
                        const percentage = value / total * 100;
                        return `<span style="width:${percentage}%;background:${definition.colors[index]}" title="${definition.labels[index]} ${value}球（${percentage.toFixed(1)}%）"><b>${percentage >= 13 ? `${percentage.toFixed(1)}%` : ''}</b></span>`;
                    }).join('')}
                </div>
            </div>`;
    }).join('');

    document.getElementById('reactionBars').innerHTML = legend + rows;
}

function renderContingencyTable(table, definition) {
    const rowTotals = table.map(row => row.reduce((sum, value) => sum + value, 0));
    document.getElementById('contingencyTable').innerHTML = `
        <thead><tr><th scope="col">直前球の打者反応</th>${definition.labels.map(label => `<th scope="col">${label}</th>`).join('')}<th scope="col">計</th></tr></thead>
        <tbody>${reactionOrder.map((reaction, rowIndex) => `
            <tr><th scope="row">${reaction}</th>${table[rowIndex].map(value => `<td>${value}</td>`).join('')}<td>${rowTotals[rowIndex]}</td></tr>
        `).join('')}</tbody>`;
}

function pairwiseComparisons(table) {
    const comparisons = [];
    for (let first = 0; first < reactionOrder.length; first += 1) {
        for (let second = first + 1; second < reactionOrder.length; second += 1) {
            const pairTable = [table[first], table[second]];
            comparisons.push({
                label: `${reactionOrder[first]} vs ${reactionOrder[second]}`,
                rawP: exactConditionalP(pairTable).p
            });
        }
    }

    const order = comparisons.map((_, index) => index).sort((a, b) => comparisons[a].rawP - comparisons[b].rawP);
    let previous = 0;
    order.forEach((index, rank) => {
        const adjusted = Math.min(1, comparisons[index].rawP * (comparisons.length - rank));
        previous = Math.max(previous, adjusted);
        comparisons[index].adjustedP = previous;
    });
    return comparisons;
}

function renderPairwise(table, definition) {
    const section = document.getElementById('pairwiseSection');
    section.hidden = !definition.pairwise;
    if (!definition.pairwise) return;

    const comparisons = pairwiseComparisons(table);
    document.getElementById('pairwiseTable').innerHTML = `
        <thead><tr><th scope="col">比較</th><th scope="col">未補正 p</th><th scope="col">Holm補正 p</th><th scope="col">判定</th></tr></thead>
        <tbody>${comparisons.map(comparison => `
            <tr><th scope="row">${comparison.label}</th><td>${comparison.rawP.toFixed(3)}</td><td>${comparison.adjustedP.toFixed(3)}</td><td>非有意</td></tr>
        `).join('')}</tbody>`;
}

function renderOutcome(key) {
    const definition = outcomeDefinitions[key];
    const table = buildTable(key, definition);
    const result = analysisResults[key] || exactConditionalP(table);
    analysisResults[key] = result;

    document.getElementById('outcomeNumber').textContent = definition.number;
    document.getElementById('outcomeTitle').textContent = definition.title;
    document.getElementById('outcomeDescription').textContent = definition.description;
    document.getElementById('exactPValue').innerHTML = `<i>p</i> ${formatP(result.p)}`;
    document.getElementById('chiSquare').textContent = result.chiSquare.toFixed(3);
    document.getElementById('degreesFreedom').textContent = `df = ${result.degreesFreedom}`;
    document.getElementById('cramersV').textContent = result.cramersV.toFixed(3);
    document.getElementById('effectLabel').textContent = effectLabel(result.cramersV);
    document.getElementById('permutationP').innerHTML = `<i>p</i> ${formatP(definition.sensitivityP)}`;
    document.getElementById('minimumExpected').textContent = result.minimumExpected.toFixed(2);

    renderBars(table, definition);
    renderContingencyTable(table, definition);
    renderPairwise(table, definition);
}

function renderAllOutcomeCards() {
    document.getElementById('allOutcomeCards').innerHTML = Object.entries(outcomeDefinitions).map(([key, definition]) => {
        const result = analysisResults[key];
        return `
            <article>
                <span>${definition.number.replace('ANALYSIS ', '')}</span>
                <h3>${definition.title}</h3>
                <strong><i>p</i> ${formatP(result.p)}</strong>
                <dl><div><dt>Cramér's V</dt><dd>${result.cramersV.toFixed(3)}</dd></div><div><dt>判定</dt><dd>非有意</dd></div></dl>
            </article>`;
    }).join('');
}

function pitchTone(pitchType) {
    const hash = [...pitchType].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return pitchTones[hash % pitchTones.length];
}

function renderChangeTags(pitch) {
    if (pitch.sequence === 1) return '<span class="sequence-start">開始球</span>';
    const tags = [];
    if (pitch.pitch_changed_from_previous) tags.push('<span class="sequence-change pitch-change">球種変更</span>');
    if (pitch.course_changed_from_previous) tags.push('<span class="sequence-change course-change">コース変更</span>');
    if (!tags.length) tags.push('<span class="sequence-maintained">変更なし</span>');
    return tags.join('');
}

function renderPitchSequence(session) {
    const pitches = session.pitches;
    const pitchChanges = pitches.filter(pitch => pitch.pitch_changed_from_previous).length;
    const courseChanges = pitches.filter(pitch => pitch.course_changed_from_previous).length;

    document.getElementById('sequencePitchCount').textContent = pitches.length;
    document.getElementById('sequencePitchTypes').textContent = new Set(pitches.map(pitch => pitch.pitch_type)).size;
    document.getElementById('sequenceCourses').textContent = new Set(pitches.map(pitch => pitch.course)).size;
    document.getElementById('sequencePitchChanges').textContent = pitchChanges;
    document.getElementById('sequenceCourseChanges').textContent = courseChanges;

    const timeline = document.getElementById('pitchSequenceTimeline');
    timeline.setAttribute('aria-label', `${session.participant}の配球時系列`);
    timeline.innerHTML = pitches.map(pitch => `
        <article class="sequence-pitch" style="--pitch-tone:${pitchTone(pitch.pitch_type)}">
            <div class="sequence-pitch-number"><span>${String(pitch.sequence).padStart(2, '0')}</span><small>球目</small></div>
            <div class="sequence-pitch-body">
                <strong>${pitchTypeLabels[pitch.pitch_type] || pitch.pitch_type}</strong>
                <p class="sequence-course">${courseLabels[pitch.course] || pitch.course}</p>
                <dl>
                    <div><dt>球速</dt><dd>${pitch.speed_kmph === null ? '記録なし' : `${pitch.speed_kmph.toFixed(1)} km/h`}</dd></div>
                    <div><dt>打者反応</dt><dd>${pitch.batter_reaction}</dd></div>
                    <div><dt>捕球結果</dt><dd>${catchResultLabels[pitch.catch_result] || pitch.catch_result}</dd></div>
                </dl>
                <div class="sequence-change-list">${renderChangeTags(pitch)}</div>
            </div>
        </article>
    `).join('');

    document.getElementById('pitchSequenceTable').innerHTML = `
        <thead><tr><th scope="col">順番</th><th scope="col">球種</th><th scope="col">コース</th><th scope="col">球速</th><th scope="col">打者反応</th><th scope="col">捕球結果</th><th scope="col">直前球からの変更</th></tr></thead>
        <tbody>${pitches.map(pitch => `
            <tr>
                <th scope="row">${pitch.sequence}球目</th>
                <td><span class="pitch-type-dot" style="background:${pitchTone(pitch.pitch_type)}"></span>${pitchTypeLabels[pitch.pitch_type] || pitch.pitch_type}</td>
                <td>${courseLabels[pitch.course] || pitch.course}</td>
                <td>${pitch.speed_kmph === null ? '<span class="missing-value">記録なし</span>' : `${pitch.speed_kmph.toFixed(1)} km/h`}</td>
                <td>${pitch.batter_reaction}</td>
                <td>${catchResultLabels[pitch.catch_result] || pitch.catch_result}</td>
                <td><div class="sequence-change-list">${renderChangeTags(pitch)}</div></td>
            </tr>
        `).join('')}</tbody>`;
}

function initializeSequenceExplorer() {
    const tabs = document.getElementById('participantSequenceTabs');
    tabs.innerHTML = phase3Data.sessions.map((session, index) => `
        <button type="button" role="tab" aria-selected="${index === 0}" aria-controls="pitchSequenceTimeline" data-participant-index="${index}">${session.participant}</button>
    `).join('');

    tabs.querySelectorAll('[data-participant-index]').forEach(button => {
        button.addEventListener('click', () => {
            tabs.querySelectorAll('[data-participant-index]').forEach(tab => tab.setAttribute('aria-selected', 'false'));
            button.setAttribute('aria-selected', 'true');
            renderPitchSequence(phase3Data.sessions[Number(button.dataset.participantIndex)]);
        });
    });

    renderPitchSequence(phase3Data.sessions[0]);
}

async function initializePhase3() {
    const response = await fetch('phase3-data.json');
    if (!response.ok) throw new Error('第3フェーズのデータを読み込めませんでした．');
    phase3Data = await response.json();

    document.getElementById('participantCount').textContent = phase3Data.metadata.participants;
    document.getElementById('pitchCount').textContent = phase3Data.metadata.pitches;
    document.getElementById('transitionCount').textContent = phase3Data.metadata.transitions;

    Object.entries(outcomeDefinitions).forEach(([key, definition]) => {
        analysisResults[key] = exactConditionalP(buildTable(key, definition));
    });

    renderOutcome('pitch_changed');
    renderAllOutcomeCards();
    initializeSequenceExplorer();

    document.querySelectorAll('[data-outcome]').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('[data-outcome]').forEach(tab => tab.setAttribute('aria-selected', 'false'));
            button.setAttribute('aria-selected', 'true');
            renderOutcome(button.dataset.outcome);
        });
    });
}

if (typeof document !== 'undefined') {
    initializePhase3().catch(error => {
        console.error(error);
        document.getElementById('phase3Panel').innerHTML = `<p class="data-load-error">${error.message}</p>`;
    });
}
