/** 初回操作で音声を有効化し、アプリ画面の操作ロックを解除するController。 */
export class SplashController {
    constructor({ audioEngine }) {
        // ユーザー操作でアンロックする音声エンジン。
        this.audioEngine = audioEngine;
        // スプラッシュ画面と開始ボタンのDOM要素。
        this.splashScreen = document.querySelector('#splashScreen');
        this.startButton = document.querySelector('#splashStartButton');
        this.splashStatus = document.querySelector('#splashStatus');
        // スプラッシュ表示中に操作を制限するアプリ領域。
        this.lockedElements = [document.querySelector('header'), document.querySelector('main')];
    }

    /** スプラッシュを表示し、開始操作を登録する。 */
    initialize() {
        if (!this.splashScreen || !this.startButton) return;
        document.body.classList.add('is-splash-visible');
        this.setApplicationLocked(true);
        this.startButton.addEventListener('click', () => this.startApplication());
        this.startButton.focus({ preventScroll: true });
    }

    /** ユーザー操作でAudioContextをアンロックしてアプリを開始する。 */
    async startApplication() {
        if (this.startButton.disabled) return;
        this.startButton.disabled = true;
        this.splashStatus.textContent = 'STARTING...';
        try {
            await this.audioEngine.unlock();
            this.setApplicationLocked(false);
            this.splashScreen.hidden = true;
            this.startButton.disabled = false;
        } catch {
            this.startButton.disabled = false;
            this.splashStatus.textContent = 'Tap to try again.';
        }
    }

    /** アプリ領域をinertにして、スプラッシュ解除前の操作を防止する。 */
    setApplicationLocked(isLocked) {
        this.lockedElements.forEach((element) => {
            if (!element) return;
            element.toggleAttribute('inert', isLocked);
        });
        document.body.classList.toggle('is-splash-visible', isLocked);
    }
}
