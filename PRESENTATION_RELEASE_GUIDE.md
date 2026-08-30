# EC2026発表資料の公開切替手順

発表スライドとポスターは，発表前に誤ってGitHub Pagesへ配信されないよう，`.gitignore`で除外しています．`presentation-config.js`の表示設定だけではPDFへの直接アクセスを防げないため，発表前はPDFをGitへ追加しないでください．

## 現在の状態

- `presentation-config.js`の`published`は`false`
- `paper/EC2026*.pdf`は`.gitignore`で除外
- `paper.html`には「発表後に公開予定」とだけ表示
- ローカルのスライドは23ページ
- ローカルのポスターPDFは7ページで，完成版以外のページを含むため公開前確認が必要

## 発表後の公開手順

1. ポスターPDFを確認し，公開する完成版だけを含むPDFへ差し替える．
2. `presentation-config.js`の各資料について，`pages`と`fileSize`を最終PDFに合わせる．
3. `presentation-config.js`の`published: false`を`published: true`へ変更する．
4. `.gitignore`から次の行を削除する．

   ```gitignore
   paper/EC2026*.pdf
   ```

5. スライド，ポスター，設定ファイルをGitへ追加する．
6. ローカルHTTPサーバで`paper.html`を開き，両方の「ブラウザ内で閲覧する」が動作することを確認する．
7. GitHub Pagesへ反映後，公開URLからPDFが表示できることを確認する．

## 公開を再び停止する場合

`published`を`false`へ戻すだけでは，すでに配信したPDFへの直接アクセスは残ります．PDFを公開履歴から完全に消す必要がある場合は，GitHub Pagesの配信元とGit履歴を含めた別対応が必要です．通常は，公開前にPDFをコミットしない運用を徹底してください．
