# CatcherX Research Data

CatcherX予稿の補足資料として，プレイログ，主要結果，統計解析，標準尺度評価を公開する静的サイトです．

## 起動

```sh
python3 -m http.server 8000
```

<http://localhost:8000>

## ページ

- `index.html`：研究概要
- `paper.html`：EC2026投稿予稿のブラウザ内閲覧
- `results.html`：予稿掲載の主要結果
- `phase3.html`：第3フェーズの配球更新行動と有意差分析
- `analysis.html`：プレイログ可視化
- `anova.html`：二元配置分散分析
- `evaluation.html`：NASA-TLX・SUS回答と条件間比較

予稿PDFは`paper/ec2026.pdf`に配置しています．閲覧ページではPDFビューアのツールバーと直接ダウンロード導線を表示しませんが，Web配信されるファイルの保存や画面撮影を完全に防ぐことはできません．

第3フェーズの公開用データは`python3 convert_phase3.py`で`DataBreak/*_1_2.csv`から再生成できます．各参加者の第1球を除き，65球から59遷移を作成します．

## 標準尺度データ

既存実験にはNASA-TLXおよびSUS回答が含まれていないため，初期状態では比較値を表示しません．
`evaluation.html`で入力した回答はブラウザの`localStorage`だけに保存され，サーバーには送信されません．
集計後はCSVとして出力できます．

NASA-TLXはRaw TLXと15対の一対比較を用いる重み付き方式に対応しています．
SUSは奇数項目を「回答値 − 1」，偶数項目を「5 − 回答値」として合計し，2.5倍して算出します．
