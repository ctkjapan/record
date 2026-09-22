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
│   │   ├── browser-interaction-controller.js
│   │   ├── menu-controller.js
│   │   ├── splash-controller.js
│   │   ├── record-player-controller.js
│   │   ├── record-picker-controller.js
│   │   └── text-reveal-controller.js
│   ├── domain/
│   │   ├── record.js
│   │   ├── record-catalog.js
│   │   ├── record-selection.js
│   │   ├── record-selection-policy.js
│   │   ├── playback-rate.js
│   │   ├── playback-direction.js
│   │   ├── playback-policy.js
│   │   ├── playback-session.js
│   │   ├── playback-seconds.js
│   │   └── playback-timeline.js
│   ├── application/
│   │   ├── record-catalog-service.js
│   │   ├── record-selection-service.js
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
| Domain | `assets/js/domain/record-selection.js`、`record-selection-policy.js` | フォーカス・確定選択状態とインデックス範囲、端循環ルール |
| Domain | `assets/js/domain/playback-rate.js`、`playback-direction.js` | 再生速度・方向の値と切替ルール |
| Domain | `assets/js/domain/playback-policy.js` | 回転速度と再生速度の変換、慣性設定 |
| Domain | `assets/js/domain/playback-session.js` | レコードID、再生秒数、ノイズ・ビジュアライザー設定の状態 |
| Domain | `assets/js/domain/playback-timeline.js` | 再生位置を音源の長さ以内へ制限するルール |
| Application | `assets/js/application/record-catalog-service.js` | レコード一覧のユースケース |
| Application | `assets/js/application/record-selection-service.js` | 選択状態を初期化・更新しDomainルールを画面操作へ提供 |
| Application | `assets/js/application/playback-service.js` | 状態復元、レコード選択、再生操作、保存の調停 |
| Infrastructure | `assets/js/infrastructure/record-json-repository.js` | JSON取得 |
| Infrastructure | `assets/js/infrastructure/playback-state-repository.js` | cookie保存・復元 |
| Infrastructure | `assets/js/infrastructure/web-audio-engine.js` | Web Audio API、音声バッファ、正転・逆転再生、ノイズ同期、解析データ |
| Presentation | `assets/js/controller/splash-controller.js` | 初回音声許可、スプラッシュ表示、操作ロック |
| Presentation | `assets/js/controller/browser-interaction-controller.js` | ページ復元、自動再生復帰、タッチジェスチャー、長押し制御 |
| Presentation | `assets/js/controller/record-player-controller.js` | 回転操作、表示、シーク、ラベル背景画像 |
| Presentation | `assets/js/controller/record-picker-controller.js` | 選択画面、カード操作、レコード情報表示 |
| Presentation | `assets/js/controller/text-reveal-controller.js` | 文字単位の表示アニメーション |
| Presentation | `assets/js/controller/menu-controller.js` | ヘッダーメニュー、メニューのスワイプ操作 |
| Composition Root | `assets/js/main.js` | 依存関係の生成と接続 |

## 依存方向

画面Controllerはドメインルール、cookie実装、Web Audio実装に直接依存せず、`PlaybackService`と`RecordCatalogService`を`main.js`から注入します。`PlaybackService`は音声エンジンと状態保存リポジトリを調停し、Controllerへ音声状態の読み取りと操作を提供します。`BrowserInteractionController`がページ復元、自動再生復帰の確認、ブラウザー操作の抑止を担当し、`SplashController`の音声有効化も`PlaybackService`経由にします。Composition Rootの`main.js`は各Controllerとサービスの生成・配線を担います。`window.RecordPlayer`は既存の選択処理との互換Facadeとして`main.js`で公開します。

## データの流れ

1. `main.js`がcookieリポジトリ、Web Audio、アプリケーションサービス、各Controllerを生成する。
2. `SplashController`がスプラッシュを表示し、初回クリックで`PlaybackService`へ音声有効化を依頼する。
3. `RecordJsonRepository`が`assets/data/records.json`を読み込む。
4. `RecordCatalogService`が`RecordCatalog`を生成する。
5. `RecordPickerController`が`PlaybackService`へレコード選択ユースケースを依頼し、サービスが必要に応じて再生を停止・再生秒数を保存してから選択レコードの音源を読み込む。
   フォーカス位置と確定選択位置は`RecordSelection`が保持し、端循環先とインデックス範囲は`RecordSelectionPolicy`が決定する。
6. `RecordPickerController`がレコードの`imageUrl`を`RecordPlayerController`へ渡し、`#label`と`PagePlayer`の背景画像を更新する。
7. `WebAudioEngine`がレコード音声を取得・デコードし、ノイズON時は`assets/ogg/record_noise_loop.ogg`も同期再生する。
8. `PlaybackService`が`PlaybackSession`を更新し、`PlaybackStateRepository`へレコードID、再生秒数、ノイズ同期状態、ビジュアライザー描画状態の保存を依頼する。

## DDDルール

- `record-player-controller.js`はDOMイベント、表示更新、アニメーション制御だけを担当する。
- 再生速度の上限・下限、速度変更、方向反転、回転速度変換は`domain/`で扱う。
- 再生位置の非負化と既知の音源長への制限は`PlaybackTimeline`へ集約し、画面と音声エンジンで共有する。
- レコード変更時の停止、再生位置の選択、音源切り替え、ノイズ状態の保存は`PlaybackService`で調停する。
- 速度補間、回転方向から再生方向への変換、速度と回転割合の変換は`PlaybackPolicy`に集約する。
- 先頭から右方向、末尾から左方向への循環先は`RecordSelectionPolicy`に集約し、タッチ・マウスのジェスチャー閾値判定はControllerに残す。
- 選択・フォーカス位置の状態遷移と有効範囲補正は`RecordSelection`へ集約し、Controllerは状態を画面表示へ反映する。
- JSON、cookie、Web Audio APIへのアクセスは`infrastructure/`に限定する。

## cookie

| cookie | 内容 |
| --- | --- |
| `groove-record-index` | 選択レコードID |
| `groove-record-playback-seconds` | 音声ファイル上の再生秒数 |
| `groove-record-noise-enabled` | ノイズ同期のON/OFF |
| `groove-record-visualizer-enabled` | ビジュアライザー描画のON/OFF |

旧cookie`groove-record-playback-position`は再生秒数の読み込み時だけ互換対応します。
