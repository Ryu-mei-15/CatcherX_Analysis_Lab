let logData = [];
let chartX = null;
let chartY = null;
let chartZ = null;
let pyodide = null;
let currentAnovaResults = null;
let currentActiveTab = 'axisX';

const speedColors = ['#004b87', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];

const courseMapping = [
    ['High Inside Ball', 'High Inside Center Ball', 'High Center Ball', 'High Outside Center Ball', 'High Outside Ball'],
    ['Mid-High Inside Ball', 'High Inside', 'High Center', 'High Outside', 'Mid-High Outside Ball'],
    ['Mid Inside Ball', 'Mid Inside', 'Mid Center', 'Mid Outside', 'Mid Outside Ball'],
    ['Mid-Low Inside Ball', 'Low Inside', 'Low Center', 'Low Outside', 'Mid-Low Outside Ball'],
    ['Low Inside Ball', 'Low Inside Center Ball', 'Low Center Ball', 'Low Outside Center Ball', 'Low Outside Ball']
];

const strikeZoneCourses = [
    'High Inside', 'High Center', 'High Outside',
    'Mid Inside', 'Mid Center', 'Mid Outside',
    'Low Inside', 'Low Center', 'Low Outside'
];

const staticInsights = {
    axisX: `
        <strong>解釈の補助</strong><br>
        X軸は左右方向の符号付き残差である．有意差の有無だけでなく，
        条件別平均が正方向・負方向のどちらへ偏るかを下のグラフで確認する．
    `,
    axisY: `
        <strong>解釈の補助</strong><br>
        Y軸は上下方向の符号付き残差である．交互作用が有意な場合は，
        球速による変化がプレイヤごとに異なるため，主効果だけで結論づけない．
    `,
    axisZ: `
        <strong>解釈の補助</strong><br>
        Z軸は奥行き方向の符号付き残差である．球到達面とミット中心の前後差を表すが，
        捕球タイミングそのものは記録していないため，時間誤差とは解釈しない．
    `
};

document.addEventListener('DOMContentLoaded', async () => {
    pyodide = await loadPyodide();
    await pyodide.loadPackage(['pandas', 'statsmodels']);

    document.getElementById('loading-overlay').style.display = 'none';

    logData = await fetchLogData();
    generateUI();
    setupActionButtons();

    const tabs = document.querySelectorAll('.anova-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');

            currentActiveTab = e.target.getAttribute('data-target');
            renderAnovaTab();
        });
    });

    await executeAnalysis();
});

async function fetchLogData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('データ取得に失敗しました．');
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

function generateUI() {
    const players = [...new Set(logData.map(d => String(d.player)))].sort();
    const speeds = [...new Set(logData.map(d => String(d.speed)))].sort((a, b) => Number(a) - Number(b));

    createCheckboxes('playerCheckboxes', 'player', players);
    createCheckboxes('speedCheckboxes', 'speed', speeds, formatSpeedLabel);

    const gridContainer = document.getElementById('courseGrid');

    courseMapping.flat().forEach(courseValue => {
        const label = document.createElement('label');
        label.className = 'sz-cell';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'course';
        checkbox.value = courseValue;
        checkbox.checked = true;
        checkbox.addEventListener('change', executeAnalysis);

        label.appendChild(checkbox);
        gridContainer.appendChild(label);
    });
}

function createCheckboxes(containerId, name, values, formatter = v => v) {
    const container = document.getElementById(containerId);

    values.forEach(val => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = val;
        checkbox.name = name;
        checkbox.checked = true;
        checkbox.addEventListener('change', executeAnalysis);

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(formatter(val)));
        container.appendChild(label);
    });
}

function setupActionButtons() {
    document.querySelectorAll('.select-all').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();

            const targetName = e.target.getAttribute('data-target');

            document.querySelectorAll(`input[name="${targetName}"]`).forEach(cb => {
                cb.checked = true;
            });

            await executeAnalysis();
        });
    });

    document.querySelectorAll('.deselect-all').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();

            const targetName = e.target.getAttribute('data-target');

            document.querySelectorAll(`input[name="${targetName}"]`).forEach(cb => {
                cb.checked = false;
            });

            await executeAnalysis();
        });
    });

    document.querySelectorAll('.select-strike-zone').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();

            document.querySelectorAll(`input[name="course"]`).forEach(cb => {
                cb.checked = strikeZoneCourses.includes(cb.value);
            });

            await executeAnalysis();
        });
    });
}

function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
}

function formatSpeedLabel(speed) {
    const text = String(speed);
    return text.includes('km') ? text : `${text} km/h`;
}

