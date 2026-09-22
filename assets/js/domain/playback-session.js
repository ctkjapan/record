import { PlaybackSeconds } from './playback-seconds.js';

/** 選択レコードに紐づく再生位置と音声表示設定を保持するドメイン状態。 */
export class PlaybackSession {
    /** 保存済み状態を検証し、再生秒数を非負値へ補正する。 */
    constructor({ recordId = null, playbackSeconds = 0, noiseEnabled = false, visualizerEnabled = true } = {}) {
        this.recordId = recordId;
        this.playbackSeconds = new PlaybackSeconds(playbackSeconds).value;
        this.noiseEnabled = Boolean(noiseEnabled);
        this.visualizerEnabled = Boolean(visualizerEnabled);
        Object.freeze(this);
    }

    /** レコード選択後の新しいセッション状態を返す。 */
    selectRecord(recordId) {
        return new PlaybackSession({
            recordId,
            playbackSeconds: this.recordId === recordId ? this.playbackSeconds : 0,
            noiseEnabled: this.noiseEnabled,
            visualizerEnabled: this.visualizerEnabled,
        });
    }

    /** 再生秒数を更新した新しいセッション状態を返す。 */
    withPlaybackSeconds(seconds) {
        return new PlaybackSession({
            recordId: this.recordId,
            playbackSeconds: seconds,
            noiseEnabled: this.noiseEnabled,
            visualizerEnabled: this.visualizerEnabled,
        });
    }

    /** ノイズ同期状態を更新した新しいセッション状態を返す。 */
    withNoiseEnabled(noiseEnabled) {
        return new PlaybackSession({
            recordId: this.recordId,
            playbackSeconds: this.playbackSeconds,
            noiseEnabled,
            visualizerEnabled: this.visualizerEnabled,
        });
    }

    /** ビジュアライザー描画状態を更新した新しいセッション状態を返す。 */
    withVisualizerEnabled(visualizerEnabled) {
        return new PlaybackSession({
            recordId: this.recordId,
            playbackSeconds: this.playbackSeconds,
            noiseEnabled: this.noiseEnabled,
            visualizerEnabled,
        });
    }

    /** cookie保存用の単純な状態オブジェクトへ変換する。 */
    toSnapshot() {
        return {
            recordId: this.recordId,
            playbackSeconds: this.playbackSeconds,
            noiseEnabled: this.noiseEnabled,
            visualizerEnabled: this.visualizerEnabled,
        };
    }
}
