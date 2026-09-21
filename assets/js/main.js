import { RecordCatalogService } from './application/record-catalog-service.js';
import { PlaybackService } from './application/playback-service.js';
import { PlaybackStateRepository } from './infrastructure/playback-state-repository.js';
import { RecordJsonRepository } from './infrastructure/record-json-repository.js';
import { WebAudioEngine } from './infrastructure/web-audio-engine.js';
import { RecordPickerController } from './controller/record-picker-controller.js';
import { RecordPlayerController } from './controller/record-player-controller.js';
import { SplashController } from './controller/splash-controller.js';
import { MenuController } from './controller/menu-controller.js';
import { TextRevealController } from './controller/text-reveal-controller.js';

// ブラウザの履歴スワイプと判定する画面端からの保護幅（px）。
const EDGE_SWIPE_GUARD_PX = 32;

/** ブラウザによるページ復元時に状態を初期化するためリロードする。 */
function reloadRestoredPage() {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted || document.wasDiscarded === true) window.location.reload();
    });
}

/** プルダウン更新と左右端からの履歴スワイプを無効化する。 */
function preventMobileBrowserGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartedAtEdge = false;

    // タッチ開始位置を記録し、横方向の選択操作と判定できるようにする。
    document.addEventListener(
        'touchstart',
        (event) => {
            if (event.touches.length !== 1) return;
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            touchStartedAtEdge = touchStartX <= EDGE_SWIPE_GUARD_PX || touchStartX >= window.innerWidth - EDGE_SWIPE_GUARD_PX;
        },
        { passive: true },
    );

    // 最上部での下方向スワイプだけをキャンセルする。
    document.addEventListener(
        'touchmove',
        (event) => {
            if (event.touches.length !== 1) return;
            const deltaX = event.touches[0].clientX - touchStartX;
            const deltaY = event.touches[0].clientY - touchStartY;
            const isBackSwipe = touchStartX <= EDGE_SWIPE_GUARD_PX && deltaX > 0;
            const isForwardSwipe = touchStartX >= window.innerWidth - EDGE_SWIPE_GUARD_PX && deltaX < 0;
            if (touchStartedAtEdge && Math.abs(deltaX) > Math.abs(deltaY) && (isBackSwipe || isForwardSwipe)) {
                if (event.cancelable) event.preventDefault();
                return;
            }
            if (window.scrollY > 0) return;
            if (deltaY > 0 && deltaY > Math.abs(deltaX) && event.cancelable) event.preventDefault();
        },
        { passive: false },
    );
}

/** タップ長押しによるコンテキストメニューとドラッグ開始を無効化する。 */
function preventLongPress() {
    document.addEventListener('contextmenu', (event) => {
        if (event.target instanceof Element) event.preventDefault();
    });
    document.addEventListener('dragstart', (event) => event.preventDefault());
}

reloadRestoredPage();
preventMobileBrowserGestures();
preventLongPress();

// ヘッダーメニューの開閉Controllerを初期化する。
const menuController = new MenuController();
menuController.initialize();
// 初回表示テキストを文字単位でアニメーションするController。
const textRevealController = new TextRevealController();
textRevealController.initialize();

// レコード一覧JSONの公開URL。
const RECORDS_LIST = '../data/records.json';
// 全レコードに重ねて再生するノイズ音源。
const RECORD_NOISE_SOURCE = 'assets/ogg/record_noise_loop.ogg';

// cookieを介して選択レコードと再生秒数を永続化する実装。
const playbackStateRepository = new PlaybackStateRepository();
const audioEngine = new WebAudioEngine({ noiseSourceUrl: RECORD_NOISE_SOURCE, noiseEnabled: false });
const playbackService = new PlaybackService({ audioEngine, playbackStateRepository });
// 音声再生とプレーヤー画面を接続するController。
const playerController = new RecordPlayerController({
    audioEngine,
    playbackService,
});
playerController.initialize();
// 初回ユーザー操作で音声を有効化するスプラッシュController。
const splashController = new SplashController({ audioEngine: playerController.audioEngine });
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
const recordCatalogService = new RecordCatalogService(new RecordJsonRepository(new URL(RECORDS_LIST, import.meta.url)));
// 選択画面とプレーヤーControllerを依存性注入で接続する。
const pickerController = new RecordPickerController({
    recordCatalogService,
    playerController,
    playbackService,
    openMenu: () => menuController.open(),
    textRevealController,
});
pickerController.initialize();
