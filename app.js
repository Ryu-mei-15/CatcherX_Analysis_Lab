let chartXY = null;
let chartZY = null;
let chartCourseXY = null;
let chartCourseZY = null;
let chartCorrection = null; 
let chartCorrelation = null; 
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

const strikeZoneCourses = [
    'High Inside', 'High Center', 'High Outside',
    'Mid Inside', 'Mid Center', 'Mid Outside',
    'Low Inside', 'Low Center', 'Low Outside'
];

const courseLabelMap = {
    'High Inside Ball': '高め内角ボール',
    'High Inside Center Ball': '高め内角寄りボール',
    'High Center Ball': '高め中央ボール',
    'High Outside Center Ball': '高め外角寄りボール',
    'High Outside Ball': '高め外角ボール',

    'Mid-High Inside Ball': '中高め内角ボール',
    'High Inside': '高め内角',
    'High Center': '高め中央',
    'High Outside': '高め外角',
    'Mid-High Outside Ball': '中高め外角ボール',

    'Mid Inside Ball': '中央内角ボール',
    'Mid Inside': '中央内角',
    'Mid Center': '中央',
    'Mid Outside': '中央外角',
    'Mid Outside Ball': '中央外角ボール',

    'Mid-Low Inside Ball': '中低め内角ボール',
    'Low Inside': '低め内角',
    'Low Center': '低め中央',
    'Low Outside': '低め外角',
    'Mid-Low Outside Ball': '中低め外角ボール',

    'Low Inside Ball': '低め内角ボール',
    'Low Inside Center Ball': '低め内角寄りボール',
    'Low Center Ball': '低め中央ボール',
    'Low Outside Center Ball': '低め外角寄りボール',
    'Low Outside Ball': '低め外角ボール'
};

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

                let yDir = 0;
                let xDir = 0;

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
                        ctx.moveTo(size / 2, -size / 2);
                        ctx.lineTo(size, 0);
                        ctx.lineTo(size / 2, size / 2);
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
        if (!response.ok) throw new Error('データ取得に失敗しました．');
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
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
        label.title = courseLabelMap[courseValue] || courseValue;

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
        checkbox.addEventListener('change', renderChart);

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(formatter(val)));
        container.appendChild(label);
    });
}

function setupActionButtons() {
    document.querySelectorAll('.select-all').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetName = e.target.getAttribute('data-target');

            document.querySelectorAll(`input[name="${targetName}"]`).forEach(cb => {
                cb.checked = true;
            });

            renderChart();
        });
    });

    document.querySelectorAll('.deselect-all').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetName = e.target.getAttribute('data-target');

            document.querySelectorAll(`input[name="${targetName}"]`).forEach(cb => {
                cb.checked = false;
            });

            renderChart();
        });
    });

    document.querySelectorAll('.select-strike-zone').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();

            document.querySelectorAll(`input[name="course"]`).forEach(cb => {
                cb.checked = strikeZoneCourses.includes(cb.value);
            });

            renderChart();
        });
    });
}

function getCheckedValues(name) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
}

function clip(val, limit = 38) {
    return Math.max(-limit, Math.min(limit, val));
}

function categorizeCatch(res) {
    if (res.includes('WildPitch')) return 'WildPitch';
    if (res.includes('PassedBall')) return 'PassedBall';
    if (res.includes('Missed')) return 'Ignored';
    return 'Perfect';
}

function formatSpeedLabel(speed) {
    const text = String(speed);
    return text.includes('km') ? text : `${text} km/h`;
}

function formatCourseLabel(course) {
    return courseLabelMap[course] || course;
}

function formatCatchResult(result) {
    if (result.includes('WildPitch')) return '暴投';
    if (result.includes('PassedBall')) return 'パスボール';
    if (result.includes('Missed')) return '見送り';
    if (result.includes('Perfect')) return '正常捕球';
    return result;
}

function formatJudgment(result) {
    if (result.includes('Strike')) return 'ストライク判定';
    if (result.includes('Ball')) return 'ボール判定';
    return '判定情報なし';
}

