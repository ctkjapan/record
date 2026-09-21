// 音声ロード進捗の段階を表す定数。
const MIN_LOAD_PROGRESS = 0;
const DOWNLOAD_PROGRESS_MAX = 80;
const DECODE_PROGRESS = 85;
const REVERSE_BUFFER_PROGRESS_START = 92;

/** Web Audio APIを隠蔽し、音声の取得・デコード・再生状態を管理するインフラ実装。 */
export class WebAudioEngine {
    constructor({ noiseSourceUrl = null, noiseEnabled = false } = {}) {
        // AudioContextと音声バッファのライフサイクルを管理する状態。
        this.audioContext = null;
        this.audioBuffer = null;
        this.reversedAudioBuffer = null;
        this.audioSource = null;
        this.audioSourceUrl = null;
        this.audioLoadPromise = null;
        this.audioLoadRequestId = 0;
        this.audioLoadController = null;
        this.audioBufferCache = new Map();
        // メイン音源と同期してループするノイズ音源の状態。
        this.noiseSourceUrl = noiseSourceUrl;
        this.noiseAudioBuffer = null;
        this.reversedNoiseAudioBuffer = null;
        this.noiseLoadPromise = null;
        this.noiseSource = null;
        this.noiseEnabled = Boolean(noiseEnabled);
        // 解析用ノードと可視化データ。
        this.audioAnalyser = null;
        this.visualizerData = null;
        // 現在の再生位置・方向・速度を表す状態（位置の単位は秒）。
        this.audioSourceStartedAt = 0;
        this.audioSourceStartTime = 0;
        this.audioSourceRate = 1;
        this.logicalSeconds = 0;
        this.direction = 'forward';
        this.isPlaying = false;
        // 再生開始待ちの重複処理を無効化するための要求番号と待機状態。
        this.playbackStartRequestId = 0;
        this.isPlaybackStarting = false;
        // 音声ロード表示とユーザー操作のための状態。
        this.isLoading = false;
        this.audioLoadProgress = MIN_LOAD_PROGRESS;
        this.audioUnlocked = false;
        this.onLoadingProgress = () => {};
        this.onLoadingStateChange = () => {};
        this.onError = () => {};
    }

    /** ロード進捗・状態変更・エラー通知の購読先を設定する。 */
    setCallbacks({ onLoadingProgress, onLoadingStateChange, onError } = {}) {
        if (onLoadingProgress) this.onLoadingProgress = onLoadingProgress;
        if (onLoadingStateChange) this.onLoadingStateChange = onLoadingStateChange;
        if (onError) this.onError = onError;
    }

    /** 現在の音声バッファの総再生秒数を返す。 */
    get duration() {
        return this.audioBuffer?.duration || 0;
    }

    /** 現在AudioBufferSourceNodeへ設定している再生速度を返す。 */
    get playbackRate() {
        return this.audioSourceRate;
    }

    /** 音源URLが選択済みかを返す。 */
    get hasSource() {
        return Boolean(this.audioSourceUrl);
    }

    /** メイン音声と有効なノイズ音声の再生準備が完了しているかを返す。 */
    isSourceReady() {
        return Boolean(
            this.audioBuffer
            && this.reversedAudioBuffer
            && this.duration > 0
            && (!this.noiseEnabled || !this.noiseSourceUrl || this.noiseAudioBuffer),
        );
    }

    /** ノイズ音声の同期再生が有効かを返す。 */
    get isNoiseEnabled() {
        return this.noiseEnabled;
    }

    /** 再生中の経過時間を論理秒数へ同期して返す。 */
    getCurrentSeconds() {
        this.syncCurrentSeconds();
        return this.logicalSeconds;
    }

    /** AnalyserNodeから周波数データを取得し、ビジュアライザーへ渡す。 */
    getFrequencyData() {
        if (!this.audioSource || !this.audioAnalyser || !this.visualizerData) return null;
        this.audioAnalyser.getByteFrequencyData(this.visualizerData);
        return this.visualizerData;
    }

