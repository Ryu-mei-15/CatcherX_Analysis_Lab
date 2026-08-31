# EC2026発表資料の公開切替手順

発表資料は`presentation-config.js`で資料ごとに公開状態を管理します．表示設定だけではPDFへの直接アクセスを防げないため，非公開資料は`.gitignore`でも除外し，Gitへ追加しないでください．

## 現在の状態

- ポスターは公開中（1ページ，約4.1 MB）
- スライドは非公開（23ページ，約21 MB）
- `.gitignore`ではスライドPDFだけを除外
- `paper.html`ではポスターにだけ閲覧ボタンを表示

## スライドを発表後に公開する手順

1. スライドPDFを確認し，`presentation-config.js`の`pages`と`fileSize`を最終PDFに合わせる．
2. `slides`の`published: false`を`published: true`へ変更する．
3. `.gitignore`から次の行を削除する．

   ```gitignore
   paper/EC2026*スライ*.pdf
   ```

4. スライドと設定ファイルをGitへ追加する．
5. ローカルHTTPサーバで`paper.html`を開き，両方の「ブラウザ内で閲覧する」が動作することを確認する．
6. GitHub Pagesへ反映後，公開URLからPDFが表示できることを確認する．

## 公開を再び停止する場合

対象資料の`published`を`false`へ戻すだけでは，すでに配信したPDFへの直接アクセスは残ります．PDFを公開履歴から完全に消す必要がある場合は，GitHub Pagesの配信元とGit履歴を含めた別対応が必要です．通常は，公開前にPDFをコミットしない運用を徹底してください．
