# EC特集号2027 実験当日のGAS運用手順

## 公開ページ

- 事前情報登録：<https://ryu-mei-15.github.io/CatcherX_Analysis_Lab/events/ec-special-issue/profile.html>
- 本試行後アンケート：<https://ryu-mei-15.github.io/CatcherX_Analysis_Lab/events/ec-special-issue/evaluation.html>

## 運用開始前に必ず行うこと

1. 最新の`backend/apps-script/Code.gs`をApps Scriptへ貼り付ける．
2. `setupCatcherXEvaluation`を実行し，実行ログの「実行完了」を確認する．完了通知はスプレッドシート右下に表示される．
3. `StudyConfig`の固定識別子が仕様書と一致していることを確認する．
4. `app_version`へ実験で使用するCatcherXビルド識別子を設定する．未設定では本試行後アンケートを開始できない．
5. Apps Scriptの「デプロイを管理」から既存ウェブアプリを編集し，新しいバージョンを割り当てる．
6. テスト用ID・実験回・試行ブロックで，事前登録と本試行後送信を確認する．

`app_version`へUnity Editorのバージョンを代入しないでください．

## 参加者と実験割当を準備する

固定IDは従来どおり`ParticipantImport`から登録します．続いて`AssignmentImport`へ次の列を入力します．

```csv
participant_id,session_id,trial_block_id,active,notes
1,S001,B001,TRUE,
2,S002,B001,TRUE,
```

「CatcherX → 実験割当を取り込む」を実行し，`StudyAssignments`で各IDに有効な割当が1件だけ存在することを確認します．

- `session_id`：同じ参加者の再実験を区別する実験回ID
- `trial_block_id`：アンケートに対応する本試行ログ群ID
- 1球の試行IDを`trial_block_id`として使用しない
- ログ側の各試行にも同じ`trial_block_id`を記録する

## 実験前

1. Participantsで参加者の行を選択し，「選択したIDへOTPを発行」を実行する．
2. IDとOTPを参加者へ渡す．
3. 参加者に事前情報登録ページを開いてもらう．
4. 登録済みと表示された場合は重複回答を省略する．
5. 未登録の場合は野球経験，捕手経験，VR HMD経験，利き手を登録する．
6. 回答完了後に課題説明・練習へ進む．

OTPは認証成功時に使用済みになるため，本試行後アンケート用に新しいOTPを発行します．

## 本試行終了直後

1. 同じ参加者IDへ新しいOTPを発行する．
2. 本試行後アンケートを開いてもらう．
3. 画面に表示された実験回・試行ブロック・ビルドが直前の本試行と一致することを確認する．
4. TLX，操作感，自由記述，SUSの順に回答してもらう．
5. 「回答を受け付けました」と表示されてから終了する．
6. `PostTaskResponses`に1行だけ追加されたことを確認する．

## 認証期限切れ・通信失敗

- 認証期限切れでは入力を消去しない．同じIDへ新しいOTPを発行し，再認証して送信する．
- 通信失敗時は入力を残したまま再送する．同じ`responseId`の再送では行は増えない．
- 次の参加者へ交代するときは「回答を破棄して交代」を押し，確認後に入力を消去する．
- 「入力をリセット」は参加者本人へ確認してから実行する．

## 回答データ

- 新研究の回答：`PostTaskResponses`
- 事前属性：`ParticipantProfiles`
- EC2026の既存回答：従来の`Responses`に保持し，新研究とは混在集計しない
- 個別回答・合成得点・他者との比較は参加者画面へ表示しない

OTP平文，スプレッドシートID，認証用秘密値を公開リポジトリへ保存しないでください．