    /** 音源を切り替え、指定された秒数を初期再生位置としてロードする。 */
    async setSource(sourceUrl, initialSeconds = 0) {
        if (!sourceUrl) throw new Error('音声ファイルのURLが指定されていません。');
        const requestedSeconds = this.normalizeSeconds(initialSeconds);
        if (sourceUrl === this.audioSourceUrl && (this.audioBuffer || this.audioLoadPromise)) {
            this.logicalSeconds = requestedSeconds;
            const currentLoadPromise = Promise.all([
                this.audioLoadPromise || Promise.resolve(this.audioBuffer),
                this.noiseEnabled ? this.loadNoiseAudioBuffer() : Promise.resolve(null),
            ]);
            const [buffer] = await currentLoadPromise;
            this.logicalSeconds = this.clampSeconds(requestedSeconds);
            return buffer;
        }

        this.playbackStartRequestId += 1;
        this.isPlaybackStarting = false;
        this.stopSource();
        this.abortLoading();
        this.audioSourceUrl = sourceUrl;
        this.audioLoadRequestId += 1;
        this.audioLoadPromise = null;
        this.audioBuffer = null;
        this.reversedAudioBuffer = null;
        this.logicalSeconds = requestedSeconds;
        this.setLoading(true, MIN_LOAD_PROGRESS);

        const nextLoadPromise = Promise.all([
            this.loadAudioBuffer(),
            this.noiseEnabled ? this.loadNoiseAudioBuffer() : Promise.resolve(null),
        ]);
        try {
            const [buffer] = await nextLoadPromise;
            if (sourceUrl === this.audioSourceUrl) {
                this.logicalSeconds = this.clampSeconds(requestedSeconds);
                this.completeLoading();
            }
            return buffer;
        } catch (error) {
            if (sourceUrl !== this.audioSourceUrl) return null;
            this.setLoading(false, this.audioLoadProgress);
            this.onError(error);
            throw error;
        }
    }

    /** AudioContextをアンロックし、音声バッファのロード後に再生を開始する。 */
    async play() {
        if (!this.hasSource || this.audioSource) return;
        const requestId = ++this.playbackStartRequestId;
        this.isPlaying = true;
        this.isPlaybackStarting = true;
        // バッファが準備済みでもAudioContextの再開が遅れる場合があるため、開始完了までロード中にする。
        this.setLoading(true, Math.min(this.audioLoadProgress, 99));
        try {
            await Promise.all([
                this.unlock(),
                this.loadAudioBuffer(),
                this.noiseEnabled ? this.loadNoiseAudioBuffer() : Promise.resolve(null),
            ]);
            if (requestId === this.playbackStartRequestId && this.isPlaying) this.startSource();
        } catch (error) {
            if (requestId !== this.playbackStartRequestId) return;
            this.isPlaying = false;
            this.isPlaybackStarting = false;
            if (this.isSourceReady()) this.completeLoading();
            this.onError(error);
        }
    }

    /** 再生状態を解除し、現在のAudioBufferSourceNodeを停止する。 */
    stop() {
        this.playbackStartRequestId += 1;
        this.isPlaying = false;
        this.isPlaybackStarting = false;
        this.stopSource();
        if (this.isSourceReady()) this.completeLoading();
    }

    /** ノイズ音声の同期再生を切り替え、再生中なら現在位置から再構成する。 */
    async setNoiseEnabled(enabled) {
        const nextEnabled = Boolean(enabled);
        if (nextEnabled === this.noiseEnabled) return;
        this.noiseEnabled = nextEnabled;
        if (!this.isPlaying) return;

        if (!nextEnabled) {
            this.syncCurrentSeconds();
            this.stopSource(false);
            this.startSource();
            return;
        }

        try {
            await this.loadNoiseAudioBuffer();
        } catch (error) {
            this.noiseEnabled = false;
            throw error;
        }
        if (!this.noiseEnabled || !this.isPlaying) return;
        this.syncCurrentSeconds();
        this.stopSource(false);
        this.startSource();
    }

    /** 正転／逆転を切り替え、再生中なら新しい方向で再接続する。 */
    setDirection(direction) {
        if (direction === this.direction) return;
        if (this.isPlaying) this.stopSource();
        this.direction = direction;
        if (this.isPlaying) this.startSource();
    }

