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
│   ├── controller/
│   │   ├── menu-controller.js
│   │   ├── splash-controller.js
│   │   ├── record-player-controller.js
│   │   ├── record-picker-controller.js
│   │   └── text-reveal-controller.js
│   ├── domain/
│   │   ├── record.js
│   │   ├── record-catalog.js
│   │   ├── playback-rate.js
│   │   ├── playback-direction.js
│   │   ├── playback-policy.js
│   │   └── playback-session.js
│   ├── application/
│   │   ├── record-catalog-service.js
│   │   └── playback-service.js
│   └── infrastructure/
│       ├── record-json-repository.js
│       ├── playback-state-repository.js
│       └── web-audio-engine.js
├── mp3/
└── ogg/record_noise_loop.ogg
docs/
```

## レイヤー

| 層 | 主なファイル | 責務 |
| --- | --- | --- |
| Domain | `assets/js/domain/record.js`、`record-catalog.js` | レコードと一覧のルール |
| Domain | `assets/js/domain/playback-rate.js`、`playback-direction.js` | 再生速度・方向の値と切替ルール |
| Domain | `assets/js/domain/playback-policy.js` | 回転速度と再生速度の変換、慣性設定 |
| Domain | `assets/js/domain/playback-session.js` | レコードID、再生秒数、ノイズ設定の状態 |
| Application | `assets/js/application/record-catalog-service.js` | レコード一覧のユースケース |
| Application | `assets/js/application/playback-service.js` | 状態復元、レコード選択、再生操作、保存の調停 |
| Infrastructure | `assets/js/infrastructure/record-json-repository.js` | JSON取得 |
| Infrastructure | `assets/js/infrastructure/playback-state-repository.js` | cookie保存・復元 |
| Infrastructure | `assets/js/infrastructure/web-audio-engine.js` | Web Audio API、音声バッファ、正転・逆転再生、ノイズ同期 |
| Presentation | `assets/js/controller/splash-controller.js` | 初回音声許可、スプラッシュ表示、操作ロック |
| Presentation | `assets/js/controller/record-player-controller.js` | 回転操作、表示、シーク、ラベル背景画像 |
| Presentation | `assets/js/controller/record-picker-controller.js` | 選択画面、カード操作、レコード情報表示 |
| Presentation | `assets/js/controller/text-reveal-controller.js` | 文字単位の表示アニメーション |
| Presentation | `assets/js/controller/menu-controller.js` | ヘッダーメニュー、メニューのスワイプ操作 |
| Composition Root | `assets/js/main.js` | 依存関係の生成と接続 |

## 依存方向

画面Controllerはドメインルールやcookie実装を直接持たず、`PlaybackService`と`RecordCatalogService`を`main.js`から注入します。`PlaybackService`は音声ポートと状態保存ポートを調停し、ControllerはDOM表示と入力イベントに集中します。`window.RecordPlayer`は既存の選択処理との互換Facadeとして`main.js`で公開します。ブラウザのタッチジェスチャー制御も`main.js`で初期化します。

## データの流れ

1. `main.js`がcookieリポジトリ、Web Audio、アプリケーションサービス、各Controllerを生成する。
2. `SplashController`がスプラッシュを表示し、初回クリックでAudioContextをアンロックする。
3. `RecordJsonRepository`が`assets/data/records.json`を読み込む。
4. `RecordCatalogService`が`RecordCatalog`を生成する。
5. `RecordPickerController`が`PlaybackService`へレコード選択を依頼し、選択レコードの`audioUrl`を`RecordPlayerController`へ渡す。
6. `RecordPickerController`がレコードの`imageUrl`を`RecordPlayerController`へ渡し、`#label`の背景画像を更新する。
7. `WebAudioEngine`がレコード音声を取得・デコードし、ノイズON時は`assets/ogg/record_noise_loop.ogg`も同期再生する。
8. `PlaybackService`が`PlaybackSession`を更新し、`PlaybackStateRepository`へレコードID、再生秒数、ノイズ同期状態の保存を依頼する。

## DDDルール

- `record-player-controller.js`はDOMイベント、表示更新、アニメーション制御だけを担当する。
- 再生速度の上限・下限、速度変更、方向反転、回転速度変換は`domain/`で扱う。
- レコード変更時の停止、再生位置の選択、ノイズ状態の保存は`PlaybackService`で調停する。
- JSON、cookie、Web Audio APIへのアクセスは`infrastructure/`に限定する。

## cookie

| cookie | 内容 |
| --- | --- |
| `groove-record-index` | 選択レコードID |
| `groove-record-playback-seconds` | 音声ファイル上の再生秒数 |
| `groove-record-noise-enabled` | ノイズ同期のON/OFF |

旧cookie`groove-record-playback-position`は再生秒数の読み込み時だけ互換対応します。