function formatSelectedItems(values, totalCount, allLabel, emptyLabel, formatter = v => v) {
    if (values.length === totalCount) return allLabel;
    if (values.length === 0) return emptyLabel;
    return values.map(formatter).join(', ');
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

function getMean(array) {
    if (array.length === 0) return null;
    return array.reduce((a, b) => a + b, 0) / array.length;
}

// ピアソン積率相関係数・最小二乗法の計算
function calculateCorrelation(points) {
    const n = points.length;
    if (n <= 1) return { r: 0, a: 0, b: 0, minX: 0, maxX: 0 };
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    let minX = Infinity, maxX = -Infinity;
    
    points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumX2 += p.x * p.x;
        sumY2 += p.y * p.y;
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
    });
    
    const meanX = sumX / n;
    const meanY = sumY / n;
    
    const numerator = sumXY - n * meanX * meanY;
    const denominatorX = sumX2 - n * meanX * meanX;
    const denominatorY = sumY2 - n * meanY * meanY;
    
    const r = (denominatorX * denominatorY === 0) ? 0 : numerator / Math.sqrt(denominatorX * denominatorY);
    const a = denominatorX === 0 ? 0 : numerator / denominatorX; // 傾き
    const b = meanY - a * meanX; // 切片
    
    return { r, a, b, minX, maxX };
}

function renderChart() {
    const selectedPlayers = getCheckedValues('player');
    const selectedSpeeds = getCheckedValues('speed');
    const selectedCourses = getCheckedValues('course');

    const totalPlayers = document.querySelectorAll('input[name="player"]').length;
    const totalSpeeds = document.querySelectorAll('input[name="speed"]').length;
    const totalCourses = document.querySelectorAll('input[name="course"]').length;

    const playerText = formatSelectedItems(selectedPlayers, totalPlayers, '全プレイヤ', 'なし');
    const speedText = formatSelectedItems(selectedSpeeds, totalSpeeds, '全球速', 'なし', formatSpeedLabel);
    const courseText = getCourseSelectionText(selectedCourses, totalCourses);

    const statusText = `表示条件：プレイヤ ${playerText} ｜ 球速 ${speedText} ｜ コース ${courseText}`;

    const status1 = document.getElementById('filterStatus1');
    const status2 = document.getElementById('filterStatus2');
    const status3 = document.getElementById('filterStatus3');
    const status4 = document.getElementById('filterStatus4');

    if (status1) status1.textContent = statusText;
    if (status2) status2.textContent = statusText;
    if (status3) status3.textContent = statusText;
    if (status4) status4.textContent = statusText;

    const datasetsXY = [];
    const datasetsZY = [];
    const datasetsCourseXY = [];
    const datasetsCourseZY = [];

    selectedPlayers.forEach((playerName, index) => {
        const playerColor = colorPalette[index % colorPalette.length];

        const playerData = logData.filter(d =>
            String(d.player) === String(playerName) &&
            selectedSpeeds.includes(String(d.speed)) &&
            selectedCourses.includes(String(d.course)) &&
            d.analysis_eligible !== false
        );

        if (playerData.length === 0) return;

        const pointsForCatchResult = [];
        const pointsForCourse = [];

        playerData.forEach(d => {
            const diffX = clip(d.residual_x_cm ?? (d.mitt_x - d.impact_x) * 100);
            const diffY = clip(d.residual_y_cm ?? (d.mitt_y - d.impact_y) * 100);
            const diffZ = clip(d.residual_z_cm ?? (d.mitt_z - d.impact_z) * 100);

            const category = categorizeCatch(d.catch_result);

            let styleResult = 'circle';
            let radiusResult = 6;

            if (category === 'PassedBall') {
                styleResult = 'rect';
            }

            if (category === 'WildPitch') {
                styleResult = 'crossRot';
                radiusResult = 8;
            }

            if (category === 'Ignored') {
                styleResult = 'triangle';
                radiusResult = 7;
            }

            const baseInfo = {
                y: diffY,
                _category: category,
                _rawResult: d.catch_result,
                _course: d.course,
                _speed: d.speed,
                _player: d.player
            };

            pointsForCatchResult.push({
                x: diffX,
                diffZ: diffZ,
                _pointStyle: styleResult,
                _radius: radiusResult,
                ...baseInfo
            });

            pointsForCourse.push({
                x: diffX,
                diffZ: diffZ,
                ...baseInfo
            });
        });

        const catchResultConfig = {
            label: playerName,
            backgroundColor: playerColor,
            borderColor: playerColor,
            borderWidth: 2,
            pointStyle: (ctx) => ctx.raw ? ctx.raw._pointStyle : 'circle',
            pointRadius: (ctx) => ctx.raw ? ctx.raw._radius : 6
        };

        const courseConfig = {
            label: playerName,
            backgroundColor: playerColor,
            borderColor: playerColor,
            pointRadius: 0,
            hitRadius: 6
        };

        datasetsXY.push({
            ...catchResultConfig,
            data: pointsForCatchResult.map(p => ({ ...p, x: p.x, y: p.y }))
        });

        datasetsZY.push({
            ...catchResultConfig,
            data: pointsForCatchResult.map(p => ({ ...p, x: p.diffZ, y: p.y }))
        });

        datasetsCourseXY.push({
            ...courseConfig,
            data: pointsForCourse.map(p => ({ ...p, x: p.x, y: p.y }))
        });

        datasetsCourseZY.push({
            ...courseConfig,
            data: pointsForCourse.map(p => ({ ...p, x: p.diffZ, y: p.y }))
        });
    });

    drawChart(
        'errorChartXY',
        datasetsXY,
        'X軸方向の残差誤差 [cm]（左 − / 右 +）',
        chartXY,
        (c) => chartXY = c
    );

    drawChart(
        'errorChartZY',
        datasetsZY,
        'Z軸方向の残差誤差 [cm]（後方 − / 前方 +）',
        chartZY,
        (c) => chartZY = c
    );

    drawChart(
        'errorChartCourseXY',
        datasetsCourseXY,
        'X軸方向の残差誤差 [cm]（左 − / 右 +）',
        chartCourseXY,
        (c) => chartCourseXY = c
    );

    drawChart(
        'errorChartCourseZY',
        datasetsCourseZY,
        'Z軸方向の残差誤差 [cm]（後方 − / 前方 +）',
        chartCourseZY,
        (c) => chartCourseZY = c
    );

    renderCorrectionChart(selectedPlayers, selectedSpeeds, selectedCourses);
    renderCorrelationChart(selectedPlayers, selectedSpeeds, selectedCourses);
}

