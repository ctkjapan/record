// ブラウザー履歴操作を識別する画面端の保護幅（px）。
const EDGE_SWIPE_GUARD_PX = 32;

/** ブラウザー固有のページ復元とジェスチャー抑止を担当するPresentation Controller。 */
export class BrowserInteractionController {
    constructor({ windowRef = window, documentRef = document, ElementClass = Element, MutationObserverClass = globalThis.MutationObserver, playbackService = null, playerPanel = null, pickerPanel = null } = {}) {
        this.window = windowRef;
        this.document = documentRef;
        this.ElementClass = ElementClass;
        this.MutationObserverClass = MutationObserverClass;
        this.playbackService = playbackService;
        this.playerPanel = playerPanel;
        this.pickerPanel = pickerPanel;
        this.autoplayCheckPending = false;
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

    /** プレーヤー／選択画面で自動再生権限が失われた場合にリロードする。 */
    reloadWhenAutoplayIsUnavailable() {
        if (!this.playbackService || (!this.playerPanel && !this.pickerPanel)) return;

        const checkPermission = () => this.checkAutoplayPermission();
        this.document.addEventListener('visibilitychange', () => {
            if (!this.document.hidden) return checkPermission();
        });
        this.window.addEventListener('focus', checkPermission);

        if (this.MutationObserverClass) {
            this.screenObserver = new this.MutationObserverClass(checkPermission);
            [this.playerPanel, this.pickerPanel].filter(Boolean).forEach((panel) => {
                this.screenObserver.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
            });
        }
    }

    /** 対象画面が表示されている間だけ自動再生可否を調べる。 */
    async checkAutoplayPermission() {
        const isSupportedScreenVisible = [this.playerPanel, this.pickerPanel].some((panel) => panel && !panel.hidden);
        if (this.document.hidden || !isSupportedScreenVisible || this.autoplayCheckPending) return;
        this.autoplayCheckPending = true;
        try {
            let isAutoplayAllowed = false;
            try {
                isAutoplayAllowed = await this.playbackService.isAutoplayAllowed();
            } catch {
                // 判定不能時も権限を利用できない状態としてページを初期化する。
            }
            if (!isAutoplayAllowed) this.window.location.reload();
        } finally {
            this.autoplayCheckPending = false;
        }
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
