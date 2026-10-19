'use strict';

window.catcherXEvents = Object.freeze([
    {
        id: 'wiss-2026',
        path: 'events/wiss-2026/',
        year: '2026',
        shortTitle: 'WISS 2026',
        title: 'WISS 2026 デモ発表',
        subtitle: 'CatcherX: 捕球に続く送球による進塁阻止を扱うVR捕手システム',
        type: 'accepted',
        status: 'デモ発表採択済み',
        stage: 'WISS 2026 デモ発表',
        description: '走者と内野手を導入し，捕球後の持ち替え・送球から内野手の捕球・タッチ，走者到達に基づくアウト／セーフ判定までを実装しました．',
        note: 'デモ発表として採択済みです．WISS 2026の区分では審査あり・論文査読なしに該当します．個別の発表日時は確定後に反映します．',
        links: [
            { href: '#interaction', label: '進塁阻止の体験', detail: '走者の開始からアウト／セーフまで', group: '研究概要' },
            { href: '#assist', label: '送球アシスト', detail: '方向意図と三次元誤差を残す設計', group: '実装概要' },
            { href: '#future', label: '未来ビジョン', detail: '捕手視点のプレイ・ラボへの発展', group: '今後の展望' },
            { href: 'paper.html', label: '投稿予稿', detail: 'WISS 2026投稿版・3ページ', group: '発表資料' }
        ]
    },
    {
        id: 'ec-2026',
        path: 'events/ec2026/',
        year: '2026',
        shortTitle: 'EC2026',
        title: 'EC2026',
        subtitle: '捕手の認知-運動過程の循環に着目したVRシミュレータ',
        type: 'published',
        status: '発表済み・公開中',
        stage: '研究成果',
        description: '捕手の配球判断，構え，軌道知覚，身体的補正，捕球，結果評価，次配球の更新を一続きのVR体験として構成し，実験ログを分析しました．',
        note: '論文，スライド，ポスター，主要結果，捕球ログ，配球ログを公開しています．',
        links: [
            { href: 'summary.html', label: 'この研究でわかったこと', detail: '主要な知見と結論の限界', group: 'まず読む' },
            { href: 'results.html', label: '捕球動作の結果', detail: '制球誤差とミットの動き', group: '実験結果' },
            { href: 'phase3.html', label: '配球選択の結果', detail: '打者反応後の次球選択', group: '実験結果' },
            { href: 'analysis.html', label: '捕球ログを条件別に見る', detail: 'プレイヤ・球速・コースで絞り込み', group: 'データを詳しく見る' },
            { href: 'anova.html', label: 'プレイヤ・球速を比べる', detail: '二元配置分散分析と読み方', group: 'データを詳しく見る' },
            { href: 'research.html', label: 'ミットの動きとデータ品質', detail: '方向一致度，成功率，除外基準', group: 'データを詳しく見る' },
            { href: 'paper.html', label: '論文・発表資料', detail: '公開論文，スライド，ポスター', group: '発表資料' }
        ]
    },
    {
        id: 'interaction-2027',
        path: 'events/interaction-2027/',
        year: '2027',
        shortTitle: 'インタラクション2027',
        title: 'インタラクション2027',
        type: 'planned',
        status: '発表目標',
        stage: '今後の研究',
        description: 'CatcherXの次段階の成果発表を目指す記録枠です．研究計画，取得データ，投稿資料を進展に合わせて追加します．',
        note: '現時点では発表目標を記録しており，投稿・採択・発表は未確定です．',
        links: []
    },
    {
        id: 'winter-2025',
        path: 'events/winter-2025/',
        year: '2025年度',
        shortTitle: '冬季中間発表',
        title: '片寄研究室 2025年度冬季中間発表',
        type: 'archived',
        status: '発表済み・整理中',
        stage: '研究経過',
        description: '片寄研究室の冬季中間発表におけるCatcherXの研究記録を収める枠です．',
        note: '当時の資料とデータを確認後，公開可能な内容から順次追加します．',
        links: []
    },
    {
        id: 'ec-2025',
        path: 'events/ec2025/',
        year: '2025',
        shortTitle: 'EC2025',
        title: 'EC2025',
        type: 'archived',
        status: '発表済み・整理中',
        stage: '研究成果',
        description: 'EC2025におけるCatcherXの研究記録を収める枠です．',
        note: '当時の資料とデータを確認後，公開可能な内容から順次追加します．',
        links: []
    }
]);
