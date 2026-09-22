// ビジュアライザー描画の線幅。
const VISUALIZER_BAR_LINE_WIDTH = 4;
const VISUALIZER_WAVEFORM_LINE_WIDTH = 1;
const AUDIO_TIME_UPDATE_INTERVAL_MS = 100;
// 回転操作の慣性を調整する画面設定。
const MOMENTUM_PERSISTENCE_RATE = 1;

/** レコード回転の入力を音声エンジンとプレーヤー表示へ反映するPresentation Controller。 */
export class RecordPlayerController {
    constructor({ playbackService }) {
        // 再生ユースケースと状態を提供するアプリケーションサービス。
        this.playbackService = playbackService;
        // プレーヤー画面のDOM要素。
        this.pagePlayer = document.querySelector('#PagePlayer');
        this.record = document.querySelector('#record');
        this.recordLabel = document.querySelector('#label, .label');
        this.noiseButton = document.querySelector('#noiseButton');
        this.visualizerButton = document.querySelector('#visualizerButton');
        this.playbackX1Button = document.querySelector('#playbackX1Button');
        this.playbackSpeedReductionButton = document.querySelector('#PlaybackSpeedReductionButton, #PlaybackSpeedReduction');
        this.playbackSpeedIncrementButton = document.querySelector('#PlaybackSpeedIncrementButton, #PlaybackSpeedIncrement');
        this.playbackReverseButton = document.querySelector('#playbackReverse');
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
        this.isManualPlaybackRate = false;
        this.isAudioPlaying = false;
        this.isSeeking = false;
        this.pendingSeekSeconds = 0;
        this.audioTimeTimer = null;
        this.visualizerFrame = null;
        this.visualizerEnabled = true;
        this.visualizerVisible = true;
        this.visualizerLayout = null;
        this.visualizerAccent = null;
        this.visualizerResizeObserver = null;
        this.recordBounds = null;
        // 表示更新の重複を抑えるための前回値。
        this.lastPlaybackCookieSaveAt = 0;
        this.lastAudioTimeLabel = '';
        this.lastPlaybackRateLabel = '';
        this.lastPlayStateLabel = '';
        this.lastAudioBusyState = null;
        this.lastAudioSeekMax = null;
        this.lastAudioSeekDisabled = null;
        this.lastAudioSeekValue = null;
        this.lastAngleLabel = '';
        this.lastMeterWidth = '';
        this.lastRenderedRotation = null;

        // 音声エンジンからのロード状態を画面へ中継する。
        this.playbackService.setAudioCallbacks({
            onLoadingProgress: (progress) => this.updateAudioLoadProgress(progress),
            onLoadingStateChange: (isLoading) => this.setLoadingState(isLoading),
            onError: (error) => this.handleAudioError(error),
        });
    }

