# CatcherX GAS運用手順書

この文書は，`evaluation.html`を使ってNASA-TLX／SUSの回答を収集するときの実務手順をまとめたものです．初回設定だけでなく，実験当日のOTP発行，再発行，回答確認，Apps Script更新時の操作も記載しています．

## まず覚えておくこと

- 公開サイト：<https://ryu-mei-15.github.io/>
- 回答ページ：<https://ryu-mei-15.github.io/evaluation.html>
- 評価フォームの参加者ID：数字だけの正の整数（`1`〜`999999999`）
- `1`，`2`，`3`，…のように，必要な人数分を登録できる．
- 公開済みログの`Player 1`等の表記とは別に管理する．
- IDは各ユーザに固定し，実験中に変更しない．
- OTPは8桁の数字で，発行後60分間有効である．
- OTPはログインに成功すると使用済みになり，同じOTPでは再ログインできない．
- ログイン後のセッションは30分間有効である．
- OTPが使えなくなった場合は，同じIDへ新しいOTPを発行する．
- 回答日はユーザに入力させず，GASが受信した日本時間の日付を保存する．

## 実験当日の最短手順

通常は，次の操作だけで回答を収集できます．

1. 回答保存用の非公開Googleスプレッドシートを開く．
2. `Participants`シートを開く．
3. 回答するユーザの行を選択する．
4. 上部メニューの「CatcherX」→「選択したIDへOTPを発行」を実行する．
5. `OtpIssue`シートに表示されたID，8桁OTP，有効期限を確認する．
6. ユーザへ固定IDとOTPを伝える．
7. ユーザに<https://ryu-mei-15.github.io/evaluation.html>を開いてもらう．
8. 回答送信後，`Responses`シートに新しい行が追加されたことを確認する．
9. OTPを配布し終えたら「CatcherX」→「OTP発行一覧を消去」を実行する．

一度に全員分を発行する場合は，「CatcherX」→「有効な全IDへOTPを発行」を使用します．

## 初回設定

初回だけ，次の設定が必要です．

### 1．スプレッドシートとApps Scriptを準備する

1. 回答保存用のGoogleスプレッドシートを作成する．
2. スプレッドシートは一般公開せず，研究担当者だけに共有する．
3. 「拡張機能」→「Apps Script」を開く．
4. リポジトリの`apps-script/Code.gs`の内容をApps Script側の`Code.gs`へ貼り付けて保存する．
5. Apps Scriptの関数一覧から`setupCatcherXEvaluation`を選び，「実行」を押す．
6. 初回に表示されるGoogleの権限確認を許可する．

実行後，スプレッドシートに次の4シートが作成されます．

| シート | 用途 |
|---|---|
| `Participants` | 固定ID，OTPの状態，有効状態，回答可能条件を管理する |
| `Responses` | 認証済みのNASA-TLX／SUS回答を保存する |
| `ParticipantImport` | 固定IDと利用条件をまとめて登録する |
| `OtpIssue` | 発行直後の平文OTPを一時的に表示する |

### 2．公開サイトのオリジンを設定する

Apps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」に次を追加します．

| プロパティ | 値 |
|---|---|
| `ALLOWED_ORIGIN` | `https://ryu-mei-15.github.io` |

`evaluation.html`は付けず，末尾の`/`も付けません．`OTP_PEPPER`，`SESSION_SECRET`，`SPREADSHEET_ID`は`setupCatcherXEvaluation`の実行時に自動作成されるため，手入力しません．

### 3．固定参加者IDを登録する

`ParticipantImport`シートの2行目以降に以前のデータがある場合は，先にその内容を消去します．見出しの1行目は残してください．その後，次の内容を貼り付けます．CSVとして読み込んでも構いません．

```csv
participant_id,allowed_conditions,active,notes
1,統合条件|捕球のみ|配球判断のみ|CatcherX全体,TRUE,
2,統合条件|捕球のみ|配球判断のみ|CatcherX全体,TRUE,
3,統合条件|捕球のみ|配球判断のみ|CatcherX全体,TRUE,
4,統合条件|捕球のみ|配球判断のみ|CatcherX全体,TRUE,
5,統合条件|捕球のみ|配球判断のみ|CatcherX全体,TRUE,
6,統合条件|捕球のみ|配球判断のみ|CatcherX全体,TRUE,
7,統合条件|捕球のみ|配球判断のみ|CatcherX全体,TRUE,
```

