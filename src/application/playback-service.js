import { PlaybackPolicy } from '../domain/playback-policy.js';
import { PlaybackDirection } from '../domain/playback-direction.js';
import { PlaybackRate } from '../domain/playback-rate.js';
import { PlaybackSession } from '../domain/playback-session.js';
import { PlaybackTimeline } from '../domain/playback-timeline.js';

/** 再生状態の復元・選択・速度変更を調停するアプリケーションサービス。 */
export class PlaybackService {
    /** 音声ポートと状態保存ポートを受け取り、現在セッションを初期化する。 */
    constructor({ audioEngine, playbackStateRepository }) {
        // 音声操作を委譲するエンジンと、再生状態を保存するリポジトリ。
        this.audioEngine = audioEngine;
        this.playbackStateRepository = playbackStateRepository;
        // 永続化状態をドメイン型へ復元した現在の再生セッション。
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

    /** UI Controllerが参照する現在の音声状態を返す。 */
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

    /** 画面切替やブラウザー復帰時に自動再生を継続できるか確認する。 */
    isAutoplayAllowed() {
        return this.audioEngine.isAutoplayAllowed();
    }

    /** 選択レコードの音源を読み込む。 */
    setAudioSource(sourceUrl, initialSeconds = 0) {
        return this.audioEngine.setSource(sourceUrl, initialSeconds);
    }

    /** 音声エンジンの現在の再生位置を秒で返す。 */
    getCurrentSeconds() {
        return this.audioEngine.getCurrentSeconds();
    }

    /** ビジュアライザー用の周波数データを取得する。 */
    getFrequencyData() {
        return this.audioEngine.getFrequencyData();
    }

    /** ビジュアライザー用の時間領域データを取得する。 */
    getTimeDomainData() {
        return this.audioEngine.getTimeDomainData();
    }

    /** 音声エンジンで再生を開始する。 */
    play() {
        return this.audioEngine.play();
    }

    /** 音声エンジンの再生を停止する。 */
    stop() {
        this.audioEngine.stop();
    }

    /** 指定位置へ移動して音声エンジンの再生位置を更新する。 */
    seek(seconds) {
        this.audioEngine.seek(seconds);
    }

    /** シーク確定前のプレビュー位置を音声エンジンへ伝える。 */
    previewSeek(seconds) {
        this.audioEngine.previewSeek(seconds);
    }

    /** 再生位置を現在の音源の時間範囲へ補正する。 */
    normalizePlaybackPosition(seconds) {
        return PlaybackTimeline.normalizePosition(seconds, this.audioEngine.duration);
    }

    /** 再生方向を正規化して音声エンジンへ反映する。 */
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
        if (isRecordChanged) {
            this.audioEngine.stop();
            this.savePlaybackSeconds(this.audioEngine.getCurrentSeconds());
        }
        this.session = this.session.selectRecord(record.id);
        this.playbackStateRepository.saveRecordId(record.id);
        this.setAudioSource(record.audioUrl, this.session.playbackSeconds).catch(() => {});
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

    /** 再生速度をレコード回転速度の割合へ変換する。 */
    rotationSpeedPercentFromRate(rate) {
        return PlaybackPolicy.rotationSpeedPercentFromRate(rate);
    }

    /** 回転速度の割合を音声再生速度へ変換する。 */
    rateFromRotationSpeedPercent(speedPercent) {
        return PlaybackPolicy.rateFromRotationSpeedPercent(speedPercent);
    }

    /** 回転速度の割合と方向から符号付き速度を計算する。 */
    rotationVelocityFromSpeedPercent(speedPercent, direction) {
        return PlaybackPolicy.rotationVelocityFromSpeedPercent(speedPercent, direction);
    }

    /** 符号付き回転速度を画面表示用の割合へ変換する。 */
    rotationSpeedPercentFromVelocity(velocity) {
        return PlaybackPolicy.rotationSpeedPercentFromVelocity(velocity);
    }

    /** 回転角度差を最短方向の範囲へ補正する。 */
    normalizeRotationDelta(delta) {
        return PlaybackPolicy.normalizeRotationDelta(delta);
    }

    /** 角度差と経過時間から回転速度を計算する。 */
    rotationVelocityFromDelta(delta, elapsedMilliseconds) {
        return PlaybackPolicy.rotationVelocityFromDelta(delta, elapsedMilliseconds);
    }

    /** ポインター解放後に慣性回転を開始できる速度か判定する。 */
    shouldStartRotationMomentum(velocity) {
        return PlaybackPolicy.shouldStartRotationMomentum(velocity);
    }

    /** 継続中の慣性速度が停止基準を下回ったか判定する。 */
    isRotationMomentumBelowThreshold(velocity) {
        return PlaybackPolicy.isRotationMomentumBelowThreshold(velocity);
    }

    /** 回転方向と現在の再生方向から音声の再生方向を決める。 */
    resolveDirectionFromRotation(velocity) {
        return PlaybackPolicy.directionFromRotationVelocity(velocity, this.audioEngine.direction);
    }

    /** 現在の再生速度が音声再生可能な範囲か判定する。 */
    isCurrentRatePlayable() {
        return new PlaybackRate(this.audioEngine.playbackRate).isPlayable;
    }

    /** 再生速度の最小値をドメインルールから返す。 */
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
        this.session = this.session.toggleVisualizer();
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
