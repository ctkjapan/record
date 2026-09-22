import { RecordCatalogService } from './application/record-catalog-service.js';
import { PlaybackService } from './application/playback-service.js';
import { RecordSelectionService } from './application/record-selection-service.js';
import { PlaybackStateRepository } from './infrastructure/playback-state-repository.js';
import { RecordJsonRepository } from './infrastructure/record-json-repository.js';
import { WebAudioEngine } from './infrastructure/web-audio-engine.js';
import { RecordPickerController } from './presentation/record-picker-controller.js';
import { RecordPlayerController } from './presentation/record-player-controller.js';
import { SplashController } from './presentation/splash-controller.js';
import { MenuController } from './presentation/menu-controller.js';
import { TextRevealController } from './presentation/text-reveal-controller.js';
import { BrowserInteractionController } from './presentation/browser-interaction-controller.js';

// 全レコードに重ねて再生するノイズ音源。
const RECORD_NOISE_SOURCE = './assets/ogg/record_noise_loop.ogg';

/** React画面のDOMが描画された後にDDD層と画面Controllerを初期化する。 */
export function initializeApplication() {
    // ヘッダーメニューの開閉Controllerを初期化する。
    const menuController = new MenuController();
    menuController.initialize();
    // 初回表示テキストを文字単位でアニメーションするController。
    const textRevealController = new TextRevealController();
    textRevealController.initialize();

    // cookieを介して選択レコードと再生秒数を永続化する実装。
    const playbackStateRepository = new PlaybackStateRepository();
    const audioEngine = new WebAudioEngine({ noiseSourceUrl: RECORD_NOISE_SOURCE });
    const playbackService = new PlaybackService({ audioEngine, playbackStateRepository });
    // ブラウザー固有のページ復元・ジェスチャー・自動再生復帰を制御する。
    const browserInteractionController = new BrowserInteractionController({
        playbackService,
        playerPanel: document.querySelector('#playerPanel'),
        pickerPanel: document.querySelector('#pickerPanel'),
    });
    browserInteractionController.initialize();
    // 音声再生とプレーヤー画面を接続するController。
    const playerController = new RecordPlayerController({ playbackService });
    playerController.initialize();
    // 初回ユーザー操作で音声を有効化するスプラッシュController。
    const splashController = new SplashController({
        playbackService,
        onPlayerScreenShown: () => textRevealController.onPlayerScreenShown(),
    });
    splashController.initialize();
    window.RecordPlayer = Object.freeze({
        // 既存の外部呼び出し向けに、音源切り替えAPIだけを公開する。
        setAudioSource: (...args) => playerController.setAudioSource(...args),
        // cookieに保存された再生秒数を返す。
        getStoredPlaybackSeconds: () => playerController.getStoredPlaybackSeconds(),
        // 再生と慣性回転を停止する。
        stop: () => playerController.stop(),
    });

    // JSONからレコード一覧を取得するアプリケーションサービス。
    const recordCatalogService = new RecordCatalogService(new RecordJsonRepository('./assets/data/records.json'));
    // Domain選択、Catalog照会、選択レコードの再生切替を調停するアプリケーションサービス。
    const recordSelectionService = new RecordSelectionService({ recordCatalogService, playbackService });
    // 選択画面とプレーヤーControllerを依存性注入で接続する。
    const pickerController = new RecordPickerController({
        recordCatalogService,
        recordSelectionService,
        playerController,
        playbackService,
        openMenu: () => menuController.open(),
        textRevealController,
    });
    pickerController.initialize();
}