    /** 再生速度を変更し、変更前の論理再生位置を維持する。 */
    setPlaybackRate(rate) {
        this.audioSourceRate = rate;
        if (!this.audioSource || !this.audioContext) return;
        this.syncCurrentSeconds();
        this.audioSourceStartTime = this.logicalSeconds;
        this.audioSourceStartedAt = this.audioContext.currentTime;
        this.audioSource.playbackRate.value = rate;
        if (this.noiseSource) this.noiseSource.playbackRate.value = rate;
    }

    /** 指定秒数へシークし、再生中ならその位置から再開する。 */
    seek(seconds) {
        this.logicalSeconds = this.clampSeconds(seconds);
        if (this.audioSource) {
            const wasPlaying = this.isPlaying;
            this.stopSource(false);
            if (wasPlaying) this.startSource();
        }
    }

    /** シーク入力中の表示位置だけを更新し、再生ノードはまだ再起動しない。 */
    previewSeek(seconds) {
        this.logicalSeconds = this.clampSeconds(seconds);
    }

    /** 音声ファイルを取得して、正転用・逆転用AudioBufferを生成する。 */
    async loadAudioBuffer() {
        if (this.audioLoadPromise) return this.audioLoadPromise;
        const context = this.initializeAudioContext();
        const sourceUrl = this.audioSourceUrl;
        const requestId = ++this.audioLoadRequestId;
        const cachedBuffers = this.audioBufferCache.get(sourceUrl);
        if (cachedBuffers) {
            this.audioBuffer = cachedBuffers.forward;
            this.reversedAudioBuffer = cachedBuffers.reverse;
            return this.audioBuffer;
        }

        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        this.audioLoadController = controller;
        this.audioLoadPromise = fetch(sourceUrl, controller ? { signal: controller.signal } : undefined)
            .then((response) => {
                if (!response.ok) throw new Error(`音声の読み込みに失敗しました: ${response.status}`);
                return this.readAudioResponse(response);
            })
            .then((data) => {
                this.updateLoadProgress(DECODE_PROGRESS);
                return context.decodeAudioData(data);
            })
            .then((buffer) => {
                if (requestId !== this.audioLoadRequestId || sourceUrl !== this.audioSourceUrl) return null;
                this.audioBuffer = buffer;
                this.reversedAudioBuffer = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
                for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
                    const sourceChannel = buffer.getChannelData(channel);
                    const reversedChannel = this.reversedAudioBuffer.getChannelData(channel);
                    for (let index = 0; index < sourceChannel.length; index += 1) {
                        reversedChannel[index] = sourceChannel[sourceChannel.length - index - 1];
                    }
                    this.updateLoadProgress(REVERSE_BUFFER_PROGRESS_START + ((channel + 1) / buffer.numberOfChannels) * (99 - REVERSE_BUFFER_PROGRESS_START));
                }
                this.updateLoadProgress(99);
                this.audioBufferCache.set(sourceUrl, { forward: buffer, reverse: this.reversedAudioBuffer });
                return buffer;
            });

