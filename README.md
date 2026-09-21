# GROOVE RECORDS

ブラウザ上でレコードを回転させて音楽を再生する、インタラクティブなレコードプレーヤーです。

## 機能

- レコードのドラッグ操作・キーボード操作
- 回転速度に連動した再生速度の変更
- 慣性回転と正転・逆転再生
- `assets/data/records.json`に定義したレコード選択
- 音声ロード進捗の表示
- 音声ロード中のレコードのモノクロ表示
- レスポンシブ表示と基本的なキーボードアクセシビリティ

## 起動方法

MP3を`fetch`で読み込むため、ローカルHTTPサーバー経由で起動します。

```sh
python3 -m http.server 8000
```

ブラウザで<http://localhost:8000/>を開いてください。

## 操作方法

| 操作 | 動作 |
| --- | --- |
| レコードをドラッグ | 回転・再生 |
| ← / →キー | レコードを回転 |
| COLLECTION | レコード選択画面を表示 |
| 選択画面の左右ドラッグ | レコードを切り替え |
| 中央のレコードをクリック | レコードを選択してプレーヤーへ戻る |
| リセットボタン | 回転と再生を停止して初期位置へ戻す |

## 構成

| パス | 役割 |
| --- | --- |
| `index.html` | ページ構造、操作対象、ARIA属性 |
| `assets/js/main.js` | DDD各層の依存関係を構成して初期化 |
| `assets/js/record-player.js` | 回転、慣性、シーク、プレーヤー表示 |
| `assets/js/record-picker.js` | レコード選択画面、表示情報の更新 |
| `assets/js/domain/` | レコードと一覧のドメインモデル |
| `assets/js/application/` | レコード一覧のユースケース |
| `assets/js/infrastructure/` | JSON、cookie、Web Audio APIのアダプター |
| `assets/data/records.json` | レコード定義と音声URL |
| `assets/css/main.css` | レイアウト、配色、レコード表現、レスポンシブ表示 |
| `assets/mp3/` | 再生する音声ファイル |
| `docs/` | 機能別の仕様書 |

## 音声再生

Web Audio APIを使用します。音声は`fetch`と`decodeAudioData`で読み込み、再生用のバッファをキャッシュします。音声ファイルの切り替え中はロード進捗を表示し、ロード完了後に再生可能になります。

## 確認方法

```sh
node --check assets/js/main.js
node --check assets/js/record-player.js
node --check assets/js/record-picker.js
node --check assets/js/infrastructure/web-audio-engine.js
git diff --check
```

詳細は[docs/README.md](docs/README.md)から機能別の仕様書を参照してください。
