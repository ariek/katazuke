# 片付けクエスト

現実の部屋を片付けるためのブラウザゲーム。片付けの内容を「クエスト」として登録し、こなすと経験値が貯まり、画面上の部屋がきれいになっていく。

- サーバーなし。データはブラウザの `localStorage` に保存する。
- 素の HTML / CSS / JavaScript。ビルド不要。
- スマホの縦画面を基準に作っている。

## 使い方

1. 公開 URL（GitHub Pages）をスマホかPCのブラウザで開く。
2. 初回はサンプルのエリアとクエストが入っている。設定画面の「サンプルを消して自分で登録する」で空にして、自分の部屋に合わせて登録する。
3. クエスト画面の「いまやる」カードで「スタート」を押し、難易度ごとのタイマー（3 / 5 / 10 分）の間に片付けて「クエスト完了」を押す。残り時間が多いほどボーナス経験値が入り、一時停止せずに続けるとコンボで倍率が上がる。
4. 完了すると5秒後に次のクエストが自動で始まる。25分ごとに5分の休憩が入り、「× やめる」でいつでも終えられる。

ホーム画面に追加すると、アプリのように全画面で開け、オフラインでも動く。iPhone は Safari の共有メニューから「ホーム画面に追加」、Android は Chrome のメニューから「アプリをインストール」。

機種変更や別端末で使うときは、設定画面の「エクスポート」で JSON を保存し、移行先で「インポート」する。

## ローカルで動かす

簡易サーバーを起動して確認する（キャッシュを禁止するヘッダー付き）。

```bash
python3 dev/server.py
```

ブラウザで `http://127.0.0.1:8765/public/` を開く。エリアの絵を全種類まとめて見る開発用ページは `http://127.0.0.1:8765/dev/gallery.html`、タイマーのデザイン案は `http://127.0.0.1:8765/docs/design-timer.html`。

Claude Code から確認する場合は `.claude/launch.json` の `katazuke` 設定で同じサーバーが起動する。

## 公開（GitHub Pages）

`main` に取り込まれると、GitHub Actions（`.github/workflows/pages.yml`）が `public/` だけを GitHub Pages に公開する。ドキュメントや開発用ファイルは公開されない。

初回だけ設定が必要:

1. リポジトリを公開に切り替える（無料プランの GitHub Pages は公開リポジトリのみ）。
2. GitHub のリポジトリページで Settings → Pages を開き、Source を「GitHub Actions」にする。
3. 数分後に `https://<ユーザー名>.github.io/katazuke/` で開ける。

## ドキュメント

| ファイル | 内容 |
| --- | --- |
| [docs/SPEC.md](docs/SPEC.md) | 仕様書。画面、ゲームルール、データ構造、検討事項、決定事項の記録 |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | ブランチ運用とコミットメッセージのルール |
| [docs/design-timer.html](docs/design-timer.html) | タイマー付きカードと各モーダルのデザイン案 |
| [CLAUDE.md](CLAUDE.md) | Claude Code に作業させるときの方針 |

仕様を変えるときは、コードより先に `docs/SPEC.md` を直す。

## ファイル構成

```
public/       公開する本体（GitHub Pages に配信される）
  index.html    画面の骨組み
  style.css     スタイル
  app.js        状態管理、保存、画面切り替え、起動
  game.js       経験値、レベル、ストリーク、きれい度の計算
  room.js       エリアの絵（SVG）
  quests.js     クエスト画面
  timer.js      クエストのタイマーとセッション
  settings.js   設定画面
  bulk.js       クエストの一括追加
  log.js        記録画面
  effects.js    完了演出
  dialog.js     確認ダイアログ
  sw.js         サービスワーカー
  manifest.webmanifest, icons/
docs/         仕様書、開発ルール、デザイン案
dev/          開発用（確認用サーバー、チェック、絵の一覧）
.github/      PR の雛形と Pages 公開のワークフロー
```

## ライセンス

個人利用のプロジェクト。ライセンスは未定。