function drawChart(canvasId, datasets, xLabel, chartInstance, setChartInstance) {
    if (chartInstance) chartInstance.destroy();

    const ctx = document.getElementById(canvasId).getContext('2d');

    const newChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel
                    },
                    min: -40,
                    max: 40,
                    grid: {
                        color: '#eee',
                        drawBorder: true
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Y軸方向の残差誤差 [cm]（下 − / 上 +）'
                    },
                    min: -40,
                    max: 40,
                    grid: {
                        color: '#eee',
                        drawBorder: true
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const raw = context[0].raw;
                            return `${raw._player} / ${formatSpeedLabel(raw._speed)}`;
                        },
                        label: function(context) {
                            const raw = context.raw;
                            const x = context.parsed.x.toFixed(1);
                            const y = context.parsed.y.toFixed(1);

                            return [
                                `投球コース：${formatCourseLabel(raw._course)}`,
                                `捕球結果：${formatCatchResult(raw._rawResult)}（${formatJudgment(raw._rawResult)}）`,
                                `表示座標：(${x}, ${y}) cm`
                            ];
                        }
                    }
                }
            }
        }
    });

    setChartInstance(newChart);
}

function renderCorrectionChart(selectedPlayers, selectedSpeeds, selectedCourses) {
    const targetCourses = selectedCourses.filter(c => strikeZoneCourses.includes(c));
    const datasets = [];

    selectedSpeeds.forEach((speed, i) => {
        const data = [];
        const color = colorPalette[i % colorPalette.length];

        selectedPlayers.forEach(player => {
            const filtered = logData.filter(d =>
                String(d.player) === String(player) &&
                String(d.speed) === String(speed) &&
                targetCourses.includes(String(d.course)) &&
                d.analysis_eligible !== false
            );

            const meanVal = getMean(filtered.map(d => {
                if (d.correction_2d_cm !== undefined) {
                    return d.correction_2d_cm;
                } else {
                    const diffX = (d.mitt_x - d.mitt_start_x) * 100;
                    const diffY = (d.mitt_y - d.mitt_start_y) * 100;
                    return Math.sqrt(diffX * diffX + diffY * diffY);
                }
            }));

            data.push(meanVal);
        });

        datasets.push({
            label: formatSpeedLabel(speed),
            backgroundColor: color,
            borderWidth: 1,
            data: data
        });
    });

    if (chartCorrection) chartCorrection.destroy();

    const ctx = document.getElementById('correctionChart').getContext('2d');
    chartCorrection = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: selectedPlayers,
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
                        text: '平均ミット補正量 [cm]'
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
}

