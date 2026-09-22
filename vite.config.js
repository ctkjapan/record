import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ビルド後の静的アセットを特定するためのプロジェクトルート。
const projectRoot = fileURLToPath(new URL('.', import.meta.url));
// ViteのpublicDir外からdistへコピーするプレーヤー用アセット群。
const staticAssetDirectories = ['data', 'ico', 'images', 'mp3', 'ogg'];

/** build完了後に静的アセットを出力先のassets配下へ複製するViteプラグインを返す。 */
function copyPlayerAssets() {
    // Vite設定確定後に決まるbuild出力先。
    let outputDirectory;

    return {
        name: 'copy-player-assets',
        apply: 'build',
        // Vite設定確定後に実際のbuild出力先を取得する。
        configResolved(config) {
            outputDirectory = resolve(config.root, config.build.outDir, 'assets');
        },
        // コピー先を作り、対象アセットディレクトリを並行して複製する。
        async closeBundle() {
            await mkdir(outputDirectory, { recursive: true });
            await Promise.all(staticAssetDirectories.map((directory) => cp(resolve(projectRoot, 'assets', directory), resolve(outputDirectory, directory), { recursive: true })));
        },
    };
}

export default defineConfig({
    // アプリを /record/ パス配下で配信する。
    base: '/record/', 
    // Reactプラグインと静的アセット複製プラグインを有効にする。
    plugins: [react(), copyPlayerAssets()],
    // Vite標準のpublicディレクトリを使わず、上記フックでアセットを配置する。
    publicDir: false,
});