function getCourseSelectionText(selectedCourses, totalCourses) {
    const isStrikeZoneOnly =
        selectedCourses.length === strikeZoneCourses.length &&
        selectedCourses.every(c => strikeZoneCourses.includes(c));

    if (selectedCourses.length === totalCourses) return '全25コース';
    if (selectedCourses.length === 0) return 'なし';
    if (isStrikeZoneOnly) return 'ストライクゾーン（9マス）';

    return `${selectedCourses.length}コース`;
}

async function executeAnalysis() {
    const selectedPlayers = getCheckedValues('player');
    const selectedSpeeds = getCheckedValues('speed');
    const selectedCourses = getCheckedValues('course');
    const totalCourses = document.querySelectorAll('input[name="course"]').length;

    const courseText = getCourseSelectionText(selectedCourses, totalCourses);

    document.getElementById('filterStatus').textContent =
        `解析条件：プレイヤ ${selectedPlayers.length}名 ｜ 球速 ${selectedSpeeds.length}条件 ｜ コース ${courseText}`;

    renderComparisonCharts(selectedPlayers, selectedSpeeds, selectedCourses);

    if (selectedPlayers.length < 2 || selectedSpeeds.length < 2 || selectedCourses.length === 0) {
        currentAnovaResults = {
            error: '二元配置分散分析を行うには，プレイヤと球速をそれぞれ2条件以上選択してください．'
        };
        renderAnovaTab();
        return;
    }

    const filteredForPython = [];

    logData.forEach(d => {
        if (
            selectedPlayers.includes(String(d.player)) &&
            selectedSpeeds.includes(String(d.speed)) &&
            selectedCourses.includes(String(d.course)) &&
            d.analysis_eligible !== false
        ) {
            filteredForPython.push({
                player: String(d.player),
                speed: String(d.speed),
                diff_x: d.residual_x_cm ?? (d.mitt_x - d.impact_x) * 100,
                diff_y: d.residual_y_cm ?? (d.mitt_y - d.impact_y) * 100,
                diff_z: d.residual_z_cm ?? (d.mitt_z - d.impact_z) * 100
            });
        }
    });

    document.getElementById('filterStatus').textContent += ` ｜ 解析対象 n = ${filteredForPython.length}`;

    window.anovaDataForPython = filteredForPython;

    const pythonCode = `
import js
import pandas as pd
import statsmodels.api as sm
from statsmodels.formula.api import ols
import json

output_json = ""

try:
    data = js.anovaDataForPython.to_py()
    df = pd.DataFrame(data)

    results = {}
    axes = {'axisX': 'diff_x', 'axisY': 'diff_y', 'axisZ': 'diff_z'}

    for js_key, col in axes.items():
        model = ols(f"{col} ~ C(player) + C(speed) + C(player):C(speed)", data=df).fit()
        aov = sm.stats.anova_lm(model, typ=2)

        def extract(row_name):
            ss_effect = float(aov.loc[row_name, 'sum_sq'])
            ss_residual = float(aov.loc['Residual', 'sum_sq'])
            return {
                'F': float(aov.loc[row_name, 'F']),
                'p': float(aov.loc[row_name, 'PR(>F)']),
                'df1': int(aov.loc[row_name, 'df']),
                'df2': int(aov.loc['Residual', 'df']),
                'partial_eta_squared': ss_effect / (ss_effect + ss_residual)
            }

        results[js_key] = {
            'player': extract('C(player)'),
            'speed': extract('C(speed)'),
            'interaction': extract('C(player):C(speed)')
        }

    output_json = json.dumps(results)

except Exception as e:
    output_json = json.dumps({"error": str(e)})

output_json
`;

    try {
        const resultJson = await pyodide.runPythonAsync(pythonCode);
        currentAnovaResults = JSON.parse(resultJson);
    } catch (e) {
        currentAnovaResults = {
            error: '統計解析の実行中にエラーが発生しました：' + e.message
        };
    }

    renderAnovaTab();
}

function formatPValue(p) {
    if (p <= 0) {
        return 'p < 1 \\times 10^{-300}';
    }

    if (p < 0.001) {
        const exponent = Math.floor(Math.log10(p));
        const mantissa = (p / Math.pow(10, exponent)).toFixed(2);
        return `p = ${mantissa} \\times 10^{${exponent}}`;
    }

    return `p = ${p.toFixed(3)}`;
}

function evaluateSignificance(p) {
    if (p < 0.001) {
        return { class: 'sig-high', text: '有意差あり（p < .001）' };
    }

    if (p < 0.05) {
        return { class: 'sig-yes', text: '有意差あり（p < .05）' };
    }

    if (p < 0.1) {
        return { class: 'sig-trend', text: '有意傾向（p < .10）' };
    }

    return { class: 'sig-no', text: '有意差なし' };
}

