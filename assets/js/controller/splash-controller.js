/** 初回操作で音声を有効化し、アプリ画面の操作ロックを解除するController。 */
export class SplashController {
    constructor({ playbackService, documentRef = document }) {
        // 音声有効化のユースケースを担当するアプリケーションサービス。
        this.playbackService = playbackService;
        this.document = documentRef;
        // スプラッシュ画面と開始ボタンのDOM要素。
        this.splashScreen = this.document.querySelector('#splashScreen');
        this.startButton = this.document.querySelector('#splashStartButton');
        this.splashStatus = this.document.querySelector('#splashStatus');
        // スプラッシュ表示中に操作を制限するアプリ領域。
        this.lockedElements = [this.document.querySelector('header'), this.document.querySelector('main')];
    }

    /** スプラッシュを表示し、開始操作を登録する。 */
    initialize() {
        if (!this.splashScreen || !this.startButton) return;
        this.document.body.classList.add('is-splash-visible');
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
            await this.playbackService.activateAudio();
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
        this.document.body.classList.toggle('is-splash-visible', isLocked);
    }
}
