# CatcherX EC特集号2027 回答収集バックエンド

固定参加者ID・OTP認証，実験回／試行ブロック割当，事前属性，本試行後アンケートをGoogle Apps Scriptと非公開スプレッドシートで管理します．EC2026の既存`Responses`は変更せず，新研究の回答は`PostTaskResponses`へ分離します．

## 固定研究識別子

| 項目 | 値 |
|---|---|
| studyId | `ec-special-issue-2027` |
| protocolVersion | `single-assist-v1` |
| questionnaireVersion | `post-task-v1` |
| conditionCode | `assist_enabled` |
| responseType | `post_task` |

`appVersion`は`StudyConfig`シートで研究者が設定します．未設定のままでは本試行後アンケートへ認証できません．Unity Editorのバージョンではなく，実験対象となるCatcherXビルドの識別子を設定してください．

## 作成・使用するシート

| シート | 用途 |
|---|---|
| `Participants` | 固定ID，OTP，有効状態（既存データを保持） |
| `ParticipantImport` | 固定IDの取込 |
| `StudyAssignments` | IDごとの実験回・試行ブロック |
| `AssignmentImport` | 実験割当の取込 |
| `StudyConfig` | 固定識別子と`app_version` |
| `ParticipantProfiles` | 実験前の経験属性 |
| `PostTaskResponses` | 新研究の本試行後回答 |
| `OtpIssue` | 発行直後の平文OTP（配布後に消去） |

## 初期設定

1. 非公開スプレッドシートのApps Scriptへ`Code.gs`を貼り付ける．
2. `setupCatcherXEvaluation`を実行し，実行ログの「実行完了」を確認する．完了通知はスプレッドシート右下に表示される．
3. スクリプトプロパティ`ALLOWED_ORIGIN`を`https://ryu-mei-15.github.io`にする．
4. `StudyConfig`の`app_version`を本番ビルド識別子へ更新する．
5. Apps Scriptの既存ウェブアプリデプロイへ新しいバージョンを割り当てる．

## 実験割当

`AssignmentImport`へ次の形式で登録し，「CatcherX → 実験割当を取り込む」を実行します．

```csv
participant_id,session_id,trial_block_id,active,notes
1,S001,B001,TRUE,
2,S002,B001,TRUE,
```

IDには有効な実験割当を1件だけ設定します．同じ参加者の新しい実験回を`TRUE`で取り込むと，それ以前の実験回は自動的に`FALSE`になります．過去の回答行は変更されません．

## 保存と検証

- TLXは6項目すべてが0〜100・5刻みであることを確認し，Raw TLXをサーバで再計算する．
- 操作感は4項目を`answered`（1〜7）または`not_experienced`（値は`null`）として保存する．
- 自由記述は2,000文字以下とし，空欄を許可する．
- SUSは10項目の生回答からサーバで再計算する．
- 同一`responseId`の再送は同じ回答として扱い，行を増やさない．
- 同一参加者・実験回・試行ブロックの別回答を自動上書きしない．
- 事前属性は参加者IDにつき1件とし，登録済みなら重複登録を省略する．

接続先URLは`events/ec-special-issue/js/evaluation-config.js`で管理します．
