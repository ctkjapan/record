# JavaScript DDD構成

## 方針

レコード選択と再生の業務ルールをドメイン層へ置き、JSON・cookie・Web Audio API・DOMを外側の層へ分離します。

## 現在のファイル構成

```text
index.html
assets/
├── css/main.css
├── data/records.json
├── js/
│   ├── main.js
│   ├── record-player.js
│   ├── record-picker.js
│   ├── domain/
│   ├── application/
│   └── infrastructure/
└── mp3/
docs/
```

## レイヤー

| 層 | 主なファイル | 責務 |
| --- | --- | --- |
| Domain | `assets/js/domain/record.js`、`record-catalog.js` | レコードと一覧のルール |
| Application | `assets/js/application/record-catalog-service.js` | レコード一覧のユースケース |
| Infrastructure | `assets/js/infrastructure/record-json-repository.js` | JSON取得 |
| Infrastructure | `assets/js/infrastructure/playback-state-repository.js` | cookie保存・復元 |
| Infrastructure | `assets/js/infrastructure/web-audio-engine.js` | Web Audio API、音声バッファ、正転・逆転再生 |
| Presentation | `assets/js/record-player.js` | 回転操作、表示、シーク |
| Presentation | `assets/js/record-picker.js` | 選択画面、カード操作、レコード情報表示 |
| Composition Root | `assets/js/main.js` | 依存関係の生成と接続 |

## 依存方向

画面制御はアプリケーションとインフラの実装を直接生成せず、`main.js`から注入します。`window.RecordPlayer`は既存の選択処理との互換Facadeとして`main.js`で公開します。

## データの流れ

1. `RecordJsonRepository`が`assets/data/records.json`を読み込む。
2. `RecordCatalogService`が`RecordCatalog`を生成する。
3. `RecordPickerController`が選択レコードの`audioUrl`を`RecordPlayerController`へ渡す。
4. `WebAudioEngine`が音声を取得・デコードし、再生する。
5. 再生秒数と選択レコードIDを`PlaybackStateRepository`がcookieへ保存する。
