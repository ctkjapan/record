const MENU_SWIPE_THRESHOLD = 48;

/** ヘッダーメニューの開閉とキーボード操作を担当するController。 */
export class MenuController {
    constructor() {
        // メニューを開閉するボタンと表示領域。
        this.menuButton = document.querySelector('#menuButton');
        this.menuPanel = document.querySelector('#menuPanel');
        this.pageBody = document.body;
        this.isClosing = false;
        // メニュー上のポインター／タッチスワイプ判定用状態。
        this.menuPointerId = null;
        this.menuPointerStartX = 0;
        this.menuPointerStartY = 0;
        this.menuTouchIdentifier = null;
        this.menuTouchStartX = 0;
        this.menuTouchStartY = 0;
    }

    /** メニュー操作のイベントを初期化する。 */
    initialize() {
        if (!this.menuButton || !this.menuPanel) return;
        this.menuButton.addEventListener('click', () => this.toggle());
        this.menuPanel.addEventListener('click', (event) => {
            if (event.target.closest('.close-menu')) this.close();
        });
        this.menuPanel.addEventListener('animationend', (event) => {
            if (event.target === this.menuPanel && event.animationName === 'menu-zoom-in') this.finishClosing();
        });
        this.menuPanel.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
        this.menuPanel.addEventListener('pointermove', (event) => this.handlePointerMove(event));
        this.menuPanel.addEventListener('pointerup', (event) => this.releasePointer(event));
        this.menuPanel.addEventListener('pointercancel', (event) => this.releasePointer(event));
        this.menuPanel.addEventListener('touchstart', (event) => this.handleTouchStart(event), { passive: true });
        this.menuPanel.addEventListener('touchmove', (event) => this.handleTouchMove(event), { passive: false });
        this.menuPanel.addEventListener('touchend', (event) => this.releaseTouch(event), { passive: false });
        this.menuPanel.addEventListener('touchcancel', (event) => this.releaseTouch(event), { passive: false });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.close();
        });
    }

    /** マウスまたはペンによるメニュー上のスワイプを開始する。 */
    handlePointerDown(event) {
        if (event.pointerType === 'touch' || (event.pointerType === 'mouse' && event.button !== 0)) return;
        this.menuPointerId = event.pointerId;
        this.menuPointerStartX = event.clientX;
        this.menuPointerStartY = event.clientY;
    }

    /** メニュー上のポインター移動時に標準スクロールを抑制する。 */
    handlePointerMove(event) {
        if (event.pointerId !== this.menuPointerId) return;
        const deltaX = event.clientX - this.menuPointerStartX;
        const deltaY = event.clientY - this.menuPointerStartY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8 && event.cancelable) event.preventDefault();
    }

    /** 上方向のポインタースワイプでメニューを閉じる。 */
    releasePointer(event) {
        if (event.pointerId !== this.menuPointerId) return;
        const deltaX = event.clientX - this.menuPointerStartX;
        const deltaY = event.clientY - this.menuPointerStartY;
        this.menuPointerId = null;
        if (event.type === 'pointerup' && this.isUpSwipe(deltaX, deltaY)) {
            if (event.cancelable) event.preventDefault();
            this.close();
        }
    }

    /** タッチ開始位置を記録する。 */
    handleTouchStart(event) {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        this.menuTouchIdentifier = touch.identifier;
        this.menuTouchStartX = touch.clientX;
        this.menuTouchStartY = touch.clientY;
    }

    /** タッチ移動時に標準スクロールを抑制する。 */
    handleTouchMove(event) {
        const touch = Array.from(event.touches).find(({ identifier }) => identifier === this.menuTouchIdentifier);
        if (!touch) return;
        const deltaX = touch.clientX - this.menuTouchStartX;
        const deltaY = touch.clientY - this.menuTouchStartY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8 && event.cancelable) event.preventDefault();
    }

    /** 上方向のタッチスワイプでメニューを閉じる。 */
    releaseTouch(event) {
        if (this.menuTouchIdentifier === null) return;
        const touch = Array.from(event.changedTouches).find(({ identifier }) => identifier === this.menuTouchIdentifier);
        if (!touch) return;
        const deltaX = touch.clientX - this.menuTouchStartX;
        const deltaY = touch.clientY - this.menuTouchStartY;
        this.menuTouchIdentifier = null;
        if (event.type === 'touchend' && this.isUpSwipe(deltaX, deltaY)) {
            if (event.cancelable) event.preventDefault();
            this.close();
        }
    }

    /** 上方向かつ規定距離以上のスワイプか判定する。 */
    isUpSwipe(deltaX, deltaY) {
        return deltaY <= -MENU_SWIPE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX);
    }

    /** メニューの表示状態を反転する。 */
    toggle() {
        if (this.menuPanel.hidden) {
            this.open();
            return;
        }
        this.close();
    }

    /** メニューを表示し、ボタンのアクセシビリティ状態を更新する。 */
    open() {
        this.isClosing = false;
        this.menuPanel.classList.remove('is-closing');
        this.menuPanel.hidden = false;
        this.pageBody.classList.add('menu-open');
        this.menuButton.setAttribute('aria-expanded', 'true');
        this.menuButton.setAttribute('aria-label', 'メニューを閉じる');
    }

    /** メニューを非表示にし、ボタンのアクセシビリティ状態を更新する。 */
    close() {
        if (!this.menuPanel || this.menuPanel.hidden || this.isClosing) return;
        this.isClosing = true;
        this.menuPanel.classList.add('is-closing');
        this.menuButton.setAttribute('aria-expanded', 'false');
        this.menuButton.setAttribute('aria-label', 'メニューを開く');
    }

    /** 閉じるアニメーション完了後にメニューを非表示にする。 */
    finishClosing() {
        this.menuPanel.hidden = true;
        this.menuPanel.classList.remove('is-closing');
        this.pageBody.classList.remove('menu-open');
        this.isClosing = false;
    }
}
