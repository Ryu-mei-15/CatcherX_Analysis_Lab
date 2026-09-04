# 発表別フォルダ

発表・投稿・研究室内発表ごとに1フォルダを作成します．フォルダ名はURLとして使える英小文字・数字・ハイフンを基本とします．

各フォルダには，最低限`index.html`と`README.md`を置きます．データや資料がある場合は，EC2026と同じ考え方で次のサブフォルダを追加します．

```text
<event>/
├── index.html        # 発表の入口
├── README.md         # 発表固有の管理メモ
├── data/
│   ├── raw/          # 変換前ログ
│   └── public/       # Webから公開するJSON等
├── materials/        # 論文・スライド・ポスター・動画
├── analysis/         # 変換・検証・統計解析スクリプト
├── js/               # その発表ページ専用のJavaScript
├── backend/          # GAS等の外部バックエンド実装
└── docs/             # 運用手順書
```

トップページへ表示する名称・状態・リンクは`assets/js/events-data.js`で管理します．未確定の発表は`planned`，発表済みで資料整理中なら`archived`，公開資料が揃ったら`published`を使用します．
