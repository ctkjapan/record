import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const staticAssetDirectories = ['data', 'ico', 'images', 'mp3', 'ogg'];

function copyPlayerAssets() {
    let outputDirectory;

    return {
        name: 'copy-player-assets',
        apply: 'build',
        configResolved(config) {
            outputDirectory = resolve(config.root, config.build.outDir, 'assets');
        },
        async closeBundle() {
            await mkdir(outputDirectory, { recursive: true });
            await Promise.all(
                staticAssetDirectories.map((directory) =>
                    cp(resolve(projectRoot, 'assets', directory), resolve(outputDirectory, directory), { recursive: true }),
                ),
            );
        },
    };
}

export default defineConfig({
    plugins: [react(), copyPlayerAssets()],
    publicDir: false,
});
