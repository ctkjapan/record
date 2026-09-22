import { PlaybackPolicy } from '../domain/playback-policy.js';
import { PlaybackDirection } from '../domain/playback-direction.js';
import { PlaybackRate } from '../domain/playback-rate.js';
import { PlaybackSession } from '../domain/playback-session.js';

/** 再生状態の復元・選択・速度変更を調停するアプリケーションサービス。 */
export class PlaybackService {
    /** 音声ポートと状態保存ポートを受け取り、現在セッションを初期化する。 */
    constructor({ audioEngine, playbackStateRepository }) {
        this.audioEngine = audioEngine;
        this.playbackStateRepository = playbackStateRepository;
        this.session = new PlaybackSession(playbackStateRepository.load());
    }

    /** 音声再生の状態表示に必要な読み取り専用情報を返す。 */
    getAudioState() {
        return {
            isNoiseEnabled: this.audioEngine.isNoiseEnabled,
            direction: this.audioEngine.direction,
            duration: this.audioEngine.duration,
            playbackRate: this.audioEngine.playbackRate,
            isLoading: this.audioEngine.isLoading,
            audioLoadProgress: this.audioEngine.audioLoadProgress,
            isPlaying: this.audioEngine.isPlaying,
            hasSource: this.audioEngine.hasSource,
        };
    }

    get audioState() {
        return this.getAudioState();
    }

    /** 音声ロード状態・エラーの通知先を登録する。 */
    setAudioCallbacks(callbacks) {
        this.audioEngine.setCallbacks(callbacks);
    }

    /** 初回ユーザー操作で音声再生を有効化する。 */
    activateAudio() {
        return this.audioEngine.unlock();
    }

    /** 選択レコードの音源を読み込む。 */
    setAudioSource(sourceUrl, initialSeconds = 0) {
        return this.audioEngine.setSource(sourceUrl, initialSeconds);
    }

    getCurrentSeconds() {
        return this.audioEngine.getCurrentSeconds();
    }

    getFrequencyData() {
        return this.audioEngine.getFrequencyData();
    }

    getTimeDomainData() {
        return this.audioEngine.getTimeDomainData();
    }

    play() {
        return this.audioEngine.play();
    }

    stop() {
        this.audioEngine.stop();
    }

    seek(seconds) {
        this.audioEngine.seek(seconds);
    }

    previewSeek(seconds) {
        this.audioEngine.previewSeek(seconds);
    }

    setDirection(direction) {
        const normalizedDirection = new PlaybackDirection(direction).value;
        this.audioEngine.setDirection(normalizedDirection);
        return normalizedDirection;
    }

    /** 保存済みノイズ設定を音声エンジンへ復元する。 */
    async restore() {
        await this.audioEngine.setNoiseEnabled(this.session.noiseEnabled);
        return this.session.toSnapshot();
    }

    /** 現在のドメイン状態を画面初期化用に返す。 */
    getState() {
        return this.session.toSnapshot();
    }

    /** レコード選択時の停止・状態保存・音源切り替えを調停する。 */
    selectRecord(record) {
        const isRecordChanged = this.session.recordId !== record.id;
        const initialSeconds = this.session.recordId === record.id ? this.session.playbackSeconds : 0;
        if (isRecordChanged) {
            this.audioEngine.stop();
            this.savePlaybackSeconds(this.audioEngine.getCurrentSeconds());
        }
        this.session = this.session.selectRecord(record.id);
        this.playbackStateRepository.saveRecordId(record.id);
        this.setAudioSource(record.audioUrl, initialSeconds).catch(() => {});
        return { isRecordChanged };
    }

    /** 再生速度をドメインルールで補正して音声エンジンへ反映する。 */
    setPlaybackRate(rate) {
        const playbackRate = new PlaybackRate(rate);
        this.audioEngine.setPlaybackRate(playbackRate.value);
        return playbackRate.value;
    }

    /** 現在速度へ差分を加算して新しい速度を設定する。 */
    adjustPlaybackRate(delta) {
        return this.setPlaybackRate(new PlaybackRate(this.audioEngine.playbackRate).add(delta).value);
    }

    /** ドメインの速度変化ルールに従い、目標速度へ近づける。 */
    approachPlaybackRate(targetRate) {
        const transition = PlaybackPolicy.nextSmoothedRate(this.audioEngine.playbackRate, targetRate);
        this.setPlaybackRate(transition.rate);
        return transition;
    }

    rotationSpeedPercentFromRate(rate) {
        return PlaybackPolicy.rotationSpeedPercentFromRate(rate);
    }

    rateFromRotationSpeedPercent(speedPercent) {
        return PlaybackPolicy.rateFromRotationSpeedPercent(speedPercent);
    }

    rotationVelocityFromSpeedPercent(speedPercent, direction) {
        return PlaybackPolicy.rotationVelocityFromSpeedPercent(speedPercent, direction);
    }

    rotationSpeedPercentFromVelocity(velocity) {
        return PlaybackPolicy.rotationSpeedPercentFromVelocity(velocity);
    }

    resolveDirectionFromRotation(velocity) {
        return PlaybackPolicy.directionFromRotationVelocity(velocity, this.audioEngine.direction);
    }

    isCurrentRatePlayable() {
        return new PlaybackRate(this.audioEngine.playbackRate).isPlayable;
    }

    get minimumPlaybackRate() {
        return new PlaybackRate().value;
    }

    /** 再生方向を反転し、音声エンジンへ反映する。 */
    toggleDirection() {
        const nextDirection = new PlaybackDirection(this.audioEngine.direction).reverse().value;
        this.setDirection(nextDirection);
        return nextDirection;
    }

    /** ノイズ同期状態を切り替え、失敗時はOFFへ戻す。 */
    async toggleNoise() {
        const nextEnabled = !this.audioEngine.isNoiseEnabled;
        try {
            await this.audioEngine.setNoiseEnabled(nextEnabled);
            this.session = this.session.withNoiseEnabled(this.audioEngine.isNoiseEnabled);
            this.playbackStateRepository.saveNoiseEnabled(this.session.noiseEnabled);
            return this.session.noiseEnabled;
        } catch (error) {
            this.session = this.session.withNoiseEnabled(false);
            this.playbackStateRepository.saveNoiseEnabled(false);
            throw error;
        }
    }

    /** ビジュアライザー描画状態を切り替え、cookieへ保存する。 */
    toggleVisualizer() {
        this.session = this.session.withVisualizerEnabled(!this.session.visualizerEnabled);
        this.playbackStateRepository.saveVisualizerEnabled(this.session.visualizerEnabled);
        return this.session.visualizerEnabled;
    }

    /** 現在の再生秒数をセッションとcookieへ保存する。 */
    savePlaybackSeconds(seconds) {
        this.session = this.session.withPlaybackSeconds(seconds);
        this.playbackStateRepository.savePlaybackSeconds(this.session.playbackSeconds);
    }

    /** 保存済み再生秒数を返す。 */
    getStoredPlaybackSeconds() {
        return this.session.playbackSeconds;
    }
}