    /** DOMイベントとページ離脱時の保存処理を初期化する。 */
    initialize() {
        this.bindEvents();
        const { noiseEnabled, visualizerEnabled } = this.playbackService.getState();
        this.updateNoiseButton(noiseEnabled);
        this.setVisualizerEnabled(visualizerEnabled);
        this.updateVisualizerButton(visualizerEnabled);
        this.playbackService
            .restore()
            .then(({ noiseEnabled: restoredNoiseEnabled }) => {
                this.updateNoiseButton(restoredNoiseEnabled);
            })
            .catch(() => {});
        this.updatePlaybackDirectionButton();
        window.addEventListener('pagehide', () => this.persistPlaybackSeconds(true));
        window.addEventListener('resize', () => this.invalidateVisualizer());
        if (typeof ResizeObserver === 'function' && this.visualizerCanvas) {
            this.visualizerResizeObserver = new ResizeObserver(() => this.invalidateVisualizer());
            this.visualizerResizeObserver.observe(this.visualizerCanvas);
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.clearVisualizer();
                return;
            }
            this.scheduleVisualizer();
        });
        this.setRotation(0);
        this.updateAudioTime();
        this.updatePlaybackRateLabel();
    }

    /** 音声エンジンへ音源URLと初期再生秒数を渡す。 */
    setAudioSource(sourceUrl, initialSeconds = 0) {
        return this.playbackService.setAudioSource(sourceUrl, initialSeconds);
    }

    /** レコード選択時にlabelとPagePlayerの背景画像を更新する。 */
    setRecordImage(imageUrl) {
        const resolvedImageUrl = imageUrl ? new URL(imageUrl, document.baseURI).href : '';
        const backgroundImage = resolvedImageUrl ? `url(${JSON.stringify(resolvedImageUrl)})` : '';
        if (this.recordLabel) this.recordLabel.style.backgroundImage = backgroundImage;
        this.pagePlayer?.style.setProperty('--record-image', backgroundImage || 'none');
    }

    /** 保存済みの再生秒数を取得する。 */
    getStoredPlaybackSeconds() {
        return this.playbackService.getStoredPlaybackSeconds();
    }

    /** 慣性回転・再生を停止し、現在の再生秒数を保存する。 */
    stop() {
        this.isManualPlaybackRate = false;
        this.stopMomentum();
        this.updatePlaying(false);
        this.persistPlaybackSeconds(true);
    }

    /** レコード変更時に表示回転を0度へ戻す。 */
    resetRotation() {
        this.previousAngle = null;
        this.setRotation(0);
    }

    /** レコード変更時に画面側の再生・慣性状態を初期化する。 */
    resetForRecordChange() {
        this.isManualPlaybackRate = false;
        this.stopMomentum();
        this.isAudioPlaying = false;
        this.pageBody.classList.remove('is-playing');
        this.cancelPlaybackLoops();
        this.resetRotation();
        this.updatePlayState();
        this.updateAudioTime();
    }

    /** レコード回転、シーク、キーボード操作のイベントを登録する。 */
    bindEvents() {
        this.record.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
        this.record.addEventListener('pointermove', (event) => this.handlePointerMove(event));
        this.record.addEventListener('pointerup', (event) => this.releasePointer(event));
        this.record.addEventListener('pointercancel', (event) => this.releasePointer(event));
        this.record.addEventListener('lostpointercapture', (event) => this.releasePointer(event));
        this.record.addEventListener('keydown', (event) => this.handleKeyDown(event));
        this.noiseButton?.addEventListener('click', () => this.toggleNoise());
        this.visualizerButton?.addEventListener('click', () => this.toggleVisualizer());
        this.playbackX1Button?.addEventListener('click', () => this.setManualPlaybackRate(1));
        this.playbackSpeedReductionButton?.addEventListener('click', () => this.adjustManualPlaybackRate(-0.1));
        this.playbackSpeedIncrementButton?.addEventListener('click', () => this.adjustManualPlaybackRate(0.1));
        this.playbackReverseButton?.addEventListener('click', () => this.togglePlaybackDirection());
        this.audioSeek.addEventListener('input', () => this.updateSeekPreview());
        this.audioSeek.addEventListener('change', () => this.commitSeek());
        this.audioSeek.addEventListener('keyup', (event) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) this.commitSeek();
        });
    }

    /** noiseボタンの状態を音声エンジンへ反映する。 */
    toggleNoise() {
        const nextEnabled = !this.playbackService.audioState.isNoiseEnabled;
        this.updateNoiseButton(nextEnabled);
        this.playbackService
            .toggleNoise()
            .then((enabled) => this.updateNoiseButton(enabled))
            .catch(() => this.updateNoiseButton(false));
    }

    /** noiseボタンのaria状態と表示状態を更新する。 */
    updateNoiseButton(enabled = this.playbackService.audioState.isNoiseEnabled) {
        if (!this.noiseButton) return;
        this.noiseButton.setAttribute('aria-pressed', String(enabled));
        this.noiseButton.classList.toggle('is-active', enabled);
    }

    /** ビジュアライザー設定を切り替え、描画状態とcookieを同期する。 */
    toggleVisualizer() {
        const enabled = this.playbackService.toggleVisualizer();
        this.setVisualizerEnabled(enabled);
        this.updateVisualizerButton(enabled);
    }

    /** ビジュアライザー設定ボタンのaria状態と表示状態を更新する。 */
    updateVisualizerButton(enabled = this.visualizerEnabled) {
        if (!this.visualizerButton) return;
        this.visualizerButton.setAttribute('aria-pressed', String(enabled));
        this.visualizerButton.classList.toggle('is-active', enabled);
    }

    /** 逆再生時のボタン状態と色を更新する。 */
    updatePlaybackDirectionButton(direction = this.playbackService.audioState.direction) {
        if (!this.playbackReverseButton) return;
        const isReverse = (direction ?? this.playbackService.audioState.direction) === 'reverse';
        this.playbackReverseButton.setAttribute('aria-pressed', String(isReverse));
        this.playbackReverseButton.classList.toggle('is-active', isReverse);
    }

    /** 現在秒数と総時間を表示し、シークバーの範囲を更新する。 */
    updateAudioTime() {
        const { duration } = this.playbackService.audioState;
        const currentSeconds = this.isSeeking ? this.pendingSeekSeconds : this.playbackService.getCurrentSeconds();
        const seconds = duration > 0 ? Math.min(currentSeconds, duration) : 0;
        const nextLabel = `${this.formatTime(seconds)} / ${this.formatTime(duration)}`;
        if (nextLabel !== this.lastAudioTimeLabel) {
            this.audioTime.textContent = nextLabel;
            this.lastAudioTimeLabel = nextLabel;
        }
        const nextMax = String(duration);
        if (nextMax !== this.lastAudioSeekMax) {
            this.audioSeek.max = nextMax;
            this.lastAudioSeekMax = nextMax;
        }
        const nextDisabled = duration <= 0;
        if (nextDisabled !== this.lastAudioSeekDisabled) {
            this.audioSeek.disabled = nextDisabled;
            this.lastAudioSeekDisabled = nextDisabled;
        }
        const nextValue = String(Math.round(seconds * 100) / 100);
        if (!this.isSeeking && nextValue !== this.lastAudioSeekValue) {
            this.audioSeek.value = nextValue;
            this.lastAudioSeekValue = nextValue;
        }
    }

    /** 現在の再生速度を画面へ表示する。 */
    updatePlaybackRateLabel() {
        const nextLabel = `${this.playbackService.audioState.playbackRate.toFixed(2)}x`;
        if (nextLabel === this.lastPlaybackRateLabel) return;
        this.playbackRateValue.textContent = nextLabel;
        this.lastPlaybackRateLabel = nextLabel;
    }

    /** ボタン操作で再生速度を即時設定し、回転操作まで設定値を維持する。 */
    setManualPlaybackRate(rate) {
        this.isManualPlaybackRate = true;
        this.targetPlaybackRate = this.playbackService.setPlaybackRate(rate);
        cancelAnimationFrame(this.playbackRateFrame);
        this.playbackRateFrame = null;
        this.updatePlaybackRateLabel();
        this.syncRotationToPlaybackRate();
        this.startPlaybackFromSpeedControl();
    }

    /** 現在の再生速度を指定量だけ増減する。 */
    adjustManualPlaybackRate(delta) {
        this.isManualPlaybackRate = true;
        this.targetPlaybackRate = this.playbackService.adjustPlaybackRate(delta);
        cancelAnimationFrame(this.playbackRateFrame);
        this.playbackRateFrame = null;
        this.updatePlaybackRateLabel();
        this.syncRotationToPlaybackRate();
        this.startPlaybackFromSpeedControl();
    }

    /** 再生方向を切り替え、再生中の速度方向も同期する。 */
    togglePlaybackDirection() {
        const nextDirection = this.playbackService.toggleDirection();
        this.updatePlaybackDirectionButton(nextDirection);
        this.syncRotationToPlaybackRate();
        this.startPlaybackFromSpeedControl();
    }

    /** 再生速度をレコードの回転速度へ変換する。 */
    getRotationSpeedPercentForPlaybackRate(rate) {
        return this.playbackService.rotationSpeedPercentFromRate(rate);
    }

    /** 設定済みの再生速度・方向をレコード回転へ同期する。 */
    syncRotationToPlaybackRate() {
        const { playbackRate, direction: playbackDirection } = this.playbackService.audioState;
        const speedPercent = this.getRotationSpeedPercentForPlaybackRate(playbackRate);
        this.velocity = this.playbackService.rotationVelocityFromSpeedPercent(speedPercent, playbackDirection);
        this.setRotation(this.rotation + this.velocity);
    }

    /** 速度ボタン操作後に音声と慣性回転を開始する。 */
    startPlaybackFromSpeedControl() {
        if (!this.playbackService.isCurrentRatePlayable()) return;
        this.updatePlaying(true);
        cancelAnimationFrame(this.momentumFrame);
        this.momentumFrame = null;
        if (this.velocity !== 0) this.momentumFrame = requestAnimationFrame(() => this.applyMomentum());
    }

    /** ロード中／再生中／待機中の状態表示とaria-busyを更新する。 */
    updatePlayState() {
        const { isLoading, audioLoadProgress } = this.playbackService.audioState;
        const nextLabel = isLoading ? `LOADING AUDIO ${audioLoadProgress}%` : this.isAudioPlaying ? 'NOW SPINNING' : 'READY TO SPIN';
        if (nextLabel !== this.lastPlayStateLabel) {
            this.playState.textContent = nextLabel;
            this.lastPlayStateLabel = nextLabel;
        }
        const nextBusyState = String(isLoading);
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

    /** 再生中の現在秒数とcookie保存を定期更新する。 */
    updateAudioTimeLoop() {
        if (!this.isAudioPlaying || !this.playbackService.audioState.isPlaying) {
            this.isAudioPlaying = false;
            this.updatePlayState();
            this.audioTimeTimer = null;
            return;
        }
        this.updateAudioTime();
        this.persistPlaybackSeconds();
        this.audioTimeTimer = window.setTimeout(() => this.updateAudioTimeLoop(), AUDIO_TIME_UPDATE_INTERVAL_MS);
    }

    /** AnalyserNodeの周波数データを使ってビジュアライザーを描画する。 */
    updateVisualizer() {
        if (!this.isAudioPlaying || !this.visualizerEnabled || !this.visualizerVisible || document.hidden) {
            this.clearVisualizer();
            return;
        }
        const data = this.playbackService.getFrequencyData();
        const waveform = this.playbackService.getTimeDomainData();
        if (!data?.length || !waveform?.length || !this.visualizerContext) {
            this.clearVisualizer(false);
            this.scheduleVisualizer();
            return;
        }
        const layout = this.resizeVisualizerCanvas();
        if (!layout) {
            this.scheduleVisualizer();
            return;
        }
        const { width, height, centerX, centerY, baseRadius } = layout;
        if (!this.visualizerAccent) this.visualizerAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#aaaaaa';
        const barAngle = (Math.PI * 2) / data.length;
        this.visualizerContext.clearRect(0, 0, width, height);
        this.visualizerContext.lineWidth = VISUALIZER_BAR_LINE_WIDTH;
        this.visualizerContext.lineCap = 'round';
        this.visualizerContext.strokeStyle = this.visualizerAccent;
        for (let index = 0; index < data.length; index += 1) {
            // 小さい音量の変化も視認できるよう、表示用の振幅を補正する。
            const amplitude = Math.pow(data[index] / 255, 0.75);
            const angle = index * barAngle - Math.PI / 2;
            const outerRadius = baseRadius + 8 + amplitude * 52;
            this.visualizerContext.globalAlpha = 0.16 + amplitude * 0.55;
            this.visualizerContext.beginPath();
            this.visualizerContext.moveTo(centerX + Math.cos(angle) * baseRadius, centerY + Math.sin(angle) * baseRadius);
            this.visualizerContext.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
            this.visualizerContext.stroke();
        }
        // 時間領域波形を外周へ描画し、音声波形の変化を直接反映する。
        this.visualizerContext.beginPath();
        for (let index = 0; index <= data.length; index += 1) {
            const dataIndex = Math.min(waveform.length - 1, Math.floor((index / data.length) * waveform.length));
            const waveAmplitude = (waveform[dataIndex] - 128) / 128;
            const frequencyAmplitude = data[index % data.length] / 255;
            const angle = (index / data.length) * Math.PI * 2 - Math.PI / 2;
            const radius = baseRadius + 12 + waveAmplitude * 18 + frequencyAmplitude * 10;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (index === 0) this.visualizerContext.moveTo(x, y);
            else this.visualizerContext.lineTo(x, y);
        }
        this.visualizerContext.globalAlpha = 0.75;
        this.visualizerContext.lineWidth = VISUALIZER_WAVEFORM_LINE_WIDTH;
        this.visualizerContext.stroke();
        this.visualizerContext.globalAlpha = 1;
        this.scheduleVisualizer();
    }

    /** ビジュアライザーの次回描画を予約する。 */
    scheduleVisualizer() {
        if (!this.visualizerEnabled || !this.visualizerVisible || !this.isAudioPlaying || document.hidden || this.visualizerFrame !== null) return;
        this.visualizerFrame = requestAnimationFrame(() => {
            this.visualizerFrame = null;
            this.updateVisualizer();
        });
    }

    /** ビジュアライザーの表示・配色キャッシュを無効化する。 */
    invalidateVisualizer() {
        this.visualizerLayout = null;
        this.visualizerAccent = null;
        this.recordBounds = null;
        if (!document.hidden) this.scheduleVisualizer();
    }

    /** ビジュアライザーの表示状態を切り替える。 */
    setVisualizerVisible(isVisible) {
        this.visualizerVisible = isVisible;
        this.invalidateVisualizer();
        if (!isVisible) this.clearVisualizer();
    }

    /** ユーザー設定に応じてビジュアライザーを有効化・無効化する。 */
    setVisualizerEnabled(isEnabled) {
        this.visualizerEnabled = Boolean(isEnabled);
        this.setVisualizerVisible(this.visualizerEnabled);
    }

    /** 選択画面を閉じた後にユーザー設定どおりの表示状態へ戻す。 */
    restoreVisualizerVisibility() {
        this.setVisualizerVisible(this.visualizerEnabled);
    }

    /** 表示領域のサイズとレコード位置に合わせてキャンバスを調整する。 */
    resizeVisualizerCanvas() {
        if (!this.visualizerCanvas || !this.visualizerContext) return null;
        if (this.visualizerLayout) return this.visualizerLayout;
        const bounds = this.visualizerCanvas.getBoundingClientRect();
        const recordBounds = this.record.getBoundingClientRect();
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.floor(bounds.width * pixelRatio));
        const height = Math.max(1, Math.floor(bounds.height * pixelRatio));
        if (this.visualizerCanvas.width !== width || this.visualizerCanvas.height !== height) {
            this.visualizerCanvas.width = width;
            this.visualizerCanvas.height = height;
            this.visualizerContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        }
        this.visualizerLayout = {
            width: bounds.width,
            height: bounds.height,
            pixelRatio,
            canvasLeft: bounds.left,
            canvasTop: bounds.top,
            recordLeft: recordBounds.left,
            recordTop: recordBounds.top,
            recordWidth: recordBounds.width,
            centerX: recordBounds.left - bounds.left + recordBounds.width / 2,
            centerY: recordBounds.top - bounds.top + recordBounds.height / 2,
            baseRadius: recordBounds.width / 2 + 12,
        };
        return this.visualizerLayout;
    }

    /** ビジュアライザーの描画ループを必要に応じて停止し、キャンバスを消去する。 */
    clearVisualizer(cancelFrame = true) {
        if (cancelFrame) {
            cancelAnimationFrame(this.visualizerFrame);
            this.visualizerFrame = null;
        }
        if (!this.visualizerContext) return;
        this.visualizerContext.save();
        this.visualizerContext.setTransform(1, 0, 0, 1, 0, 0);
        this.visualizerContext.clearRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
        this.visualizerContext.restore();
    }

    /** 再生開始／停止を音声エンジンと画面状態へ反映する。 */
    updatePlaying(isPlaying) {
        const { hasSource, duration } = this.playbackService.audioState;
        if (isPlaying && !hasSource) return;
        this.isAudioPlaying = isPlaying;
        this.pageBody.classList.toggle('is-playing', isPlaying);
        this.updatePlayState();
        if (isPlaying) {
            if (duration > 0 && this.playbackService.getCurrentSeconds() >= duration) this.playbackService.seek(0);
            this.playbackService.play().then(() => {
                if (this.isAudioPlaying) {
                    cancelAnimationFrame(this.visualizerFrame);
                    this.visualizerFrame = null;
                    this.updateVisualizer();
                }
            });
            window.clearTimeout(this.audioTimeTimer);
            cancelAnimationFrame(this.visualizerFrame);
            this.visualizerFrame = null;
            this.audioTimeTimer = null;
            this.updateAudioTimeLoop();
            this.scheduleVisualizer();
        } else {
            this.playbackService.stop();
            this.cancelPlaybackLoops();
            this.updateAudioTime();
        }
    }

    /** 再生位置とビジュアライザーのアニメーションを停止する。 */
    cancelPlaybackLoops() {
        window.clearTimeout(this.audioTimeTimer);
        cancelAnimationFrame(this.visualizerFrame);
        this.audioTimeTimer = null;
        this.visualizerFrame = null;
        this.clearVisualizer();
    }

    /** シークバー操作中の仮の再生秒数を更新する。 */
    updateSeekPreview() {
        const { duration } = this.playbackService.audioState;
        if (duration <= 0) return;
        this.isSeeking = true;
        this.pendingSeekSeconds = this.playbackService.normalizePlaybackPosition(Number(this.audioSeek.value));
        this.playbackService.previewSeek(this.pendingSeekSeconds);
        this.updateAudioTime();
        this.persistPlaybackSeconds();
    }

    /** シーク操作を確定し、指定秒数から再生を再構成する。 */
    commitSeek() {
        if (!this.isSeeking) return;
        this.playbackService.seek(this.pendingSeekSeconds);
        this.isSeeking = false;
        this.updateAudioTime();
        this.persistPlaybackSeconds(true);
    }

    /** 現在の再生秒数を一定間隔でcookieへ保存する。 */
    persistPlaybackSeconds(force = false) {
        const now = Date.now();
        if (!force && now - this.lastPlaybackCookieSaveAt < 500) return;
        this.lastPlaybackCookieSaveAt = now;
        const seconds = this.isSeeking ? this.pendingSeekSeconds : this.playbackService.getCurrentSeconds();
        this.playbackService.savePlaybackSeconds(seconds);
    }

    /** レコード操作を開始し、初期状態を記録する。 */
    handlePointerDown(event) {
        if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
        this.isManualPlaybackRate = false;
        this.stopMomentum();
        this.pointerId = event.pointerId;
        this.recordBounds = this.record.getBoundingClientRect();
        this.previousAngle = this.angleFromCenter(event);
        this.lastMoveTime = performance.now();
        this.record.setPointerCapture(this.pointerId);
        this.updatePlaying(true);
    }

    /** ポインターの角度差からレコード回転と速度を更新する。 */
    handlePointerMove(event) {
        if (event.pointerId !== this.pointerId) return;
        const currentAngle = this.angleFromCenter(event);
        const delta = this.playbackService.normalizeRotationDelta(currentAngle - this.previousAngle);
        const now = performance.now();
        this.velocity = this.playbackService.rotationVelocityFromDelta(delta, now - this.lastMoveTime);
        this.setRotation(this.rotation + delta);
        this.previousAngle = currentAngle;
        this.lastMoveTime = now;
    }

    /** ポインター解放時に停止または慣性回転へ遷移する。 */
    releasePointer(event) {
        if (event.pointerId !== this.pointerId) return;
        this.pointerId = null;
        this.previousAngle = null;
        this.recordBounds = null;
        if (event.type === 'pointerup' && this.playbackService.shouldStartRotationMomentum(this.velocity)) {
            this.momentumFrame = requestAnimationFrame(() => this.applyMomentum());
            return;
        }
        this.stopMomentum();
        this.updatePlaying(false);
    }

    /** 左右矢印キーによる回転操作を処理する。 */
    handleKeyDown(event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        this.isManualPlaybackRate = false;
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        this.velocity = direction * 2;
        this.setRotation(this.rotation + direction * 12);
        this.updatePlaying(true);
        cancelAnimationFrame(this.momentumFrame);
        this.momentumFrame = requestAnimationFrame(() => this.applyMomentum());
    }

    /** 回転速度を維持しながら慣性回転を継続する。 */
    applyMomentum() {
        if (this.playbackService.isRotationMomentumBelowThreshold(this.velocity)) {
            this.stopMomentum();
            this.updatePlaying(false);
            return;
        }
        this.setRotation(this.rotation + this.velocity);
        this.velocity *= MOMENTUM_PERSISTENCE_RATE;
        this.momentumFrame = requestAnimationFrame(() => this.applyMomentum());
    }

    /** 慣性回転を停止し、目標再生速度を停止値へ戻す。 */
    stopMomentum() {
        cancelAnimationFrame(this.momentumFrame);
        this.momentumFrame = null;
        this.velocity = 0;
        this.meterFill.style.transform = 'scaleX(0)';
        this.lastMeterWidth = '0%';
        this.targetPlaybackRate = this.playbackService.minimumPlaybackRate;
        if (!this.playbackRateFrame) this.playbackRateFrame = requestAnimationFrame(() => this.updatePlaybackRate());
    }

    /** 回転角度、速度メーター、再生方向をまとめて更新する。 */
    setRotation(nextRotation) {
        this.rotation = nextRotation;
        const rotationStyle = `rotate(${this.rotation}deg)`;
        if (this.recordLabel && this.lastRenderedRotation !== rotationStyle) {
            this.recordLabel.style.transform = rotationStyle;
            this.lastRenderedRotation = rotationStyle;
        }
        const normalized = ((Math.round(this.rotation) % 360) + 360) % 360;
        const nextAngleLabel = `${String(normalized).padStart(3, '0')}°`;
        if (nextAngleLabel !== this.lastAngleLabel) {
            this.angleValue.textContent = nextAngleLabel;
            this.lastAngleLabel = nextAngleLabel;
            this.record.setAttribute('aria-valuenow', normalized);
        }
        const speedPercent = this.getRotationSpeedPercent();
        const nextMeterWidth = `${speedPercent}%`;
        if (nextMeterWidth !== this.lastMeterWidth) {
            this.meterFill.style.transform = `scaleX(${speedPercent / 100})`;
            this.lastMeterWidth = nextMeterWidth;
        }
        if (!this.isManualPlaybackRate) this.targetPlaybackRate = this.getPlaybackRateForSpeed(speedPercent);
        const currentDirection = this.playbackService.audioState.direction;
        const nextDirection = this.playbackService.resolveDirectionFromRotation(this.velocity);
        if (nextDirection !== currentDirection) {
            this.playbackService.setDirection(nextDirection);
            this.updatePlaybackDirectionButton(nextDirection);
        }
        if (!this.playbackRateFrame) this.playbackRateFrame = requestAnimationFrame(() => this.updatePlaybackRate());
    }

    /** 目標再生速度へ滑らかに近づける。 */
    updatePlaybackRate() {
        const { isSettled } = this.playbackService.approachPlaybackRate(this.targetPlaybackRate);
        this.updatePlaybackRateLabel();
        if (isSettled) {
            this.playbackRateFrame = null;
            return;
        }
        this.playbackRateFrame = requestAnimationFrame(() => this.updatePlaybackRate());
    }

    /** ポインター座標からレコード中心を基準にした角度を求める。 */
    angleFromCenter(event) {
        const bounds = this.recordBounds || this.record.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        return (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
    }

    /** 現在の回転入力速度を0〜100%へ変換する。 */
    getRotationSpeedPercent() {
        return this.playbackService.rotationSpeedPercentFromVelocity(this.velocity);
    }

    /** 回転速度の割合をWeb Audioの再生速度へ変換する。 */
    getPlaybackRateForSpeed(speedPercent) {
        return this.playbackService.rateFromRotationSpeedPercent(speedPercent);
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
