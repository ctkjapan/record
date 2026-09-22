// ブラウザー履歴操作を識別する画面端の保護幅（px）。
const EDGE_SWIPE_GUARD_PX = 32;

/** ブラウザー固有のページ復元とジェスチャー抑止を担当するPresentation Controller。 */
export class BrowserInteractionController {
    constructor({ windowRef = window, documentRef = document, ElementClass = Element, playbackService = null, playerPanel = null } = {}) {
        this.window = windowRef;
        this.document = documentRef;
        this.ElementClass = ElementClass;
        this.playbackService = playbackService;
        this.playerPanel = playerPanel;
    }

    /** ページ復元、タッチジェスチャー、長押しのブラウザー操作を制御する。 */
    initialize() {
        this.reloadRestoredPage();
        this.reloadWhenAutoplayIsUnavailable();
        this.preventMobileBrowserGestures();
        this.preventLongPress();
    }

    /** ブラウザーによるページ復元時に状態を初期化するためリロードする。 */
    reloadRestoredPage() {
        this.window.addEventListener('pageshow', (event) => {
            if (event.persisted || this.document.wasDiscarded === true) this.window.location.reload();
        });
    }

    /** プレーヤー表示中にバックグラウンドから戻り、自動再生不可ならリロードする。 */
    reloadWhenAutoplayIsUnavailable() {
        if (!this.playbackService || !this.playerPanel) return;
        let wasHidden = this.document.hidden === true;
        this.document.addEventListener('visibilitychange', async () => {
            if (this.document.hidden) {
                wasHidden = true;
                return;
            }
            if (!wasHidden) return;
            wasHidden = false;
            if (this.playerPanel.hidden) return;
            if (!(await this.playbackService.isAutoplayAllowed())) this.window.location.reload();
        });
    }

    /** プルダウン更新と左右端からの履歴スワイプを無効化する。 */
    preventMobileBrowserGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartedAtEdge = false;

        // タッチ開始位置を記録し、横方向の選択操作と判定できるようにする。
        this.document.addEventListener(
            'touchstart',
            (event) => {
                if (event.touches.length !== 1) return;
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                touchStartedAtEdge = touchStartX <= EDGE_SWIPE_GUARD_PX || touchStartX >= this.window.innerWidth - EDGE_SWIPE_GUARD_PX;
            },
            { passive: true },
        );

        // 最上部での下方向スワイプだけをキャンセルする。
        this.document.addEventListener(
            'touchmove',
            (event) => {
                if (event.touches.length !== 1) return;
                const deltaX = event.touches[0].clientX - touchStartX;
                const deltaY = event.touches[0].clientY - touchStartY;
                const isBackSwipe = touchStartX <= EDGE_SWIPE_GUARD_PX && deltaX > 0;
                const isForwardSwipe = touchStartX >= this.window.innerWidth - EDGE_SWIPE_GUARD_PX && deltaX < 0;
                if (touchStartedAtEdge && Math.abs(deltaX) > Math.abs(deltaY) && (isBackSwipe || isForwardSwipe)) {
                    if (event.cancelable) event.preventDefault();
                    return;
                }
                if (this.window.scrollY > 0) return;
                if (deltaY > 0 && deltaY > Math.abs(deltaX) && event.cancelable) event.preventDefault();
            },
            { passive: false },
        );
    }

    /** タップ長押しによるコンテキストメニューとドラッグ開始を無効化する。 */
    preventLongPress() {
        this.document.addEventListener('contextmenu', (event) => {
            if (event.target instanceof this.ElementClass) event.preventDefault();
        });
        this.document.addEventListener('dragstart', (event) => event.preventDefault());
    }
}
