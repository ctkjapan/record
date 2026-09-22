# VINYL 仕様書

`index.html`で提供するインタラクティブなレコードプレーヤーの仕様です。

## ドキュメント

- [画面構成](01_画面構成.md)
- [レコード再生・回転操作](02_レコード再生.md)
- [レコード選択](03_レコード選択.md)
- [レスポンシブ・アクセシビリティ](04_レスポンシブとアクセシビリティ.md)
- [JavaScript DDD構成](05_JavaScript_DDD構成.md)
- [JavaScript DDD回帰テスト](06_JavaScript_DDD回帰テスト.md)
- [Vite + React移行](07_Vite_React移行.md)

## 対象ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | ページ構造、表示テキスト、操作対象、ARIA属性 |
| `src/App.jsx` | Reactで描画するページ、プレーヤー、選択画面 |
| `src/main.jsx` | React rootとアプリケーション起動 |
| `src/composition-root.js` | DDD依存関係の生成と初期化 |
| `vite.config.js` | Reactプラグインと静的アセット出力 |
| `src/controller/browser-interaction-controller.js` | ページ復元、タッチジェスチャー、長押し制御 |
| `src/controller/splash-controller.js` | 初回音声許可、スプラッシュ表示、操作ロック |
| `src/controller/menu-controller.js` | ヘッダーメニューの開閉とキーボード操作 |
| `src/controller/record-player-controller.js` | レコード回転、慣性、シーク、表示、ラベル背景画像 |
| `src/controller/record-picker-controller.js` | レコード選択画面とレコード情報の更新 |
| `src/controller/text-reveal-controller.js` | 文字単位の表示アニメーション |
| `src/domain/` | レコード、再生速度、再生方向、再生セッションのドメインルール |
| `src/application/` | レコード一覧と再生状態のユースケース |
| `src/infrastructure/` | JSON、cookie、Web Audio APIのアダプター |
| `assets/css/main.css` | レイアウト、配色、レコード表現、レスポンシブ表示 |
| `assets/data/records.json` | レコード定義、音声URL、ラベル背景画像URL |
| `assets/mp3/` | レコード本編の音声ファイル |
| `assets/ogg/record_noise_loop.ogg` | 同期再生するノイズ音声 |

## 基本情報

- ページ言語：日本語（`lang="ja"`）
- タイトル：`VINYL`
- 初期表示レコード：cookie保存値、保存値がない場合は`001 P4D / Dance!`
- レコード数：`assets/data/records.json`の定義数（現在12件）
- 音声方式：Web Audio API（`fetch` → `decodeAudioData`）
- レコード音声：`assets/data/records.json`の`audioUrl`で指定
- 背景画像：`assets/data/records.json`の`imageUrl`で指定し、`#label`と`PagePlayer`へ表示
- ノイズ音声：`assets/ogg/record_noise_loop.ogg`
- 保存cookie：レコードID、再生秒数、ノイズ同期状態、ビジュアライザー描画状態
- 外部フォント：Google Fontsの`DM Mono`、`Space Grotesk`
- 外部データ：`assets/data/records.json`
- サーバーAPI：なし
