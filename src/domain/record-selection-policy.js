/** レコード選択画面で端まで移動した際の循環ルール。 */
export class RecordSelectionPolicy {
    /** レコード件数の範囲内へインデックスを補正する。 */
    static normalizeIndex(index, recordCount) {
        if (!Number.isInteger(recordCount) || recordCount < 1) return null;
        const normalizedIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
        return Math.min(recordCount - 1, Math.max(0, normalizedIndex));
    }

    /** 端から外向きに操作した場合の移動先を返す。 */
    static wrapTargetIndex(focusedIndex, recordCount, direction) {
        if (!Number.isInteger(focusedIndex) || !Number.isInteger(recordCount) || recordCount < 2) return null;
        if (direction === 'right' && focusedIndex === 0) return recordCount - 1;
        if (direction === 'left' && focusedIndex === recordCount - 1) return 0;
        return null;
    }
}
