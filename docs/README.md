# GROOVE RECORDS 仕様書

`index.html`で提供するインタラクティブなレコードプレーヤーの仕様です。

## ドキュメント

- [画面構成](01_画面構成.md)
- [レコード再生・回転操作](02_レコード再生.md)
- [レコード選択](03_レコード選択.md)
- [レスポンシブ・アクセシビリティ](04_レスポンシブとアクセシビリティ.md)

## 対象ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | ページ構造、表示テキスト、操作対象、ARIA属性 |
| `js/record-player.js` | レコード回転、慣性、通常／逆再生、音源切り替え |
| `js/record-picker.js` | レコード一覧、選択画面、レコード情報の更新 |
| `styles.css` | レイアウト、配色、レコード表現、レスポンシブ表示 |

## 基本情報

- ページ言語：日本語（`lang="ja"`）
- タイトル：`GROOVE RECORDS — Interactive Vinyl Player`
- 初期表示レコード：`001 P4D / Dance!`
- レコード数：4件
- 音声方式：Web Audio API（`fetch` → `decodeAudioData`）
- 音声ファイル：`mp3/1-01 Dance!.mp3`、`mp3/04 Life Will Change.mp3`、`mp3/JSR.mp3`
- 外部フォント：Google Fontsの`DM Mono`、`Space Grotesk`
- 外部データ・サーバーAPI：なし
