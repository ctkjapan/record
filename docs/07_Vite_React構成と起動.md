# Vite + React構成と起動

## 必要環境

- Node.js 20.19以上、または22.12以上（`package.json`の`engines`参照）
- npm

## コマンド

```sh
npm install
npm run dev
```

| コマンド | 役割 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番成果物を`dist/`へ生成 |
| `npm run preview` | 本番成果物をローカルで確認 |
| `npm run deploy` | `dist/`をGitHub Pagesへ公開。先にビルドする |
| `npm test` | JavaScript DDD回帰テストを実行 |

## 画面構成

- `index.html`はViteのエントリーポイントで、`#root`を提供します。
- `src/main.jsx`がReact rootと`src/stylesheet/main.css`を読み込みます。Reactの描画後に`initializeApplication()`を実行します。
- `src/App.jsx`がヘッダーと画面セクションを組み立てます。各コンポーネントの対応表は[画面構成](01_画面構成.md)を参照してください。
- `src/composition-root.js`がApplication、Infrastructure、Presentationの依存関係を生成して接続します。
- 既存のDOMイベントControllerは`src/presentation/`に置き、React描画後の画面ブリッジとして使用します。画面を描画する責務はReactコンポーネントが持ちます。

## 静的アセットと公開パス

`vite.config.js`の`base`は`/record/`です。Viteの本番ビルド時、同設定のプラグインが`assets/data`、`assets/ico`、`assets/images`、`assets/mp3`、`assets/ogg`を`dist/assets/`へコピーします。JSON内の画像・音声URLとノイズ音源URLは、公開後も`assets/...`のパスで参照します。