function renderAnovaTab() {
    const container = document.getElementById('anovaContent');

    if (!currentAnovaResults) return;

    if (currentAnovaResults.error) {
        container.innerHTML = `
            <div class="result-card">
                <h3 style="color:#e74c3c;">解析条件を確認してください</h3>
                <p>${currentAnovaResults.error}</p>
            </div>
        `;
        return;
    }

    const data = currentAnovaResults[currentActiveTab];

    const titles = {
        axisX: 'X軸方向の残差誤差に対する二元配置分散分析',
        axisY: 'Y軸方向の残差誤差に対する二元配置分散分析',
        axisZ: 'Z軸方向の残差誤差に対する二元配置分散分析'
    };

    const buildStatBox = (label, stat) => {
        if (!stat || isNaN(stat.F)) {
            return `
                <div class="stat-box">
                    <h4>${label}</h4>
                    <p>データ不足</p>
                </div>
            `;
        }

        const sig = evaluateSignificance(stat.p);
        const mathStr = `\\(F(${stat.df1}, ${stat.df2}) = ${stat.F.toFixed(2)}, ${formatPValue(stat.p)}, \\eta_p^2 = ${stat.partial_eta_squared.toFixed(3)}\\)`;

        return `
            <div class="stat-box">
                <h4>${label}</h4>
                <div class="math">${mathStr}</div>
                <span class="significance ${sig.class}">${sig.text}</span>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="result-card">
            <h3>${titles[currentActiveTab]}</h3>
            <div class="stat-grid">
                ${buildStatBox('プレイヤの主効果', data.player)}
                ${buildStatBox('球速の主効果', data.speed)}
                ${buildStatBox('プレイヤ × 球速の交互作用', data.interaction)}
            </div>
            <div class="insight-box">
                ${staticInsights[currentActiveTab]}
            </div>
        </div>
    `;

    if (window.MathJax) {
        MathJax.typesetPromise([container]).catch((err) => console.log(err.message));
    }
}

function getMean(array) {
    if (array.length === 0) return null;
    return array.reduce((a, b) => a + b, 0) / array.length;
}

function renderComparisonCharts(selectedPlayers, selectedSpeeds, selectedCourses) {
    const datasetsX = [];
    const datasetsY = [];
    const datasetsZ = [];

    selectedSpeeds.forEach((speed, i) => {
        const dataX = [];
        const dataY = [];
        const dataZ = [];
        const color = speedColors[i % speedColors.length];

        selectedPlayers.forEach(player => {
            const filtered = logData.filter(d =>
                String(d.player) === String(player) &&
                String(d.speed) === String(speed) &&
                selectedCourses.includes(String(d.course)) &&
                d.analysis_eligible !== false
            );

            dataX.push(getMean(filtered.map(d => d.residual_x_cm ?? (d.mitt_x - d.impact_x) * 100)));
            dataY.push(getMean(filtered.map(d => d.residual_y_cm ?? (d.mitt_y - d.impact_y) * 100)));
            dataZ.push(getMean(filtered.map(d => d.residual_z_cm ?? (d.mitt_z - d.impact_z) * 100)));
        });

        const baseDataset = {
            label: formatSpeedLabel(speed),
            backgroundColor: color,
            borderWidth: 1
        };

        datasetsX.push({ ...baseDataset, data: dataX });
        datasetsY.push({ ...baseDataset, data: dataY });
        datasetsZ.push({ ...baseDataset, data: dataZ });
    });

    drawBarChart(
        'meanChartX',
        selectedPlayers,
        datasetsX,
        '平均誤差 [cm]（左 − / 右 +）',
        chartX,
        (c) => chartX = c
    );

    drawBarChart(
        'meanChartY',
        selectedPlayers,
        datasetsY,
        '平均誤差 [cm]（下 − / 上 +）',
        chartY,
        (c) => chartY = c
    );

    drawBarChart(
        'meanChartZ',
        selectedPlayers,
        datasetsZ,
        '平均誤差 [cm]（後方 − / 前方 +）',
        chartZ,
        (c) => chartZ = c
    );
}

function drawBarChart(canvasId, labels, datasets, yLabel, chartInstance, setChartInstance) {
    if (chartInstance) chartInstance.destroy();

    const ctx = document.getElementById(canvasId).getContext('2d');

    const newChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const value = ctx.raw !== null ? ctx.raw.toFixed(1) : 'N/A';
                            return `${ctx.dataset.label}: ${value} cm`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: yLabel
                    },
                    grid: {
                        color: '#eee',
                        drawBorder: true
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'プレイヤ'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    setChartInstance(newChart);
}
