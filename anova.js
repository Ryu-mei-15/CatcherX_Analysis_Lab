const anovaData = {
    axisX: {
        title: "X軸（水平方向）：スピードに影響されない「個人の癖」",
        stats: [
            { label: "被験者の主効果", math: "\\(F(2, 954) = 3.38, p = 0.035\\)", sigClass: "sig-yes", sigText: "有意差あり" },
            { label: "球速の主効果", math: "\\(F(2, 954) = 0.43, p = 0.652\\)", sigClass: "sig-no", sigText: "有意差なし" },
            { label: "交互作用", math: "\\(p = 0.362\\)", sigClass: "sig-no", sigText: "有意差なし" }
        ],
        insight: `X軸のズレ（巻き込みやフレーミング）は，球速が何km/hであろうと<strong>一切影響を受けません</strong>．しかし，被験者間では明確な有意差が出ています．これは「水平方向のミット操作は，外部環境（スピード）に乱されることのない，プレイヤ固有の極めて強固なバイアスである」という仮説を完璧に裏付けています．`
    },
    axisY: {
        title: "Y軸（垂直方向）：剛速球が引き起こす「トラッキングの死」",
        stats: [
            { label: "被験者の主効果", math: "\\(F(2, 954) = 2.56, p = 0.078\\)", sigClass: "sig-trend", sigText: "有意傾向" },
            { label: "球速の主効果", math: "\\(F(2, 954) = 24.46, p = 4.38 \\times 10^{-11}\\)", sigClass: "sig-high", sigText: "極めて強い有意差" },
            { label: "交互作用", math: "\\(F(4, 954) = 2.93, p = 0.020\\)", sigClass: "sig-yes", sigText: "有意差あり" }
        ],
        insight: `垂直方向の誤差は，被験者の違いよりも<strong>「球速」によって劇的に支配</strong>されています（\\(p\\)値がとんでもない桁数になっています）．100 km/hではほぼ 0（的の高さ）だった誤差が，158 km/hになると被験者全員がマイナス方向（下方向）へ大きくミットを落としています．<br><br>さらに交互作用が有意であるため，「スピードが上がったときに，誰がどれくらいトラッキングを崩壊させるか（下に落とすか）」には個人の熟練度が関わっていることも証明されました．`
    },
    axisZ: {
        title: "Z軸（奥行き方向）：「個人の戦術」と「時間的圧迫」の衝突",
        stats: [
            { label: "被験者の主効果", math: "\\(F(2, 954) = 84.11, p = 2.28 \\times 10^{-34}\\)", sigClass: "sig-high", sigText: "異常なほど強い有意差" },
            { label: "球速の主効果", math: "\\(F(2, 954) = 19.20, p = 6.71 \\times 10^{-9}\\)", sigClass: "sig-high", sigText: "極めて強い有意差" },
            { label: "交互作用", math: "\\(F(4, 954) = 2.23, p = 0.064\\)", sigClass: "sig-trend", sigText: "有意傾向" }
        ],
        insight: `Z軸（前後のズレ）は，本実験で<strong>最も面白い指標</strong>です．被験者の主効果の\\(p\\)値（\\(10^{-34}\\)）が示す通り，「前で迎え撃つか」「的で待つか」は被験者ごとに全く異なります．<br><br>しかし同時に，球速の主効果も極めて強力です．100 km/hから158 km/hへと時間的余裕が奪われるにつれて，ある者はさらに前に突撃し，ある者は反応できずに後ろへ差し込まれるという，<strong>「極限状態における三次元的な空間認識のバグ」</strong>がデータとして完全に炙り出されました．`
    }
};

let logData = [];
let chartX = null, chartY = null, chartZ = null;

const speedColors = ['#004b87', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6'];

const courseMapping = [
    ['High Inside Ball', 'High Inside Center Ball', 'High Center Ball', 'High Outside Center Ball', 'High Outside Ball'],
    ['Mid-High Inside Ball', 'High Inside', 'High Center', 'High Outside', 'Mid-High Outside Ball'],
    ['Mid Inside Ball', 'Mid Inside', 'Mid Center', 'Mid Outside', 'Mid Outside Ball'],
    ['Mid-Low Inside Ball', 'Low Inside', 'Low Center', 'Low Outside', 'Mid-Low Outside Ball'],
    ['Low Inside Ball', 'Low Inside Center Ball', 'Low Center Ball', 'Low Outside Center Ball', 'Low Outside Ball']
];

document.addEventListener('DOMContentLoaded', async () => {
    const tabs = document.querySelectorAll('.anova-tab');
    renderAnova('axisX');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            renderAnova(e.target.getAttribute('data-target'));
        });
    });

    logData = await fetchLogData();
    generateUI();
    setupActionButtons();
    renderComparisonCharts();
});