8人目以降も同じ形式で行を追加します．たとえば20名の場合は，ID `1`〜`20`の20行を登録します．

貼り付け後，次を実行します．

```text
CatcherX → 固定IDを取り込む
```

`Participants`シートに必要な人数分が表示されれば登録完了です．既存IDを再度取り込んでもIDは重複せず，有効状態と回答可能条件が更新されます．

`ParticipantImport`に`Player 1`等の旧形式IDが残っていても，新しいコードではその行を除外して数字IDだけを取り込みます．ID `6`以降は除外せず取り込みます．取込後のメッセージに，取り込んだ件数と除外した行が表示されます．

以前の`Player 1`等の認証IDが`Participants`に残っている場合は，数字IDの取込後に旧ID行の`active`を`FALSE`へ変更します．旧IDに紐づく回答を保持したい場合は，旧行を削除しないでください．

`allowed_conditions`へ指定できる値は次のとおりです．複数指定するときは`|`で区切ります．空欄の場合は全条件が許可されます．

- `統合条件`
- `捕球のみ`
- `配球判断のみ`
- `CatcherX全体`

### 4．ウェブアプリとしてデプロイする

Apps Scriptで「デプロイ」→「新しいデプロイ」→「ウェブアプリ」を選びます．

- 次のユーザとして実行：自分
- アクセスできるユーザ：全員

デプロイ後に表示される`/exec`で終わるURLを，`evaluation-config.js`の`endpoint`へ設定します．現在の設定値は次のURLです．

```text
https://script.google.com/macros/s/AKfycbzp3yPmHGnJSx-qXbPLau-kldmP8W4kuLSZA66kH9D46196BEOac4o5GUSocVeKbqvyEw/exec
```

## OTPの発行方法

### 特定のユーザへ発行する

1. `Participants`シートを開く．
2. 対象ユーザのセルまたは行を選択する．複数行の選択も可能である．
3. 「CatcherX」→「選択したIDへOTPを発行」を実行する．
4. `OtpIssue`シートを開く．
5. `participant_id`，`otp`，`expires_at`を確認してユーザへ伝える．

### 全ユーザへ一括発行する

「CatcherX」→「有効な全IDへOTPを発行」を実行します．`Participants`で`active`が`TRUE`のIDだけが対象です．

### OTPを再発行する

期限切れ，入力失敗，認証後のページ終了などで再ログインできない場合は，通常の発行操作を同じIDに対してもう一度実行します．新しいOTPを発行した時点で，以前の未使用OTPも無効になります．

### 平文OTPを消去する

ユーザへ配布し終えたら，次を実行します．

```text
CatcherX → OTP発行一覧を消去
```

この操作は`OtpIssue`に一時表示している平文OTPを消去します．`Participants`に保存された認証用ハッシュや回答データは消去されません．

## ユーザに案内する内容

ユーザには，次の3点を伝えます．

1. 回答ページ：<https://ryu-mei-15.github.io/evaluation.html>
2. 固定参加者ID：例 `1`
3. 今回発行した8桁OTP

IDは数字だけで入力し，研究担当者から指定された値と一致させてもらいます．

## 回答の確認と公開設定

回答が送信されると，`Responses`シートへ1行追加されます．主に次の列を確認します．

| 列 | 内容 |
|---|---|
| `participant_id` | 回答した固定ID |
| `condition` | 実験条件 |
| `recorded_date` | GASが確定した日本時間の実施日 |
| `saved_at` | 保存日時 |
| `tlx_score` | NASA-TLXスコア |
| `sus_score` | SUSスコア |
| `approved` | 公開集計へ含めるかどうか |

`approved`が`TRUE`で，同じ条件の回答が3名以上ある場合だけ，匿名の条件別集計が公開ページに表示されます．回答を公開集計から除外するときは，対象行の`approved`を`FALSE`へ変更します．個別IDや個別回答は公開されません．

