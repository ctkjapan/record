// レコード回転から再生速度を計算するためのドメインルール設定。
const ATTENUATION_RATE = 1;
const MIN_PLAYBACK_RATE = 0;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_SMOOTHING = 0.1;
const ROTATION_SPEED_SCALE = 8;
const MIN_CENTER = 45;
const MAX_CENTER = 55;

/** レコード回転の入力を音声エンジンとプレーヤー表示へ反映するPresentation Controller。 */
export class RecordPlayerController {
    constructor({ audioEngine, playbackStateRepository }) {
        // 音声再生と保存処理を担当する依存オブジェクト。
        this.audioEngine = audioEngine;
        this.playbackStateRepository = playbackStateRepository;
        // プレーヤー画面のDOM要素。
        this.record = document.querySelector('#record');
        this.playState = document.querySelector('#playState');
        this.audioTime = document.querySelector('#audioTime');
        this.audioSeek = document.querySelector('#audioSeek');
        this.playbackRateValue = document.querySelector('#playbackRateValue');
        this.angleValue = document.querySelector('#angleValue');
        this.meterFill = document.querySelector('#meterFill');
        this.visualizerCanvas = document.querySelector('#visualizer');
        this.visualizerContext = this.visualizerCanvas?.getContext('2d');
        this.pageBody = document.body;
        // 回転操作とポインター入力の状態。
        this.rotation = 0;
        this.previousAngle = null;
        this.pointerId = null;
        this.lastMoveTime = 0;
        this.velocity = 0;
        // アニメーションフレームとシーク入力の状態。
        this.momentumFrame = null;
        this.playbackRateFrame = null;
        this.targetPlaybackRate = 0;
        this.isAudioPlaying = false;
        this.isSeeking = false;
        this.pendingSeekSeconds = 0;
        this.audioTimeFrame = null;
        this.visualizerFrame = null;
        // 表示更新の重複を抑えるための前回値。
        this.lastPlaybackCookieSaveAt = 0;
        this.lastAudioTimeLabel = '';
        this.lastPlaybackRateLabel = '';
        this.lastPlayStateLabel = '';
        this.lastAudioBusyState = null;

        // 音声エンジンからのロード状態を画面へ中継する。
        this.audioEngine.setCallbacks({
            onLoadingProgress: (progress) => this.updateAudioLoadProgress(progress),
            onLoadingStateChange: (isLoading) => this.setLoadingState(isLoading),
            onError: (error) => this.handleAudioError(error),
        });
    }

    /** DOMイベントとページ離脱時の保存処理を初期化する。 */
    initialize() {
        this.bindEvents();
        window.addEventListener('pagehide', () => this.persistPlaybackSeconds(true));
        this.setRotation(0);
        this.updateAudioTime();
        this.updatePlaybackRateLabel();
    }

    /** 音声エンジンへ音源URLと初期再生秒数を渡す。 */
    setAudioSource(sourceUrl, initialSeconds = 0) {
        return this.audioEngine.setSource(sourceUrl, initialSeconds);
    }

    /** 保存済みの再生秒数を取得する。 */
    getStoredPlaybackSeconds() {
        return this.playbackStateRepository.load().playbackSeconds;
    }

    /** 慣性回転・再生を停止し、現在の再生秒数を保存する。 */
    stop() {
        this.stopMomentum();
        this.updatePlaying(false);
        this.persistPlaybackSeconds(true);
    }