function renderAnova(key) {
    const data = anovaData[key];
    const container = document.getElementById('anovaContent');
    let statsHtml = data.stats.map(stat => `
        <div class="stat-box">
            <h4>${stat.label}</h4>
            <div class="math">${stat.math}</div>
            <span class="significance ${stat.sigClass}">${stat.sigText}</span>
        </div>
    `).join('');
    container.innerHTML = `
        <div class="result-card">
            <h3>${data.title}</h3>
            <div class="stat-grid">${statsHtml}</div>
            <div class="insight-box"><strong>【考察】</strong><br>${data.insight}</div>
        </div>
    `;
    if (window.MathJax) MathJax.typesetPromise([container]).catch((err) => console.log(err.message));
}

async function fetchLogData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('データ取得失敗');
        return await response.json();
    } catch (error) {
        console.error('Error:', error); return [];
    }
}

function generateUI() {
    const players = [...new Set(logData.map(d => d.player))].sort();
    const speeds = [...new Set(logData.map(d => d.speed))].sort();

    createCheckboxes('playerCheckboxes', 'player', players);
    createCheckboxes('speedCheckboxes', 'speed', speeds);

    const gridContainer = document.getElementById('courseGrid');
    courseMapping.flat().forEach(courseValue => {
        const label = document.createElement('label');
        label.className = 'sz-cell';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'course';
        checkbox.value = courseValue;
        checkbox.checked = true;
        checkbox.addEventListener('change', renderComparisonCharts);
        label.appendChild(checkbox);
        gridContainer.appendChild(label);
    });
}

function createCheckboxes(containerId, name, values) {
    const container = document.getElementById(containerId);
    values.forEach(val => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = val;
        checkbox.name = name;
        checkbox.checked = true;
        checkbox.addEventListener('change', renderComparisonCharts);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(val));
        container.appendChild(label);
    });
}

function setupActionButtons() {
    document.querySelectorAll('.select-all').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const t = e.target.getAttribute('data-target');
            document.querySelectorAll(`input[name="${t}"]`).forEach(cb => cb.checked = true);
            renderComparisonCharts();
        });
    });
    document.querySelectorAll('.deselect-all').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const t = e.target.getAttribute('data-target');
            document.querySelectorAll(`input[name="${t}"]`).forEach(cb => cb.checked = false);
            renderComparisonCharts();
        });
    });
}

function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
}

function getMean(array) {
    if (array.length === 0) return null;
    return array.reduce((a, b) => a + b, 0) / array.length;
}

function renderComparisonCharts() {
    const selectedPlayers = getCheckedValues('player');
    const selectedSpeeds = getCheckedValues('speed');
    const selectedCourses = getCheckedValues('course');

    const totalCourses = document.querySelectorAll('input[name="course"]').length;
    const cText = selectedCourses.length === totalCourses ? '全25コース' : (selectedCourses.length === 0 ? 'なし' : selectedCourses.join(', '));
    document.getElementById('filterStatus').textContent = `抽出コース: ${cText}`;

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
                d.player === player && d.speed === speed && selectedCourses.includes(d.course)
            );

            // 誤差をすべて cm に変換 (× 100)
            const diffsX = filtered.map(d => (d.mitt_x - d.target_x) * 100);
            const diffsY = filtered.map(d => (d.mitt_y - d.target_y) * 100);
            const diffsZ = filtered.map(d => (d.mitt_z - d.target_z) * 100);

            dataX.push(getMean(diffsX));
            dataY.push(getMean(diffsY));
            dataZ.push(getMean(diffsZ));
        });

        const baseDataset = { label: speed, backgroundColor: color, borderWidth: 1 };
        datasetsX.push({ ...baseDataset, data: dataX });
        datasetsY.push({ ...baseDataset, data: dataY });
        datasetsZ.push({ ...baseDataset, data: dataZ });
    });

    drawBarChart('meanChartX', selectedPlayers, datasetsX, '平均 水平誤差 [cm]', chartX, (c) => chartX = c);
    drawBarChart('meanChartY', selectedPlayers, datasetsY, '平均 垂直誤差 [cm]', chartY, (c) => chartY = c);
    drawBarChart('meanChartZ', selectedPlayers, datasetsZ, '平均 奥行誤差 [cm]', chartZ, (c) => chartZ = c);
}

function drawBarChart(canvasId, labels, datasets, yLabel, chartInstance, setChartInstance) {
    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById(canvasId).getContext('2d');

    const newChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: { 
                    callbacks: { 
                        // ツールチップの表示を cm に変更し、少数第1位で丸める
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw !== null ? ctx.raw.toFixed(1) : 'N/A'} cm` 
                    } 
                }
            },
            scales: {
                y: {
                    title: { display: true, text: yLabel },
                    grid: { color: '#eee', drawBorder: true }
                },
                x: {
                    title: { display: true, text: 'プレイヤー' },
                    grid: { display: false }
                }
            }
        }
    });
    setChartInstance(newChart);
}