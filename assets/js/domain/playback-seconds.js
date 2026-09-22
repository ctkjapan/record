/** 再生位置を非負の有限秒数として扱うドメイン値オブジェクト。 */
export class PlaybackSeconds {
    /** 秒数を検証し、不正値を0へ正規化する。 */
    constructor(value = 0) {
        const numericValue = Number(value);
        this.value = Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
        Object.freeze(this);
    }
}