function renderCorrelationChart(selectedPlayers, selectedSpeeds, selectedCourses) {
    const datasets = [];
    const allPoints = [];

    // プレイヤごとに散布図のデータセットを作成
    selectedPlayers.forEach((player, i) => {
        const color = colorPalette[i % colorPalette.length];
        
        const filtered = logData.filter(d =>
            String(d.player) === String(player) &&
            selectedSpeeds.includes(String(d.speed)) &&
            selectedCourses.includes(String(d.course)) &&
            d.analysis_eligible !== false
        );
        
        const points = [];
        filtered.forEach(d => {
            const err = d.control_error_2d_cm;
            const corr = d.correction_2d_cm;
            
            if (err !== undefined && corr !== undefined && !isNaN(err) && !isNaN(corr)) {
                // 制球誤差25cm以下、かつミット補正量40cm以下のデータを有効とする
                if (err <= 25.0 && corr <= 40.0) {
                    // 横軸(X)＝制球誤差、縦軸(Y)＝ミット補正量
                    points.push({ x: err, y: corr, _raw: d });
                }
            }
        });
        
        if (points.length > 0) {
            allPoints.push(...points);
            datasets.push({
                type: 'scatter',
                label: player,
                // 捕球結果に応じて色塗りを変更
                backgroundColor: function(context) {
                    const raw = context.raw;
                    if (!raw || !raw._raw) return color;
                    const cat = categorizeCatch(raw._raw.catch_result);
                    if (cat === 'Perfect') {
                        return color; // 成功時は塗りつぶし
                    } else {
                        return 'transparent'; // 失敗時は中抜き
                    }
                },
                borderColor: color,
                borderWidth: 2,
                data: points,
                pointRadius: 5,
                pointHoverRadius: 7
            });
        }
    });

    const stats = calculateCorrelation(allPoints);
    const status4 = document.getElementById('filterStatus4');
    if (status4) status4.textContent += ` ｜ 解析対象 n = ${allPoints.length}`;

    if (allPoints.length > 1 && stats.maxX > stats.minX) {
        // 回帰直線を描画（X軸の最大・最小に合わせて引く）
        const margin = (stats.maxX - stats.minX) * 0.05;
        const lineMinX = Math.max(0, stats.minX - margin); 
        const lineMaxX = Math.min(25, stats.maxX + margin); // X軸の最大値25に合わせる

        datasets.push({
            type: 'line',
            label: `全体回帰直線 (r = ${stats.r.toFixed(3)})`,
            data: [
                { x: lineMinX, y: stats.a * lineMinX + stats.b },
                { x: lineMaxX, y: stats.a * lineMaxX + stats.b }
            ],
            borderColor: 'rgba(44, 62, 80, 0.8)', 
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0 
        });
    }

    if (chartCorrelation) chartCorrelation.destroy();

    const ctx = document.getElementById('correlationChart').getContext('2d');
    chartCorrelation = new Chart(ctx, {
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.type === 'line') {
                                return `回帰直線: y = ${stats.a.toFixed(2)}x + ${stats.b.toFixed(2)}`;
                            }
                            const raw = context.raw._raw;
                            const cat = categorizeCatch(raw.catch_result);
                            const resultText = cat === 'Perfect' ? '成功' : '失敗';
                            return `${raw.player} (${formatSpeedLabel(raw.speed)}): 制球誤差 ${context.parsed.x.toFixed(1)}cm, 補正量 ${context.parsed.y.toFixed(1)}cm [${resultText}]`;
                        }
                    }
                }
            },
            scales: {
                // X軸は25、Y軸は40とし、目盛りを5刻みに固定して完全な正方形グリッドを作る
                x: {
                    title: { display: true, text: '制球誤差 [cm]' },
                    min: 0, 
                    max: 26, 
                    ticks: { stepSize: 5 }, // 5cm刻みに固定
                    grid: { color: '#eee', drawBorder: true }
                },
                y: {
                    title: { display: true, text: 'ミット補正量 [cm]' },
                    min: 0, 
                    max: 40, 
                    ticks: { stepSize: 5 }, // 5cm刻みに固定
                    grid: { color: '#eee', drawBorder: true }
                }
            }
        }
    });
}
