# JavaScript DDD構成

## 方針

レコード選択と再生の業務ルールをドメイン層へ置き、JSON・cookie・Web Audio API・DOMを外側の層へ分離します。

## 現在のファイル構成

```text
index.html
package.json
vite.config.js
src/
├── App.jsx
├── components/
│   ├── TopBar.jsx
│   └── sections/
│       ├── SplashSection.jsx
│       ├── PlayerSection.jsx
│       └── PickerSection.jsx
├── main.jsx
├── composition-root.js
├── presentation/
├── domain/
├── application/
├── infrastructure/
└── stylesheet/main.css
assets/
├── data/records.json
├── ico/
├── images/
├── mp3/
└── ogg/record_noise_loop.ogg
docs/
```

## レイヤー

| 層 | 主なファイル | 責務 |
| --- | --- | --- |
| Domain | `src/domain/record.js`、`record-catalog.js` | レコードと一覧のルール |
| Domain | `src/domain/record-selection.js`、`record-selection-policy.js` | フォーカス・確定選択状態とインデックス範囲、端循環ルール |
| Domain | `src/domain/playback-rate.js`、`playback-direction.js` | 再生速度・方向の値と切替ルール |
| Domain | `src/domain/playback-policy.js` | 回転角差・慣性しきい値の判定、角速度の時間正規化、再生速度との変換 |
| Domain | `src/domain/playback-session.js` | レコードID、再生秒数、ノイズ・ビジュアライザー設定の状態 |
| Domain | `src/domain/playback-timeline.js` | 再生位置の補正、ループ位置計算、副音源の方向・位相同期 |
| Application | `src/application/record-catalog-service.js` | レコード一覧の読み込みと集約への問い合わせ |
| Application | `src/application/record-selection-service.js` | 選択状態を初期化・更新しDomainルールを画面操作へ提供 |
| Application | `src/application/playback-service.js` | 状態復元、レコード選択、再生操作、保存の調停 |
| Infrastructure | `src/infrastructure/record-json-repository.js` | JSON取得 |
| Infrastructure | `src/infrastructure/playback-state-repository.js` | cookie保存・復元 |
| Infrastructure | `src/infrastructure/web-audio-engine.js` | Web Audio API、音声バッファ、正転・逆転再生、ノイズ同期、解析データ |
| Presentation | `src/presentation/splash-controller.js` | 初回音声許可、スプラッシュ表示、操作ロック |
| Presentation | `src/presentation/browser-interaction-controller.js` | ページ復元、プレーヤー／選択画面での自動再生可否確認、タッチジェスチャー、長押し制御 |
| Presentation | `src/presentation/record-player-controller.js` | 回転操作、表示、シーク、ラベル背景画像 |
| Presentation | `src/presentation/record-picker-controller.js` | 選択画面、カード操作、レコード情報表示 |
| Presentation | `src/presentation/text-reveal-controller.js` | 文字単位の表示アニメーション |
| Presentation | `src/presentation/menu-controller.js` | ヘッダーメニュー、メニューのスワイプ操作 |
| UI | `src/App.jsx`、`src/components/` | 画面構成、ヘッダー、各セクションのReact描画 |
| UI起動 | `src/main.jsx` | React root、スタイル読み込み、Composition Rootの起動 |
| Composition Root | `src/composition-root.js` | DDD依存関係の生成と接続 |

## 依存方向

Presentation Controllerはドメインルール、cookie実装、Web Audio実装に直接依存せず、`PlaybackService`と`RecordCatalogService`を`composition-root.js`から注入します。`PlaybackService`は音声エンジンと状態保存リポジトリを調停し、Controllerへ音声状態の読み取りと操作を提供します。`BrowserInteractionController`がページ復元、自動再生復帰の確認、ブラウザー操作の抑止を担当し、`SplashController`の音声有効化も`PlaybackService`経由にします。Composition Rootの`src/composition-root.js`は各Controllerとサービスの生成・配線を担います。`window.RecordPlayer`は従来の外部呼び出しとの互換用に、音源切り替え・再生位置取得・停止を公開します。

