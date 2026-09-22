// フェードアウトのCSS遷移時間（ms）。
const SPLASH_FADE_DURATION_MS = 350;

/** 初回操作で音声を有効化し、アプリ画面の操作ロックを解除するController。 */
export class SplashController {
    /** スプラッシュ操作に必要な音声サービス、Document、画面演出を受け取る。 */
    constructor({ playbackService, documentRef = document, onPlayerScreenShown = () => {} }) {
        // 音声有効化のユースケースを担当するアプリケーションサービス。
        this.playbackService = playbackService;
        // DOM参照とプレーヤー表示後に呼び出すテキスト演出処理。
        this.document = documentRef;
        this.onPlayerScreenShown = onPlayerScreenShown;
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
            await this.fadeOutSplash();
            this.splashScreen.hidden = true;
            this.setApplicationLocked(false);
            this.startButton.disabled = false;
            this.onPlayerScreenShown();
        } catch {
            this.startButton.disabled = false;
            this.splashStatus.textContent = 'Tap to try again.';
        }
    }

    /** CSSのフェードアウト完了を待ち、遷移イベント未発火時は時間で完了させる。 */
    fadeOutSplash() {
        return new Promise((resolve) => {
            let isCompleted = false;
            let fallbackTimer = null;
            const complete = () => {
                if (isCompleted) return;
                isCompleted = true;
                if (fallbackTimer !== null) globalThis.clearTimeout(fallbackTimer);
                this.splashScreen.removeEventListener?.('transitionend', handleTransitionEnd);
                resolve();
            };
            const handleTransitionEnd = (event) => {
                if (event.target === this.splashScreen && event.propertyName === 'opacity') complete();
            };

            this.splashScreen.addEventListener('transitionend', handleTransitionEnd);
            this.splashScreen.classList.add('is-closing');
            fallbackTimer = globalThis.setTimeout(complete, SPLASH_FADE_DURATION_MS + 100);
        });
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
