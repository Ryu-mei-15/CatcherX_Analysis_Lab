let chartXY = null;
let chartZY = null;
let chartCourseXY = null;
let chartCourseZY = null;
let logData = [];

const colorPalette = [
    '#004b87', '#e74c3c', '#2ecc71', '#f39c12', 
    '#9b59b6', '#34495e', '#1abc9c', '#d35400'
];

const courseMapping = [
    ['High Inside Ball', 'High Inside Center Ball', 'High Center Ball', 'High Outside Center Ball', 'High Outside Ball'],
    ['Mid-High Inside Ball', 'High Inside', 'High Center', 'High Outside', 'Mid-High Outside Ball'],
    ['Mid Inside Ball', 'Mid Inside', 'Mid Center', 'Mid Outside', 'Mid Outside Ball'],
    ['Mid-Low Inside Ball', 'Low Inside', 'Low Center', 'Low Outside', 'Mid-Low Outside Ball'],
    ['Low Inside Ball', 'Low Inside Center Ball', 'Low Center Ball', 'Low Outside Center Ball', 'Low Outside Ball']
];

// --- 2つ目のグラフ用：投球コースを矢印のマーカーとして描画するプラグイン ---
const courseArrowPlugin = {
    id: 'courseArrowPlugin',
    afterDatasetsDraw(chart) {
        if (!chart.canvas.id.includes('Course')) return;

        const ctx = chart.ctx;
        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            if (meta.hidden) return;

            meta.data.forEach((element, index) => {
                const raw = dataset.data[index];
                if (!raw) return;

                const x = element.x;
                const y = element.y;
                const course = raw._course;
                const isStrike = raw._rawResult.includes('Strike');
                const color = dataset.borderColor;

                let yDir = 0, xDir = 0;
                if (course.includes('High')) yDir = -1;
                if (course.includes('Low')) yDir = 1;
                if (course.includes('Inside')) xDir = -1;
                if (course.includes('Outside')) xDir = 1;

                ctx.save();
                ctx.translate(x, y);

                if (yDir === 0 && xDir === 0) {
                    ctx.beginPath();
                    ctx.arc(0, 0, 5, 0, 2 * Math.PI);
                    if (isStrike) {
                        ctx.fillStyle = color;
                        ctx.fill();
                    } else {
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                } else {
                    const angle = Math.atan2(yDir, xDir);
                    ctx.rotate(angle);
                    
                    const size = 6;
                    ctx.beginPath();
                    if (isStrike) {
                        ctx.moveTo(-size, -size * 0.6);
                        ctx.lineTo(0, -size * 0.6);
                        ctx.lineTo(0, -size * 1.3);
                        ctx.lineTo(size * 1.3, 0);
                        ctx.lineTo(0, size * 1.3);
                        ctx.lineTo(0, size * 0.6);
                        ctx.lineTo(-size, size * 0.6);
                        ctx.closePath();
                        ctx.fillStyle = color;
                        ctx.fill();
                    } else {
                        ctx.moveTo(-size, 0);
                        ctx.lineTo(size, 0);
                        ctx.moveTo(size/2, -size/2);
                        ctx.lineTo(size, 0);
                        ctx.lineTo(size/2, size/2);
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                }
                ctx.restore();
            });
        });
    }
};

Chart.register(courseArrowPlugin);

document.addEventListener('DOMContentLoaded', async () => {
    logData = await fetchLogData();
    generateUI();
    setupActionButtons();
    renderChart();
});

async function fetchLogData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('データ取得失敗');
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
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
        checkbox.addEventListener('change', renderChart);
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
        checkbox.addEventListener('change', renderChart);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(val));
        container.appendChild(label);
    });
}

// --- 全選択・全解除ボタンのロジック ---
function setupActionButtons() {
    document.querySelectorAll('.select-all').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetName = e.target.getAttribute('data-target');
            document.querySelectorAll(`input[name="${targetName}"]`).forEach(cb => {
                cb.checked = true;
            });
            renderChart();
        });
    });

    document.querySelectorAll('.deselect-all').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetName = e.target.getAttribute('data-target');
            document.querySelectorAll(`input[name="${targetName}"]`).forEach(cb => {
                cb.checked = false;
            });
            renderChart();
        });
    });
}

function getCheckedValues(name) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
}

// ★ クリッピング範囲も cm 単位 (38) に変更
function clip(val, limit = 38) {
    return Math.max(-limit, Math.min(limit, val));
}

function categorizeCatch(res) {
    if (res.includes('WildPitch')) return 'WildPitch';
    if (res.includes('PassedBall')) return 'PassedBall';
    if (res.includes('Missed')) return 'Ignored';
    return 'Perfect';
}

