# VINYL

ブラウザー上でレコードを回して音楽を楽しむ、Web Audioプレーヤーです。画面はViteとReactで描画し、再生・選択のルールはDDDの各層に分けています。

## 起動

Node.js 20.19以上、または22.12以上を使います。

```sh
npm install
npm run dev
```

本番成果物は`npm run build`で`dist/`へ作成します。`npm run preview`で確認できます。GitHub Pagesへ公開する場合は、ビルド後に`npm run deploy`を実行します。

回帰テストは`npm test`で実行できます。

## 主な操作

| 操作 | 動作 |
| --- | --- |
| `TAP TO START` | 音声を有効にしてプレーヤーを開く |
| `menuButton` | ヘッダーメニューを開閉する。`Escape`で閉じる |
| レコードをドラッグ／矢印キー | レコードを回して再生する |
| メニューの再生速度ボタン | 速度を1.0倍に戻す、0.1倍ずつ調整、正逆を切り替える |
| `noiseButton` | ノイズの同期再生を切り替える |
| `visualizerButton` | ビジュアライザーを切り替える |
| `changeButton`（Choose your vinyl.） | レコード選択画面を開く |
| プレーヤーステージを上／下へスワイプ | 上でメニューを開き、下でレコード選択画面を開く |
| プレーヤーステージを左／右へスワイプ | 左で次、右で前のレコードへ切り替える。端では反対端へ循環する |
| レコードカードを左右にスワイプ | 一覧を移動する。先頭・末尾では反対端へ循環する |
| 中央のレコード盤をクリック | レコードを選択してプレーヤーへ戻る |

## 構成

- `src/App.jsx`が`SplashSection`、`TopBar`、`PlayerSection`、`PickerSection`を組み立てます。
- `src/presentation/`がDOMイベントと画面表示を担当し、`src/domain/`と`src/application/`へ再生・選択ルールを委譲します。
- `src/infrastructure/`がJSON、cookie、Web Audio APIを扱います。`src/stylesheet/main.css`がスタイルを定義します。
- レコード情報と音声・画像などの静的ファイルは`assets/`にあります。

詳しい操作仕様、DDD構成、テスト範囲は[ドキュメント一覧](docs/README.md)を参照してください。
