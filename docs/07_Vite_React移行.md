# Vite + React移行

## 起動

```sh
npm install
npm run dev
```

本番成果物は`npm run build`で`dist/`へ出力し、`npm run preview`で確認します。

## 構成

- `index.html`はViteのエントリーポイントです。
- `src/App.jsx`がプレーヤー・選択画面のDOMをReactで描画します。
- `src/main.jsx`がReact rootとスタイルを読み込み、画面表示後にアプリケーションを起動します。
- `src/composition-root.js`はComposition Rootとして既存DDD層を生成・接続します。
- `src/domain/`と`src/application/`の再生・選択ルールを維持します。
- DOMイベント、Canvas、Web Audioの既存ControllerとAdapterは段階移行用ブリッジとして使用しています。
- `vite.config.js`は`assets/data`、`assets/images`、`assets/mp3`、`assets/ogg`、`assets/ico`を元の`/assets/...` URLのまま本番成果物へコピーします。

## Node.js

Viteの実行にはNode.js 20.19以上、または22.12以上が必要です。
