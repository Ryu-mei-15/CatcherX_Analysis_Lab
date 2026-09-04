'use strict';

let records = [];
let summary = null;
let directionChart = null;
let outcomeChart = null;
let learningChart = null;
const colors = { blue: '#005ea8', pale: '#dceefa', amber: '#d98500', red: '#b63b3b', gray: '#9aa8b3' };

function fmt(value, digits) {
    const places = digits === undefined ? 1 : digits;
    return value === null || value === undefined || Number.isNaN(value) ? '—' : Number(value).toFixed(places);
}

function percent(value, digits) {
    const places = digits === undefined ? 1 : digits;
    return value === null || value === undefined ? '—' : (value * 100).toFixed(places) + '%';
}

function median(values) {
    const clean = values.filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!clean.length) return null;
    const middle = Math.floor(clean.length / 2);
    return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function wilson(successes, n) {
    if (!n) return [null, null];
    const z = 1.959963984540054;
    const p = successes / n;
    const denominator = 1 + z * z / n;
    const centre = (p + z * z / (2 * n)) / denominator;
    const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator;
    return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function summarize(rows, label) {
    const caught = rows.filter(function (row) { return row.is_caught; }).length;
    return {
        label: label || '', n: rows.length, caught: caught,
        catchRate: rows.length ? caught / rows.length : null,
        ci: wilson(caught, rows.length),
        caughtCosine: median(rows.filter(function (row) { return row.is_caught; }).map(function (row) { return row.direction_cosine_3d; })),
        failedCosine: median(rows.filter(function (row) { return !row.is_caught; }).map(function (row) { return row.direction_cosine_3d; })),
        caughtResidual: median(rows.filter(function (row) { return row.is_caught; }).map(function (row) { return row.residual_error_3d_cm; })),
        failedResidual: median(rows.filter(function (row) { return !row.is_caught; }).map(function (row) { return row.residual_error_3d_cm; }))
    };
}

function currentRows() {
    const player = document.getElementById('researchPlayer').value;
    const speed = document.getElementById('researchSpeed').value;
    const includeFlagged = document.getElementById('includeFlagged').checked;
    return records.filter(function (row) {
        return (includeFlagged || row.analysis_eligible) &&
            (player === 'all' || row.player === player) &&
            (speed === 'all' || row.speed === speed);
    });
}

function tableHead(labels) {
    return '<thead><tr>' + labels.map(function (label) { return '<th scope="col">' + label + '</th>'; }).join('') + '</tr></thead>';
}

function renderDirection() {
    const rows = currentRows();
    const stats = summarize(rows);
    const player = document.getElementById('researchPlayer').selectedOptions[0].textContent;
    const speed = document.getElementById('researchSpeed').selectedOptions[0].textContent;
    document.getElementById('filterSummary').textContent = player + '・' + speed + '・n = ' + rows.length.toLocaleString('ja-JP');
    document.getElementById('caughtCosine').textContent = fmt(stats.caughtCosine, 3);
    document.getElementById('failedCosine').textContent = fmt(stats.failedCosine, 3);
    document.getElementById('caughtResidual').textContent = fmt(stats.caughtResidual, 1);
    document.getElementById('failedResidual').textContent = fmt(stats.failedResidual, 1);

    const definitions = [[-1, 0, '−1–0'], [0, .5, '0–0.5'], [.5, .8, '0.5–0.8'],
        [.8, .9, '0.8–0.9'], [.9, .95, '0.9–0.95'], [.95, 1.000001, '0.95–1']];
    const bins = definitions.map(function (definition) {
        const selected = rows.filter(function (row) {
            return Number.isFinite(row.direction_cosine_3d) &&
                row.direction_cosine_3d >= definition[0] && row.direction_cosine_3d < definition[1];
        });
        return summarize(selected, definition[2]);
    });

    if (directionChart) directionChart.destroy();
    directionChart = new Chart(document.getElementById('directionChart'), {
        type: 'bar',
        data: {
            labels: bins.map(function (bin) { return bin.label; }),
            datasets: [{
                label: '捕球成功率',
                data: bins.map(function (bin) { return bin.catchRate === null ? null : bin.catchRate * 100; }),
                backgroundColor: colors.blue, borderRadius: 5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, title: { display: true, text: '捕球成功率 [%]' } },
                x: { title: { display: true, text: '3次元方向一致度' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { afterLabel: function (context) { return 'n = ' + bins[context.dataIndex].n; } } }
            }
        }
    });

    document.getElementById('directionTable').innerHTML =
        tableHead(['方向一致度', '成功 / n', '成功率', '95%信頼区間']) +
        '<tbody>' + bins.map(function (bin) {
            return '<tr><th scope="row">' + bin.label + '</th><td>' + bin.caught + ' / ' + bin.n +
                '</td><td>' + percent(bin.catchRate) + '</td><td>' + percent(bin.ci[0]) + '–' + percent(bin.ci[1]) + '</td></tr>';
        }).join('') + '</tbody>';

    const outcomes = ['caught', 'passed_ball', 'missed', 'wild_pitch'];
    const labels = ['正常捕球', 'パスボール', '捕球失敗', '暴投'];
    const counts = outcomes.map(function (outcome) {
        return rows.filter(function (row) { return row.catch_category === outcome; }).length;
    });
    if (outcomeChart) outcomeChart.destroy();
    outcomeChart = new Chart(document.getElementById('outcomeChart'), {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: counts, backgroundColor: [colors.blue, colors.amber, colors.red, colors.gray], borderWidth: 2 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '58%',
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: function (context) {
                    return context.label + ': ' + context.raw + '件（' + percent(rows.length ? context.raw / rows.length : null) + '）';
                } } }
            }
        }
    });
}

