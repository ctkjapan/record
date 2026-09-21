/** ヘッダーメニューの開閉とキーボード操作を担当するController。 */
export class MenuController {
    constructor() {
        // メニューを開閉するボタンと表示領域。
        this.menuButton = document.querySelector('#menuButton');
        this.menuPanel = document.querySelector('#menuPanel');
        this.pageBody = document.body;
        this.isClosing = false;
    }

    /** メニュー操作のイベントを初期化する。 */
    initialize() {
        if (!this.menuButton || !this.menuPanel) return;
        this.menuButton.addEventListener('click', () => this.toggle());
        this.menuPanel.addEventListener('click', (event) => {
            if (event.target.closest('.close-menu')) this.close();
        });
        this.menuPanel.addEventListener('animationend', (event) => {
            if (event.target === this.menuPanel && event.animationName === 'dummy') this.finishClosing();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.close();
        });
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
        this.pageBody.classList.remove('menu-open');
        this.menuButton.setAttribute('aria-expanded', 'false');
        this.menuButton.setAttribute('aria-label', 'メニューを開く');
    }

    /** 閉じるアニメーション完了後にメニューを非表示にする。 */
    finishClosing() {
        this.menuPanel.hidden = true;
        this.menuPanel.classList.remove('is-closing');
        this.isClosing = false;
    }
}