function renderChart() {
    const selectedPlayers = getCheckedValues('player');
    const selectedSpeeds = getCheckedValues('speed');
    const selectedCourses = getCheckedValues('course');

    // --- 抽出条件テキストの生成と表示 ---
    const totalPlayers = document.querySelectorAll('input[name="player"]').length;
    const totalSpeeds = document.querySelectorAll('input[name="speed"]').length;
    const totalCourses = document.querySelectorAll('input[name="course"]').length;

    const pText = selectedPlayers.length === totalPlayers ? '全プレイヤー' : (selectedPlayers.length === 0 ? 'なし' : selectedPlayers.join(', '));
    const sText = selectedSpeeds.length === totalSpeeds ? '全球速' : (selectedSpeeds.length === 0 ? 'なし' : selectedSpeeds.join(', '));
    const cText = selectedCourses.length === totalCourses ? '全25コース' : (selectedCourses.length === 0 ? 'なし' : selectedCourses.join(', '));

    const statusText = `表示対象: ${pText} ｜ ${sText} ｜ ${cText}`;
    
    const status1 = document.getElementById('filterStatus1');
    const status2 = document.getElementById('filterStatus2');
    if (status1) status1.textContent = statusText;
    if (status2) status2.textContent = statusText;

    const datasetsXY = [];
    const datasetsZY = [];
    const datasetsCourseXY = [];
    const datasetsCourseZY = [];

    selectedPlayers.forEach((playerName, index) => {
        const playerColor = colorPalette[index % colorPalette.length];
        const playerData = logData.filter(d => 
            d.player === playerName && selectedSpeeds.includes(d.speed) && selectedCourses.includes(d.course)
        );

        if (playerData.length === 0) return;

        const points1 = []; 
        const points2 = []; 

        playerData.forEach(d => {
            // ★ m から cm への変換 (100倍)
            const diffX = clip((d.mitt_x - d.target_x) * 100);
            const diffY = clip((d.mitt_y - d.target_y) * 100);
            const diffZ = clip((d.mitt_z - d.target_z) * 100);
            
            const category = categorizeCatch(d.catch_result);
            
            let styleResult = 'circle';
            let radiusResult = 6;
            if (category === 'PassedBall') { styleResult = 'rect'; }
            if (category === 'WildPitch') { styleResult = 'crossRot'; radiusResult = 8; }
            if (category === 'Ignored') { styleResult = 'triangle'; radiusResult = 7; }

            const baseInfo = {
                y: diffY,
                _category: category,
                _rawResult: d.catch_result,
                _course: d.course
            };

            points1.push({ x: diffX, diffZ: diffZ, _pointStyle: styleResult, _radius: radiusResult, ...baseInfo });
            points2.push({ x: diffX, diffZ: diffZ, ...baseInfo });
        });

        const config1 = {
            label: playerName,
            backgroundColor: playerColor,
            borderColor: playerColor,
            borderWidth: 2,
            pointStyle: (ctx) => ctx.raw ? ctx.raw._pointStyle : 'circle',
            pointRadius: (ctx) => ctx.raw ? ctx.raw._radius : 6,
        };

        const config2 = {
            label: playerName,
            backgroundColor: playerColor,
            borderColor: playerColor,
            pointRadius: 0, 
            hitRadius: 6    
        };

        datasetsXY.push({ ...config1, data: points1.map(p => ({ ...p, x: p.x, y: p.y })) });
        datasetsZY.push({ ...config1, data: points1.map(p => ({ ...p, x: p.diffZ, y: p.y })) });
        
        datasetsCourseXY.push({ ...config2, data: points2.map(p => ({ ...p, x: p.x, y: p.y })) });
        datasetsCourseZY.push({ ...config2, data: points2.map(p => ({ ...p, x: p.diffZ, y: p.y })) });
    });

    // ★ 軸ラベルを cm に変更
    drawChart('errorChartXY', datasetsXY, 'Mitt_Catch_X - Target_Pos_X [cm]', chartXY, (c) => chartXY = c);
    drawChart('errorChartZY', datasetsZY, 'Mitt_Catch_Z - Target_Pos_Z [cm]', chartZY, (c) => chartZY = c);
    drawChart('errorChartCourseXY', datasetsCourseXY, 'Mitt_Catch_X - Target_Pos_X [cm]', chartCourseXY, (c) => chartCourseXY = c);
    drawChart('errorChartCourseZY', datasetsCourseZY, 'Mitt_Catch_Z - Target_Pos_Z [cm]', chartCourseZY, (c) => chartCourseZY = c);
}

function drawChart(canvasId, datasets, xLabel, chartInstance, setChartInstance) {
    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById(canvasId).getContext('2d');

    const newChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                // ★ グラフの表示範囲を ±0.4 から ±40 (cm) に変更
                x: { title: { display: true, text: xLabel }, min: -40, max: 40, grid: { color: '#eee', drawBorder: true } },
                y: { title: { display: true, text: 'Mitt_Catch_Y - Target_Pos_Y [cm]' }, min: -40, max: 40, grid: { color: '#eee', drawBorder: true } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            // ★ ツールチップの表示も少数第1位 (例: 12.5) に変更
                            return `[${context.raw._course}] ${context.raw._rawResult} (${context.parsed.x.toFixed(1)}, ${context.parsed.y.toFixed(1)})`;
                        }
                    }
                }
            }
        }
    });
    setChartInstance(newChart);
}