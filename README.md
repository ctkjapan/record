# VINYL

ブラウザ上でレコードを回転させて音楽を再生する、インタラクティブなレコードプレーヤーです。

## 機能

- レコードのドラッグ操作・キーボード操作
- 回転速度に連動した再生速度の変更
- 慣性回転と正転・逆転再生
- `assets/data/records.json`に定義したレコード選択
- レコード画像の`label`背景表示
- 音声ロード進捗の表示
- 音声ロード中のレコードのモノクロ表示
- 初回表示時のスプラッシュと音声再生許可
- ノイズ音声の同期再生ON/OFFと状態のcookie保存
- ヘッダーメニューの開閉
- プルダウンリフレッシュと左右端の履歴スワイプの抑止
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
| `TAP TO START` | AudioContextを有効化して操作画面を開く |
| `menuButton` | ヘッダーメニューを開閉。`Escape`で閉じる |
| レコードをドラッグ | 回転・再生 |
| ← / →キー | レコードを回転 |
| `noiseButton` | ノイズ音声の同期再生をON/OFF。状態はcookieへ保存 |
| `changeButton`（COLLECTION） | レコード選択画面を表示 |
| 選択画面の左右ドラッグ | レコードを切り替え |
| 中央のレコードをクリック | レコードを選択してプレーヤーへ戻る |

## 構成

| パス | 役割 |
| --- | --- |
| `index.html` | ページ構造、操作対象、ARIA属性 |
| `assets/js/main.js` | DDD各層の依存関係を構成して初期化 |
| `assets/js/controller/splash-controller.js` | 初回音声許可、スプラッシュ表示、操作ロック |
| `assets/js/controller/menu-controller.js` | ヘッダーメニューの開閉とキーボード操作 |
| `assets/js/controller/record-player-controller.js` | 回転、慣性、シーク、プレーヤー表示 |
| `assets/js/controller/record-picker-controller.js` | レコード選択画面、表示情報の更新 |
| `assets/js/controller/text-reveal-controller.js` | `splashTitle`・`hero`の文字アニメーション |
| `assets/js/domain/` | レコードと再生操作のドメインルール |
| `assets/js/application/` | レコード一覧と再生状態のユースケース |
| `assets/js/infrastructure/` | JSON、cookie、Web Audio APIのアダプター |
| `assets/data/records.json` | レコード定義、音声URL、ラベル背景画像URL |
| `assets/css/main.css` | レイアウト、配色、レコード表現、操作制御 |
| `assets/mp3/` | レコード本編の音声ファイル |
| `assets/ogg/record_noise_loop.ogg` | 同期再生するノイズ音声 |
| `docs/` | 機能別の仕様書 |

## 音声再生

Web Audio APIを使用します。レコード音声は`assets/data/records.json`の`audioUrl`、ラベル背景画像は`imageUrl`、ノイズ音声は`assets/js/main.js`の`RECORD_NOISE_SOURCE`から取得します。音声は`fetch`と`decodeAudioData`でバックグラウンドロードし、正転・逆転用バッファを生成します。ノイズがOFFの場合はノイズ音声をロードしません。

初回表示時はスプラッシュを表示します。`TAP TO START`のクリックでAudioContextをアンロックし、操作ロックを解除します。再生秒数、選択レコード、ノイズ同期状態はcookieへ保存します。

## 確認方法

```sh
for file in $(rg --files assets/js); do node --check "$file"; done
git diff --check
```

詳細は[docs/README.md](docs/README.md)から機能別の仕様書を参照してください。