## データの流れ

1. Viteが`src/main.jsx`を読み込み、Reactが`src/App.jsx`の画面を描画する。
2. Reactの初回描画後、`src/composition-root.js`がcookieリポジトリ、Web Audio、アプリケーションサービス、各Controllerを生成する。
3. `SplashController`がスプラッシュを表示し、初回クリックで`PlaybackService`へ音声有効化を依頼する。
4. `RecordJsonRepository`が`assets/data/records.json`を読み込む。
5. `RecordCatalogService`が`RecordCatalog`を生成して内部に保持し、Presentation向けにレコード配列とID・位置による問い合わせを提供する。
6. `RecordPickerController`が`PlaybackService`へレコード選択ユースケースを依頼し、サービスが必要に応じて再生を停止・再生秒数を保存してから選択レコードの音源を読み込む。
   フォーカス位置と確定選択位置は`RecordSelection`が保持し、端循環先とインデックス範囲は`RecordSelectionPolicy`が決定する。
7. `RecordPickerController`がレコードの`imageUrl`を`RecordPlayerController`へ渡し、`#label`と`PagePlayer`の背景画像を更新する。
8. `WebAudioEngine`がレコード音声を取得・デコードし、ノイズON時は`assets/ogg/record_noise_loop.ogg`も同期再生する。
9. `PlaybackService`が`PlaybackSession`を更新し、`PlaybackStateRepository`へレコードID、再生秒数、ノイズ同期状態、ビジュアライザー描画状態の保存を依頼する。

## DDDルール

- `record-player-controller.js`はDOMイベント、表示更新、アニメーション制御だけを担当する。
- 再生速度の上限・下限、速度変更、方向反転、回転速度変換は`domain/`で扱う。
- 再生位置の補正と、方向・速度・経過時間に基づくループ位置計算、副音源の方向・位相同期は`PlaybackTimeline`へ集約する。
- 同じレコード再選択時の位置保持と別レコード選択時の位置初期化は`PlaybackSession`が決め、`PlaybackService`はその位置を音源へ渡す。
- ビジュアライザー設定の反転は`PlaybackSession`が行い、`PlaybackService`は変更後の値を保存する。
- レコード変更時の停止、再生位置の選択、音源切り替え、ノイズ状態の保存は`PlaybackService`で調停する。
- 角度境界での最短回転差補正、慣性の開始・停止しきい値、入力時間を正規化した角速度の算出、速度補間、回転方向から再生方向への変換、速度と回転割合の変換は`PlaybackPolicy`に集約する。
- 選択画面の端循環とプレーヤー画面からの隣接レコード循環は`RecordSelectionPolicy`に集約し、タッチ・マウスのジェスチャー閾値判定はControllerに残す。
- 選択・フォーカス位置の状態遷移と有効範囲補正は`RecordSelection`へ集約し、Controllerは状態を画面表示へ反映する。
- JSON、cookie、Web Audio APIへのアクセスは`infrastructure/`に限定する。
- `RecordCatalog`集約は`RecordCatalogService`内に保持し、Presentation Controllerは集約の検索・取得をサービス経由で行う。
- ReactコンポーネントはCSSとPresentation Controllerが参照するDOM ID・ARIA属性を維持する。DOMイベントを扱うControllerはReact描画後の画面ブリッジとして初期化する。

## cookie

| cookie | 内容 |
| --- | --- |
| `groove-record-index` | 選択レコードID |
| `groove-record-playback-seconds` | 音声ファイル上の再生秒数 |
| `groove-record-noise-enabled` | ノイズ同期のON/OFF |
| `groove-record-visualizer-enabled` | ビジュアライザー描画のON/OFF |

旧cookie`groove-record-playback-position`は再生秒数の読み込み時だけ互換対応します。
