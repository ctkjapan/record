# GROOVE RECORDS 仕様書

`index.html`で提供するインタラクティブなレコードプレーヤーの仕様です。

## ドキュメント

- [画面構成](01_画面構成.md)
- [レコード再生・回転操作](02_レコード再生.md)
- [レコード選択](03_レコード選択.md)
- [レスポンシブ・アクセシビリティ](04_レスポンシブとアクセシビリティ.md)
- [JavaScript DDD構成](05_JavaScript_DDD構成.md)

## 対象ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | ページ構造、表示テキスト、操作対象、ARIA属性 |
| `assets/js/main.js` | 依存関係の生成と初期化 |
| `assets/js/record-player.js` | レコード回転、慣性、シーク、表示 |
| `assets/js/record-picker.js` | レコード選択画面とレコード情報の更新 |
| `assets/js/domain/` | レコードと一覧のドメインモデル |
| `assets/js/application/` | レコード一覧のユースケース |
| `assets/js/infrastructure/` | JSON、cookie、Web Audio APIのアダプター |
| `assets/css/main.css` | レイアウト、配色、レコード表現、レスポンシブ表示 |
| `assets/data/records.json` | レコード定義と音声URL |
| `assets/mp3/` | 再生する音声ファイル |

## 基本情報

- ページ言語：日本語（`lang="ja"`）
- タイトル：`GROOVE RECORDS — Interactive Vinyl Player`
- 初期表示レコード：cookie保存値、保存値がない場合は`001 P4D / Dance!`
- レコード数：`assets/data/records.json`の定義数
- 音声方式：Web Audio API（`fetch` → `decodeAudioData`）
- 音声ファイル：`assets/data/records.json`の`audioUrl`で指定
- 外部フォント：Google Fontsの`DM Mono`、`Space Grotesk`
- 外部データ：`assets/data/records.json`
- サーバーAPI：なし