同じ参加者IDと実験条件の組合せは1回だけ保存できます．同じユーザが別の実験条件へ回答する場合は，新しいOTPを発行して再度ログインさせます．

## IDの停止と再開

`Participants`シートの`active`を変更します．

- `TRUE`：ログインを許可する
- `FALSE`：ログインを拒否する

利用を停止したいIDは`FALSE`にします．再開するときは`TRUE`へ戻し，新しいOTPを発行します．

## Apps Scriptを更新するとき

`apps-script/Code.gs`を修正しただけでは，公開中のウェブアプリへ自動反映されません．必ず次の操作を行います．

1. リポジトリの最新`Code.gs`をApps Scriptへ貼り付けて保存する．
2. 必要に応じて`setupCatcherXEvaluation`を実行する．
3. 「デプロイ」→「デプロイを管理」を開く．
4. 現在使用中のウェブアプリの編集ボタンを押す．
5. バージョンで「新バージョン」を選択する．
6. 「デプロイ」を押す．
7. `/exec` URLが従来と同じであることを確認する．
8. `evaluation.html`からテスト用IDと新規OTPで認証・送信を確認する．

同じデプロイを更新する限り，`/exec` URLは変わりません．「新しいデプロイ」を別に作成した場合はURLが変わるため，`evaluation-config.js`も更新します．

## 旧パスワード方式からOTP方式へ移行するとき

1. 最新の`Code.gs`をApps Scriptへ貼り付ける．
2. `setupCatcherXEvaluation`を実行する．
3. `Participants`で固定ID，有効状態，回答可能条件が保持されていることを確認する．
4. 各IDへ新しいOTPを発行する．
5. 既存デプロイを新バージョンへ更新する．

旧パスワードは移行時に無効になります．旧`CredentialImport`のIDと条件は`ParticipantImport`へ移され，平文パスワード列は消去されます．

## 困ったとき

### スプレッドシートに「CatcherX」メニューがない

スプレッドシートを再読み込みします．それでも表示されない場合は，Apps Scriptで`onOpen`を一度実行してから再読み込みします．

### 「参加者IDまたはOTPが正しくありません」と表示される

次を確認します．

- IDが数字だけで，そのユーザへ割り当てた値になっているか．
- `Participants`の`active`が`TRUE`か．
- OTP発行から60分以内か．
- そのOTPですでに認証していないか．
- 新しいOTPの発行後に，古いOTPを入力していないか．

解決しない場合は，同じIDへ新しいOTPを発行します．認証に5回失敗すると，そのIDは15分間ログインできません．

### 認証後にページを閉じてしまった

使用したOTPは再利用できません．同じIDへ新しいOTPを発行し，最初からログインしてもらいます．

### 回答を送信できない

- ログインから30分以上経過していないか確認する．
- 同じIDと実験条件ですでに回答していないか確認する．
- `Participants`の`allowed_conditions`に対象条件が含まれているか確認する．
- `evaluation-config.js`の`endpoint`が現在のGAS `/exec` URLと一致しているか確認する．
- Apps Scriptを変更した直後なら，既存デプロイへ新バージョンを割り当てたか確認する．

### 回答は保存されたが公開集計に出ない

`Responses`の`approved`が`TRUE`であることと，同じ条件に3名以上の回答があることを確認します．これは少人数の個別値が公開されることを防ぐための仕様です．

## セキュリティ上の注意

- スプレッドシートは研究担当者以外へ共有しない．
- `OtpIssue`の内容やOTPをGitHubへコミットしない．
- スプレッドシートID，`OTP_PEPPER`，`SESSION_SECRET`を公開しない．
- OTPは実験開始直前に発行する．
- OTP配布後は`OtpIssue`を消去する．
- 参加者の氏名，メールアドレスなどを固定IDの代わりに使用しない．
- 回答データをCSV出力した場合も，公開場所へ置かない．

## 関連ファイル

- `apps-script/Code.gs`：認証，OTP発行，回答保存，公開集計の実装
- `apps-script/README.md`：バックエンドの仕様と導入説明
- `evaluation.html`：ユーザが回答する画面
- `evaluation.js`：認証と回答送信のフロントエンド処理
- `evaluation-config.js`：GASウェブアプリの接続先
