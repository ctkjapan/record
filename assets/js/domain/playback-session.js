/** 選択レコードに紐づく再生位置とノイズ設定を保持するドメイン状態。 */
export class PlaybackSession {
    /** 保存済み状態を検証し、再生秒数を非負値へ補正する。 */
    constructor({ recordId = null, playbackSeconds = 0, noiseEnabled = false } = {}) {
        this.recordId = recordId;
        this.playbackSeconds = this.normalizeSeconds(playbackSeconds);
        this.noiseEnabled = Boolean(noiseEnabled);
        Object.freeze(this);
    }

    /** レコード選択後の新しいセッション状態を返す。 */
    selectRecord(recordId) {
        return new PlaybackSession({
            recordId,
            playbackSeconds: this.recordId === recordId ? this.playbackSeconds : 0,
            noiseEnabled: this.noiseEnabled,
        });
    }

    /** 再生秒数を更新した新しいセッション状態を返す。 */
    withPlaybackSeconds(seconds) {
        return new PlaybackSession({
            recordId: this.recordId,
            playbackSeconds: seconds,
            noiseEnabled: this.noiseEnabled,
        });
    }

    /** ノイズ同期状態を更新した新しいセッション状態を返す。 */
    withNoiseEnabled(noiseEnabled) {
        return new PlaybackSession({
            recordId: this.recordId,
            playbackSeconds: this.playbackSeconds,
            noiseEnabled,
        });
    }

    /** cookie保存用の単純な状態オブジェクトへ変換する。 */
    toSnapshot() {
        return {
            recordId: this.recordId,
            playbackSeconds: this.playbackSeconds,
            noiseEnabled: this.noiseEnabled,
        };
    }

    /** 再生秒数を非負の有限値へ補正する。 */
    normalizeSeconds(seconds) {
        const value = Number(seconds);
        return Number.isFinite(value) && value >= 0 ? value : 0;
    }
}
