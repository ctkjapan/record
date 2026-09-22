# VINYL ドキュメント

画面・再生・選択の仕様、ソース構成、実行方法を機能別にまとめています。実装の最新状態と異なる記述を見つけた場合は、対応する機能資料とソースを照合してください。

## 仕様・開発資料

- [画面構成](01_画面構成.md)
- [レコード再生・回転操作](02_レコード再生.md)
- [レコード選択](03_レコード選択.md)
- [レスポンシブ・アクセシビリティ](04_レスポンシブとアクセシビリティ.md)
- [JavaScript DDD構成](05_JavaScript_DDD構成.md)
- [JavaScript DDD回帰テスト](06_JavaScript_DDD回帰テスト.md)
- [Vite + React構成と起動](07_Vite_React構成と起動.md)

## ソース案内

| パス | 役割 |
| --- | --- |
| `index.html` | ViteエントリーとReact root |
| `src/App.jsx` | 画面コンポーネントの組み立て |
| `src/components/TopBar.jsx` | ヘッダーとメニュー |
| `src/components/sections/` | スプラッシュ、プレーヤー、レコード選択の画面 |
| `src/main.jsx` | React root、CSS読み込み、アプリ起動 |
| `src/stylesheet/main.css` | レイアウト、色、アニメーション、レスポンシブ表示 |
| `src/presentation/` | DOMイベントと画面表示を担当するController |
| `src/domain/` | レコード、選択、再生の業務ルール |
| `src/application/` | レコード・再生ユースケース |
| `src/infrastructure/` | JSON、cookie、Web Audio APIの実装 |
| `src/composition-root.js` | 各層と画面Controllerの生成・接続 |
| `assets/data/records.json` | レコード定義と表示・音声・画像の参照元 |
| `assets/images/`、`assets/mp3/`、`assets/ogg/` | ラベル画像、楽曲、同期ノイズ音源 |
| `vite.config.js` | GitHub Pagesのベースパスと静的ファイル出力 |

## 基本情報

- 文書言語：日本語（`lang="ja"`）
- アプリ名：VINYL
- 音声：Web Audio API（`fetch`と`decodeAudioData`）
- 保存：選択レコードID、再生秒数、ノイズ、ビジュアライザー状態をcookieへ保存
- 外部フォント：Google FontsのDM Mono、Space Grotesk
- サーバーAPI：なし
