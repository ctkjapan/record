/** レコードの回転速度割合を0〜100%の不変値として扱う。 */
export class RotationSpeedPercent {
    /** 数値でない値は0へ、範囲外の値は0〜100へ正規化する。 */
    constructor(value = 0) {
        const numericValue = Number(value);
        const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
        this.value = Math.min(100, Math.max(0, safeValue));
        Object.freeze(this);
    }
}
