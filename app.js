// グローバル変数でチャートのインスタンスと生データを保持
let pitchChart = null;
let logData = [];

// ページ読み込み時に初期化処理を実行
document.addEventListener('DOMContentLoaded', async () => {
    // 1. 外部JSONファイルからログデータを取得
    logData = await fetchLogData();

    // 2. セレクトボックスの変更イベントを設定
    const filters = ['userSelect', 'pitchSelect', 'courseSelect'];
    filters.forEach(id => {
        document.getElementById(id).addEventListener('change', renderChart);
    });

    // 3. 初回のグラフ描画
    renderChart();
});

/**
 * 外部のdata.jsonからデータを非同期取得する関数
 */
async function fetchLogData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error('データの取得に失敗しました．');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        // フォールバック用の最小限のダミーデータ
        return [
            { id: 1, user: 'userA', pitch: 'fastball', course: 'inside', x: -0.4, y: 1.1, success: true }
        ];
    }
}

/**
 * フィルター条件に基づいてデータを抽出し，グラフを再描画する関数
 */
function renderChart() {
    const userFilter = document.getElementById('userSelect').value;
    const pitchFilter = document.getElementById('pitchSelect').value;
    const courseFilter = document.getElementById('courseSelect').value;

    // データのフィルタリング処理
    const filteredData = logData.filter(d => {
        return (userFilter === 'all' || d.user === userFilter) &&
               (pitchFilter === 'all' || d.pitch === pitchFilter) &&
               (courseFilter === 'all' || d.course === courseFilter);
    });

    // フレーミングの結果（成功/失敗）に応じてデータセットを分離
    const successData = filteredData.filter(d => d.success).map(d => ({ x: d.x, y: d.y }));
    const failData = filteredData.filter(d => !d.success).map(d => ({ x: d.x, y: d.y }));

    const ctx = document.getElementById('pitchChart').getContext('2d');
    
    // 既存のチャートが存在する場合は破棄してメモリを解放（描画バグ防止）
    if (pitchChart) {
        pitchChart.destroy();
    }

    // CSSからテーマカラーの値を動的に取得（色の一元管理のため）
    const style = getComputedStyle(document.documentElement);
    const primaryColor = style.getPropertyValue('--primary-color').trim();
    const accentColor = style.getPropertyValue('--accent-color').trim();

    // 散布図の生成
    pitchChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'フレーミング成功',
                    data: successData,
                    backgroundColor: primaryColor,
                    pointRadius: 6
                },
                {
                    label: 'フレーミング失敗',
                    data: failData,
                    backgroundColor: accentColor,
                    pointRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: '水平座標 (m)' },
                    min: -1.5, max: 1.5
                },
                y: {
                    title: { display: true, text: '垂直座標 (m)' },
                    min: 0, max: 2.0
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}