function renderGroupTable(target, groups) {
    document.getElementById(target).innerHTML =
        tableHead(['条件', '成功 / n', '成功率', '95%信頼区間', '方向一致度', '残差誤差']) +
        '<tbody>' + groups.map(function (group) {
            return '<tr><th scope="row">' + group.label + '</th><td>' + group.caught + ' / ' + group.n +
                '</td><td>' + percent(group.catch_rate) + '</td><td>' + percent(group.catch_rate_ci95[0]) + '–' +
                percent(group.catch_rate_ci95[1]) + '</td><td>' + fmt(group.median_direction_cosine_3d, 3) +
                '</td><td>' + fmt(group.mean_residual_error_3d_cm, 1) + ' cm</td></tr>';
        }).join('') + '</tbody>';
}

function renderStaticSections() {
    const q = summary.quality;
    document.getElementById('rawCount').textContent = q.raw_n.toLocaleString('ja-JP');
    document.getElementById('eligibleCount').textContent = q.eligible_n.toLocaleString('ja-JP');
    document.getElementById('directionAuc').textContent = fmt(summary.metric_validation.direction_cosine_3d.auc, 3);
    document.getElementById('overallCatchRate').textContent = percent(summary.overall.catch_rate);
    const validation = summary.metric_validation;
    const validationRows = [
        ['方向一致度', validation.direction_cosine_3d.caught_median, validation.direction_cosine_3d.failed_median, validation.direction_cosine_3d.auc, 3, '高いほど望ましい'],
        ['到達率', validation.projection_ratio_3d.caught_median, validation.projection_ratio_3d.failed_median, validation.projection_ratio_3d.auc, 3, '1に近いほど過不足が少ない'],
        ['残差誤差', validation.residual_error_3d_cm.caught_median, validation.residual_error_3d_cm.failed_median, validation.residual_error_3d_cm.auc, 1, '低いほど望ましい（cm）']
    ];
    document.getElementById('validationTable').innerHTML =
        tableHead(['指標', '成功時中央値', '失敗時中央値', 'AUC', '解釈']) +
        '<tbody>' + validationRows.map(function (row) {
            return '<tr><th scope="row">' + row[0] + '</th><td>' + fmt(row[1], row[4]) + '</td><td>' +
                fmt(row[2], row[4]) + '</td><td>' + fmt(row[3], 3) + '</td><td>' + row[5] + '</td></tr>';
        }).join('') + '</tbody>';
    const looDirection = summary.leave_one_player_out.map(function (row) { return row.direction_cosine_auc; });
    const looResidual = summary.leave_one_player_out.map(function (row) { return row.residual_error_auc; });
    document.getElementById('leaveOneOutNote').textContent =
        '1名ずつ除外する感度分析では，方向一致度AUCは' + fmt(Math.min.apply(null, looDirection), 3) + '–' +
        fmt(Math.max.apply(null, looDirection), 3) + '，残差誤差AUCは' + fmt(Math.min.apply(null, looResidual), 3) + '–' +
        fmt(Math.max.apply(null, looResidual), 3) + 'であり，単一プレイヤだけで生じた関係ではないことを確認した．';
    renderGroupTable('catchTable', summary.by_player);
    renderGroupTable('speedTable', summary.by_speed);

    const learning = summary.learning_terciles;
    if (learningChart) learningChart.destroy();
    learningChart = new Chart(document.getElementById('learningChart'), {
        type: 'line',
        data: {
            labels: ['前半区間', '中間区間', '後半区間'],
            datasets: [{
                label: '捕球成功率', data: learning.map(function (row) { return row.catch_rate * 100; }),
                borderColor: colors.blue, backgroundColor: colors.pale,
                pointBackgroundColor: colors.blue, pointRadius: 5, tension: .2, fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { min: 0, max: 100, title: { display: true, text: '捕球成功率 [%]' } } },
            plugins: { legend: { display: false } }
        }
    });
    document.getElementById('learningTable').innerHTML =
        tableHead(['区間', '成功 / n', '成功率', '95%信頼区間', '方向一致度中央値', '平均残差誤差']) +
        '<tbody>' + learning.map(function (row, index) {
            return '<tr><th scope="row">' + ['前半', '中間', '後半'][index] + '</th><td>' + row.caught + ' / ' + row.n +
                '</td><td>' + percent(row.catch_rate) + '</td><td>' + percent(row.catch_rate_ci95[0]) + '–' +
                percent(row.catch_rate_ci95[1]) + '</td><td>' + fmt(row.median_direction_cosine_3d, 3) +
                '</td><td>' + fmt(row.mean_residual_error_3d_cm, 1) + ' cm</td></tr>';
        }).join('') + '</tbody>';

    const diversity = summary.phase3_diversity;
    document.getElementById('diversityTable').innerHTML =
        tableHead(['プレイヤ', '投球数', '球種数', '正規化エントロピー', 'コース数', '同一球種反復率']) +
        '<tbody>' + diversity.participants.map(function (row) {
            return '<tr><th scope="row">' + row.player + '</th><td>' + row.n + '</td><td>' + row.unique_pitch_types +
                '</td><td>' + fmt(row.normalized_pitch_entropy, 3) + '</td><td>' + row.unique_courses +
                '</td><td>' + percent(row.same_pitch_repeat_rate) + '</td></tr>';
        }).join('') + '</tbody>';
    document.getElementById('pitchTypeCount').textContent = diversity.unique_pitch_types;
    document.getElementById('pitchCatalog').innerHTML = diversity.pitch_catalog.map(function (row) {
        return '<span>' + row.pitch_type + '<small>' + row.n + '</small></span>';
    }).join('');
    document.getElementById('implementedPitchTypeCount').textContent = diversity.implemented_unique_pitch_types;
    document.getElementById('implementedPitchCatalog').innerHTML = diversity.implemented_pitch_catalog.map(function (row) {
        return '<span>' + row.pitch_type + '<small>' + row.n + '</small></span>';
    }).join('');

    document.getElementById('qualityRaw').textContent = q.raw_n.toLocaleString('ja-JP');
    document.getElementById('qualityExcluded').textContent = q.excluded_n.toLocaleString('ja-JP');
    document.getElementById('qualityEligible').textContent = q.eligible_n.toLocaleString('ja-JP');
    document.getElementById('qualityTable').innerHTML =
        tableHead(['プレイヤ', '元ログ', '再分析対象', '25 cm超', '50 cm超・除外']) +
        '<tbody>' + q.by_player.map(function (row) {
            return '<tr><th scope="row">' + row.player + '</th><td>' + row.raw_n + '</td><td>' + row.eligible_n +
                '</td><td>' + row.outside_designed_noise_n + '</td><td>' + row.extreme_coordinate_anomaly_n + '</td></tr>';
        }).join('') + '</tbody>';
    document.getElementById('movementCheck').textContent =
        '構え位置と捕球位置から再計算した3次元移動量は，ログのMitt_Movement_Distanceと平均絶対差' +
        fmt(q.logged_movement_mean_abs_difference_cm, 3) + ' cm，最大差' +
        fmt(q.logged_movement_max_abs_difference_cm, 3) + ' cmで一致した．';
    document.getElementById('paperMetricCheck').textContent =
        '予稿はミット補正量を「捕球位置−構え位置」と定義し，平均12.9 cm・中央値11.6 cmと報告する．' +
        '公開CSVの再分析対象では，同式のミット移動量が平均' + fmt(summary.overall.mean_mitt_movement_3d_cm, 1) +
        ' cm・中央値' + fmt(summary.overall.median_mitt_movement_3d_cm, 1) +
        ' cmである一方，残差誤差が平均' + fmt(summary.overall.mean_residual_error_3d_cm, 2) +
        ' cm・中央値' + fmt(summary.overall.median_residual_error_3d_cm, 2) +
        ' cmで掲載値とほぼ一致する．指標名・数式と集計値の対応に再現上の不整合があるため，掲載値は改変せず区別して示す．';
}

async function initialize() {
    try {
        const responses = await Promise.all([fetch('data/public/data.json'), fetch('data/public/analysis-summary.json')]);
        if (!responses[0].ok || !responses[1].ok) throw new Error('公開データを取得できませんでした．');
        const payloads = await Promise.all([responses[0].json(), responses[1].json()]);
        records = payloads[0];
        summary = payloads[1];
        const players = Array.from(new Set(records.map(function (row) { return row.player; }))).sort(function (a, b) {
            return Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, ''));
        });
        const speeds = Array.from(new Set(records.map(function (row) { return row.speed; }))).sort(function (a, b) {
            return Number(a) - Number(b);
        });
        document.getElementById('researchPlayer').insertAdjacentHTML('beforeend', players.map(function (value) {
            return '<option value="' + value + '">' + value + '</option>';
        }).join(''));
        document.getElementById('researchSpeed').insertAdjacentHTML('beforeend', speeds.map(function (value) {
            return '<option value="' + value + '">' + value + '</option>';
        }).join(''));
        ['researchPlayer', 'researchSpeed', 'includeFlagged'].forEach(function (id) {
            document.getElementById(id).addEventListener('change', renderDirection);
        });
        renderStaticSections();
        renderDirection();
    } catch (error) {
        document.getElementById('filterSummary').textContent = 'データ読込エラー：' + error.message;
    }
}

initialize();
