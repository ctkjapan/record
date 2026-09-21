// 再生速度の許容範囲。
export const MIN_PLAYBACK_RATE = 0;
export const MAX_PLAYBACK_RATE = 2;

/** 再生速度を不変値として扱うドメイン値オブジェクト。 */
export class PlaybackRate {
    /** 再生速度を検証して許容範囲へ正規化する。 */
    constructor(value = 0) {
        const numericValue = Number(value);
        const safeValue = Number.isFinite(numericValue) ? numericValue : MIN_PLAYBACK_RATE;
        this.value = Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, safeValue));
        Object.freeze(this);
    }

    /** 指定値を加算した新しい再生速度を返す。 */
    add(delta) {
        return new PlaybackRate(this.value + Number(delta || 0));
    }

    /** 音声を再生可能な速度か判定する。 */
    get isPlayable() {
        return this.value >= MIN_PLAYBACK_RATE;
    }
}