    /** レコード回転、シーク、キーボード操作のイベントを登録する。 */
    bindEvents() {
        this.record.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
        this.record.addEventListener('pointermove', (event) => this.handlePointerMove(event));
        this.record.addEventListener('pointerup', (event) => this.releasePointer(event));
        this.record.addEventListener('pointercancel', (event) => this.releasePointer(event));
        this.record.addEventListener('keydown', (event) => this.handleKeyDown(event));
        this.audioSeek.addEventListener('input', () => this.updateSeekPreview());
        this.audioSeek.addEventListener('change', () => this.commitSeek());
        this.audioSeek.addEventListener('keyup', (event) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) this.commitSeek();
        });
    }

    /** 現在秒数と総時間を表示し、シークバーの範囲を更新する。 */
    updateAudioTime() {
        const seconds = this.isSeeking ? this.pendingSeekSeconds : this.audioEngine.getCurrentSeconds();
        const nextLabel = `${this.formatTime(seconds)} / ${this.formatTime(this.audioEngine.duration)}`;
        if (nextLabel !== this.lastAudioTimeLabel) {
            this.audioTime.textContent = nextLabel;
            this.lastAudioTimeLabel = nextLabel;
        }
        this.audioSeek.max = String(this.audioEngine.duration);
        this.audioSeek.disabled = this.audioEngine.duration <= 0;
        if (!this.isSeeking) this.audioSeek.value = String(Math.min(seconds, this.audioEngine.duration));
    }

    /** 現在の再生速度を画面へ表示する。 */
    updatePlaybackRateLabel() {
        const nextLabel = `${this.audioEngine.playbackRate.toFixed(2)}x`;
        if (nextLabel === this.lastPlaybackRateLabel) return;
        this.playbackRateValue.textContent = nextLabel;
        this.lastPlaybackRateLabel = nextLabel;
    }

    /** ロード中／再生中／待機中の状態表示とaria-busyを更新する。 */
    updatePlayState() {
        const nextLabel = this.audioEngine.isLoading ? `LOADING AUDIO ${this.audioEngine.audioLoadProgress}%` : this.isAudioPlaying ? 'NOW SPINNING' : 'READY TO SPIN';
        if (nextLabel !== this.lastPlayStateLabel) {
            this.playState.textContent = nextLabel;
            this.lastPlayStateLabel = nextLabel;
        }
        const nextBusyState = String(this.audioEngine.isLoading);
        if (nextBusyState !== this.lastAudioBusyState) {
            this.record.setAttribute('aria-busy', nextBusyState);
            this.lastAudioBusyState = nextBusyState;
        }
    }

    /** 音声ロード進捗の変化時に状態表示を再描画する。 */
    updateAudioLoadProgress(progress) {
        this.updatePlayState();
    }

    /** 音声ロード状態に応じてbodyのクラスと表示を切り替える。 */
    setLoadingState(isLoading) {
        this.pageBody.classList.toggle('is-loading', isLoading);
        this.updatePlayState();
        this.updateAudioTime();
    }

    /** 音声ロード失敗を画面へ表示し、再生ループを停止する。 */
    handleAudioError() {
        this.isAudioPlaying = false;
        this.pageBody.classList.remove('is-loading');
        this.playState.textContent = 'AUDIO LOAD ERROR';
        this.lastPlayStateLabel = 'AUDIO LOAD ERROR';
        this.record.setAttribute('aria-busy', 'false');
        this.lastAudioBusyState = 'false';
        this.cancelPlaybackLoops();
    }

    /** 再生中の現在秒数とcookie保存をアニメーションフレームごとに更新する。 */
    updateAudioTimeLoop() {
        if (!this.isAudioPlaying || !this.audioEngine.isPlaying) {
            this.isAudioPlaying = false;
            this.updatePlayState();
            this.audioTimeFrame = null;
            return;
        }
        this.updateAudioTime();
        this.persistPlaybackSeconds();
        this.audioTimeFrame = requestAnimationFrame(() => this.updateAudioTimeLoop());
    }

    /** AnalyserNodeの周波数データを使ってビジュアライザーを描画する。 */
    updateVisualizer() {
        if (!this.isAudioPlaying) {
            this.clearVisualizer();
            return;
        }
        const data = this.audioEngine.getFrequencyData();
        if (!data || !this.visualizerContext) {
            this.clearVisualizer();
            return;
        }
        const size = this.resizeVisualizerCanvas();
        if (!size) return;
        const recordBounds = this.record.getBoundingClientRect();
        const centerX = recordBounds.left - size.bounds.left + recordBounds.width / 2;
        const centerY = recordBounds.top - size.bounds.top + recordBounds.height / 2;
        const baseRadius = recordBounds.width / 2 + 12;
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#aaaaaa';
        const barAngle = (Math.PI * 2) / data.length;
        this.visualizerContext.clearRect(0, 0, size.width, size.height);
        this.visualizerContext.lineWidth = 2;
        this.visualizerContext.lineCap = 'round';
        for (let index = 0; index < data.length; index += 1) {
            const amplitude = data[index] / 255;
            const angle = index * barAngle - Math.PI / 2;
            const outerRadius = baseRadius + 8 + amplitude * 52;
            this.visualizerContext.strokeStyle = accent;
            this.visualizerContext.globalAlpha = 0.16 + amplitude * 0.55;
            this.visualizerContext.beginPath();
            this.visualizerContext.moveTo(centerX + Math.cos(angle) * baseRadius, centerY + Math.sin(angle) * baseRadius);
            this.visualizerContext.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
            this.visualizerContext.stroke();
        }
        this.visualizerContext.globalAlpha = 1;
        this.visualizerFrame = requestAnimationFrame(() => this.updateVisualizer());
    }

    /** 表示領域のサイズに合わせてキャンバス解像度を調整する。 */
    resizeVisualizerCanvas() {
        if (!this.visualizerCanvas || !this.visualizerContext) return null;
        const bounds = this.visualizerCanvas.getBoundingClientRect();
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.floor(bounds.width * pixelRatio));
        const height = Math.max(1, Math.floor(bounds.height * pixelRatio));
        if (this.visualizerCanvas.width !== width || this.visualizerCanvas.height !== height) {
            this.visualizerCanvas.width = width;
            this.visualizerCanvas.height = height;
            this.visualizerContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        }
        return { width: bounds.width, height: bounds.height, bounds };
    }

    /** ビジュアライザーの描画ループを停止してキャンバスを消去する。 */
    clearVisualizer() {
        cancelAnimationFrame(this.visualizerFrame);
        this.visualizerFrame = null;
        if (!this.visualizerContext) return;
        const size = this.resizeVisualizerCanvas();
        if (size) this.visualizerContext.clearRect(0, 0, size.width, size.height);
    }

    /** 再生開始／停止を音声エンジンと画面状態へ反映する。 */
    updatePlaying(isPlaying) {
        if (isPlaying && !this.audioEngine.hasSource) return;
        this.isAudioPlaying = isPlaying;
        this.pageBody.classList.toggle('is-playing', isPlaying);
        this.updatePlayState();
        if (isPlaying) {
            if (this.audioEngine.duration > 0 && this.audioEngine.getCurrentSeconds() >= this.audioEngine.duration) this.audioEngine.seek(0);
            this.audioEngine.play().then(() => {
                if (this.isAudioPlaying) {
                    cancelAnimationFrame(this.visualizerFrame);
                    this.updateVisualizer();
                }
            });
            cancelAnimationFrame(this.audioTimeFrame);
            cancelAnimationFrame(this.visualizerFrame);
            this.updateAudioTimeLoop();
            this.updateVisualizer();
        } else {
            this.audioEngine.stop();
            this.cancelPlaybackLoops();
            this.updateAudioTime();
        }
    }

    /** 再生位置とビジュアライザーのアニメーションを停止する。 */
    cancelPlaybackLoops() {
        cancelAnimationFrame(this.audioTimeFrame);
        cancelAnimationFrame(this.visualizerFrame);
        this.audioTimeFrame = null;
        this.visualizerFrame = null;
        this.clearVisualizer();
    }

    /** シークバー操作中の仮の再生秒数を更新する。 */
    updateSeekPreview() {
        if (this.audioEngine.duration <= 0) return;
        this.isSeeking = true;
        this.pendingSeekSeconds = Math.max(0, Math.min(this.audioEngine.duration, Number(this.audioSeek.value)));
        this.audioEngine.previewSeek(this.pendingSeekSeconds);
        this.updateAudioTime();
        this.persistPlaybackSeconds();
    }

    /** シーク操作を確定し、指定秒数から再生を再構成する。 */
    commitSeek() {
        if (!this.isSeeking) return;
        this.audioEngine.seek(this.pendingSeekSeconds);
        this.isSeeking = false;
        this.updateAudioTime();
        this.persistPlaybackSeconds(true);
    }

    /** 現在の再生秒数を一定間隔でcookieへ保存する。 */
    persistPlaybackSeconds(force = false) {
        const now = Date.now();
        if (!force && now - this.lastPlaybackCookieSaveAt < 500) return;
        this.lastPlaybackCookieSaveAt = now;
        const seconds = this.isSeeking ? this.pendingSeekSeconds : this.audioEngine.getCurrentSeconds();
        this.playbackStateRepository.savePlaybackSeconds(seconds);
    }

    /** レコード操作を開始し、初期状態を記録する。 */
    handlePointerDown(event) {
        this.stopMomentum();
        this.pointerId = event.pointerId;
        this.previousAngle = this.angleFromCenter(event);
        this.lastMoveTime = performance.now();
        this.record.setPointerCapture(this.pointerId);
        this.updatePlaying(true);
    }

    /** ポインターの角度差からレコード回転と速度を更新する。 */
    handlePointerMove(event) {
        if (event.pointerId !== this.pointerId) return;
        const currentAngle = this.angleFromCenter(event);
        let delta = currentAngle - this.previousAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        const now = performance.now();
        const elapsed = Math.max(now - this.lastMoveTime, 1);
        this.velocity = (delta / elapsed) * 16;
        this.setRotation(this.rotation + delta);
        this.previousAngle = currentAngle;
        this.lastMoveTime = now;
    }

    /** ポインター解放時に停止または慣性回転へ遷移する。 */
    releasePointer(event) {
        if (event.pointerId !== this.pointerId) return;
        this.pointerId = null;
        this.previousAngle = null;
        if (Math.abs(this.velocity) > 0.02) this.momentumFrame = requestAnimationFrame(() => this.applyMomentum());
        else this.updatePlaying(false);
    }

    /** 左右矢印キーによる回転操作を処理する。 */
    handleKeyDown(event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        this.velocity = direction * 2;
        this.setRotation(this.rotation + direction * 12);
        this.updatePlaying(true);
        cancelAnimationFrame(this.momentumFrame);
        this.momentumFrame = requestAnimationFrame(() => this.applyMomentum());
    }

    /** 回転速度を減衰させながら慣性回転を継続する。 */
    applyMomentum() {
        if (Math.abs(this.velocity) < 0.02) {
            this.stopMomentum();
            this.updatePlaying(false);
            return;
        }
        this.setRotation(this.rotation + this.velocity);
        this.velocity *= ATTENUATION_RATE;
        this.momentumFrame = requestAnimationFrame(() => this.applyMomentum());
    }

    /** 慣性回転を停止し、目標再生速度を停止値へ戻す。 */
    stopMomentum() {
        cancelAnimationFrame(this.momentumFrame);
        this.momentumFrame = null;
        this.velocity = 0;
        this.meterFill.style.width = '0%';
        this.targetPlaybackRate = MIN_PLAYBACK_RATE;
        if (!this.playbackRateFrame) this.playbackRateFrame = requestAnimationFrame(() => this.updatePlaybackRate());
    }

    /** 回転角度、速度メーター、再生方向をまとめて更新する。 */
    setRotation(nextRotation) {
        this.rotation = nextRotation;
        this.record.style.transform = `rotate(${this.rotation}deg)`;
        const normalized = ((Math.round(this.rotation) % 360) + 360) % 360;
        this.angleValue.textContent = `${String(normalized).padStart(3, '0')}°`;
        this.record.setAttribute('aria-valuenow', normalized);
        const speedPercent = this.getRotationSpeedPercent();
        this.meterFill.style.width = `${speedPercent}%`;
        this.targetPlaybackRate = this.getPlaybackRateForSpeed(speedPercent);
        this.audioEngine.setDirection(this.velocity < 0 ? 'reverse' : this.velocity > 0 ? 'forward' : this.audioEngine.direction);
        if (!this.playbackRateFrame) this.playbackRateFrame = requestAnimationFrame(() => this.updatePlaybackRate());
    }

    /** 目標再生速度へ滑らかに近づける。 */
    updatePlaybackRate() {
        const difference = this.targetPlaybackRate - this.audioEngine.playbackRate;
        if (Math.abs(difference) < 0.01) {
            this.audioEngine.setPlaybackRate(this.targetPlaybackRate);
            this.updatePlaybackRateLabel();
            this.playbackRateFrame = null;
            return;
        }
        this.audioEngine.setPlaybackRate(this.audioEngine.playbackRate + difference * PLAYBACK_RATE_SMOOTHING);
        this.updatePlaybackRateLabel();
        this.playbackRateFrame = requestAnimationFrame(() => this.updatePlaybackRate());
    }

    /** ポインター座標からレコード中心を基準にした角度を求める。 */
    angleFromCenter(event) {
        const bounds = this.record.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        return (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
    }

    /** 現在の回転入力速度を0〜100%へ変換する。 */
    getRotationSpeedPercent() {
        return Math.min(Math.abs(this.velocity) * ROTATION_SPEED_SCALE, 100);
    }

    /** 回転速度の割合をWeb Audioの再生速度へ変換する。 */
    getPlaybackRateForSpeed(speedPercent) {
        if (speedPercent <= MIN_CENTER) return MIN_PLAYBACK_RATE + (speedPercent / MIN_CENTER) * (1 - MIN_PLAYBACK_RATE);
        if (speedPercent <= MAX_CENTER) return 1;
        return 1 + ((speedPercent - MAX_CENTER) / MIN_CENTER) * (MAX_PLAYBACK_RATE - 1);
    }

    /** 秒数を画面表示用のmm:ssまたはhh:mm:ssへ変換する。 */
    formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
        const totalSeconds = Math.floor(seconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainingSeconds = totalSeconds % 60;
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(remainingSeconds).padStart(2, '0');
        return hours > 0 ? `${String(hours).padStart(2, '0')}:${formattedMinutes}:${formattedSeconds}` : `${formattedMinutes}:${formattedSeconds}`;
    }
}