        const currentLoadPromise = this.audioLoadPromise;
        currentLoadPromise.then(
            () => {
                if (this.audioLoadController === controller) this.audioLoadController = null;
            },
            () => {
                if (this.audioLoadController === controller) this.audioLoadController = null;
            },
        );
        currentLoadPromise.catch(() => {
            if (this.audioLoadPromise === currentLoadPromise) this.audioLoadPromise = null;
        });
        return this.audioLoadPromise;
    }

    /** ノイズ音源を取得して、正転用・逆転用のAudioBufferを生成する。 */
    async loadNoiseAudioBuffer() {
        if (!this.noiseSourceUrl) return null;
        if (this.noiseAudioBuffer) return this.noiseAudioBuffer;
        if (this.noiseLoadPromise) return this.noiseLoadPromise;
        const context = this.initializeAudioContext();
        this.noiseLoadPromise = fetch(this.noiseSourceUrl)
            .then((response) => {
                if (!response.ok) throw new Error(`ノイズ音声の読み込みに失敗しました: ${response.status}`);
                return this.readAudioResponse(response, () => {});
            })
            .then((data) => context.decodeAudioData(data))
            .then((buffer) => {
                this.noiseAudioBuffer = buffer;
                this.reversedNoiseAudioBuffer = this.createReversedBuffer(context, buffer);
                return buffer;
            });
        this.noiseLoadPromise.catch(() => {
            this.noiseLoadPromise = null;
        });
        return this.noiseLoadPromise;
    }

    /** 音声バッファを反転し、逆再生用バッファを作成する。 */
    createReversedBuffer(context, buffer) {
        const reversedBuffer = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const sourceChannel = buffer.getChannelData(channel);
            const reversedChannel = reversedBuffer.getChannelData(channel);
            for (let index = 0; index < sourceChannel.length; index += 1) {
                reversedChannel[index] = sourceChannel[sourceChannel.length - index - 1];
            }
        }
        return reversedBuffer;
    }

    /** Responseのストリームを読み込み、必要な場合だけ進捗を通知する。 */
    async readAudioResponse(response, onProgress = (progress) => this.updateLoadProgress(progress)) {
        const totalBytes = Number(response.headers.get('content-length'));
        if (!response.body || !Number.isFinite(totalBytes) || totalBytes <= 0) {
            const data = await response.arrayBuffer();
            onProgress(DOWNLOAD_PROGRESS_MAX);
            return data;
        }

        const reader = response.body.getReader();
        const chunks = [];
        let loadedBytes = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            chunks.push(value);
            loadedBytes += value.byteLength;
            onProgress((loadedBytes / totalBytes) * DOWNLOAD_PROGRESS_MAX);
        }
        onProgress(DOWNLOAD_PROGRESS_MAX);
        const data = new Uint8Array(loadedBytes);
        let offset = 0;
        chunks.forEach((chunk) => {
            data.set(chunk, offset);
            offset += chunk.byteLength;
        });
        return data.buffer;
    }

    /** 対応するサンプルレートでAudioContextを生成する。 */
    initializeAudioContext() {
        if (this.audioContext) return this.audioContext;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Web Audio API is not supported.');
        const probeContext = new AudioContextClass();
        const hardwareSampleRate = probeContext.sampleRate || 48000;
        probeContext.close();
        try {
            this.audioContext = new AudioContextClass({ sampleRate: hardwareSampleRate });
        } catch {
            this.audioContext = new AudioContextClass({ sampleRate: 48000 });
        }
        return this.audioContext;
    }

    /** 解析ノードを一度だけ生成し、音声出力へ接続する。 */
    initializeAudioAnalyser(context) {
        if (this.audioAnalyser) return this.audioAnalyser;
        this.audioAnalyser = context.createAnalyser();
        this.audioAnalyser.fftSize = 128;
        this.audioAnalyser.smoothingTimeConstant = 0.8;
        this.audioAnalyser.connect(context.destination);
        this.visualizerData = new Uint8Array(this.audioAnalyser.frequencyBinCount);
        return this.audioAnalyser;
    }

    /** モバイルブラウザの自動再生制限を解除する。 */
    async unlock() {
        const context = this.initializeAudioContext();
        if (context.state === 'suspended') await context.resume();
        if (this.audioUnlocked) return;
        const silentBuffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * 0.01)), context.sampleRate);
        const silentSource = context.createBufferSource();
        silentSource.buffer = silentBuffer;
        silentSource.connect(context.destination);
        silentSource.start(0);
        silentSource.stop(context.currentTime + 0.01);
        this.audioUnlocked = true;
    }

    /** 現在の方向・位置・速度でAudioBufferSourceNodeを開始する。 */
    startSource() {
        if (!this.isPlaying || !this.audioBuffer || !this.reversedAudioBuffer || !this.audioContext || this.audioSource) return;
        const duration = this.duration;
        if (this.direction === 'reverse' && this.logicalSeconds <= 0) {
            // 0秒地点から逆再生する場合は、音声末尾へ循環して再生を開始する。
            this.logicalSeconds = duration;
        }
        const source = this.audioContext.createBufferSource();
        source.buffer = this.direction === 'reverse' ? this.reversedAudioBuffer : this.audioBuffer;
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = duration;
        source.playbackRate.value = this.audioSourceRate;
        const outputNode = this.initializeAudioAnalyser(this.audioContext) || this.audioContext.destination;
        source.connect(outputNode);
        const noiseSource = this.createNoiseSource(outputNode);
        this.audioSource = source;
        this.noiseSource = noiseSource;
        this.audioSourceStartedAt = this.audioContext.currentTime;
        this.audioSourceStartTime = this.logicalSeconds;
        const offset = this.direction === 'reverse' ? duration - this.logicalSeconds : this.logicalSeconds;
        source.start(0, Math.min(duration, Math.max(0, offset)));
        if (noiseSource) noiseSource.start(0, this.getNoiseOffset());
        this.isPlaybackStarting = false;
        this.completeLoading();
    }

    /** メイン音源の秒数に対応するノイズ再生ノードを生成する。 */
    createNoiseSource(outputNode) {
        if (!this.noiseEnabled || !this.noiseAudioBuffer || !this.reversedNoiseAudioBuffer) return null;
        const noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = this.direction === 'reverse' ? this.reversedNoiseAudioBuffer : this.noiseAudioBuffer;
        noiseSource.loop = true;
        noiseSource.loopStart = 0;
        noiseSource.loopEnd = this.noiseAudioBuffer.duration;
        noiseSource.playbackRate.value = this.audioSourceRate;
        noiseSource.connect(outputNode);
        return noiseSource;
    }

    /** メイン音源の秒数をノイズ音源のループ位置へ変換する。 */
    getNoiseOffset() {
        const duration = this.noiseAudioBuffer?.duration || 0;
        if (duration <= 0) return 0;
        const normalizedSeconds = ((this.logicalSeconds % duration) + duration) % duration;
        if (this.direction !== 'reverse' || normalizedSeconds === 0) return normalizedSeconds;
        return duration - normalizedSeconds;
    }

    /** 現在のAudioBufferSourceNodeを停止し、必要に応じて位置を同期する。 */
    stopSource(sync = true) {
        if (!this.audioSource && !this.noiseSource) return;
        if (sync && this.audioSource) this.syncCurrentSeconds();
        const source = this.audioSource;
        this.audioSource = null;
        if (source) {
            try {
                source.stop();
            } catch {
                // 再生終了済みのソースは停止処理を不要とする。
            }
            source.disconnect();
        }
        if (this.noiseSource) {
            try {
                this.noiseSource.stop();
            } catch {
                // 再生終了済みのノイズソースは停止処理を不要とする。
            }
            this.noiseSource.disconnect();
            this.noiseSource = null;
        }
    }

    /** AudioContextの経過時間から音声ファイル上の秒数を計算する。 */
    syncCurrentSeconds() {
        if (!this.audioSource || !this.audioContext || this.duration <= 0) return;
        const elapsed = Math.max(0, this.audioContext.currentTime - this.audioSourceStartedAt);
        const directionFactor = this.direction === 'reverse' ? -1 : 1;
        const nextSeconds = this.audioSourceStartTime + elapsed * this.audioSourceRate * directionFactor;
        this.logicalSeconds = ((nextSeconds % this.duration) + this.duration) % this.duration;
    }

    /** 実行中の音声ロードをAbortControllerで中断する。 */
    abortLoading() {
        if (this.audioLoadController) this.audioLoadController.abort();
        this.audioLoadController = null;
    }

    /** ロード進捗を0〜99%へ補正して通知する。 */
    updateLoadProgress(progress) {
        this.audioLoadProgress = Math.max(0, Math.min(99, Math.floor(progress)));
        this.onLoadingProgress(this.audioLoadProgress);
    }

    /** ロード中フラグと進捗を更新し、Controllerへ通知する。 */
    setLoading(isLoading, progress) {
        this.isLoading = isLoading;
        this.audioLoadProgress = progress;
        this.onLoadingProgress(progress);
        this.onLoadingStateChange(isLoading);
    }

    /** 正転・逆転バッファの準備完了後にロードを完了状態へ切り替える。 */
    completeLoading() {
        if (!this.isSourceReady()) return;
        if (this.isPlaybackStarting && this.isPlaying) {
            this.setLoading(true, 99);
            return;
        }
        this.setLoading(false, 100);
    }

    /** 再生秒数を0以上の有限値へ正規化する。 */
    normalizeSeconds(seconds) {
        const value = Number(seconds);
        return Number.isFinite(value) && value >= 0 ? value : 0;
    }

    /** 再生秒数を音声の総時間以内へ制限する。 */
    clampSeconds(seconds) {
        return this.duration > 0 ? Math.min(this.normalizeSeconds(seconds), this.duration) : this.normalizeSeconds(seconds);
    }
}
