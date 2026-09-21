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

    /** 保存済みノイズ設定を音声エンジンへ復元する。 */
    async restore() {
        await this.audioEngine.setNoiseEnabled(this.session.noiseEnabled);
        return this.session.toSnapshot();
    }

    /** 現在のドメイン状態を画面初期化用に返す。 */
    getState() {
        return this.session.toSnapshot();
    }

    /** レコードを選択し、保存済み状態から初期秒数を返す。 */
    selectRecord(record) {
        const isRecordChanged = this.session.recordId !== record.id;
        const initialSeconds = this.session.recordId === record.id ? this.session.playbackSeconds : 0;
        this.session = this.session.selectRecord(record.id);
        this.playbackStateRepository.saveRecordId(record.id);
        return { isRecordChanged, initialSeconds };
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

    /** 再生方向を反転し、音声エンジンへ反映する。 */
    toggleDirection() {
        const nextDirection = PlaybackDirection.reverse(this.audioEngine.direction);
        this.audioEngine.setDirection(nextDirection);
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
