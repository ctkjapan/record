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

    /** 選択中のレコードから左右方向に1件移動し、端では一覧を循環する。 */
    static adjacentIndex(selectedIndex, recordCount, direction) {
        if (!Number.isInteger(selectedIndex) || !Number.isInteger(recordCount) || recordCount < 2) return null;
        if (selectedIndex < 0 || selectedIndex >= recordCount) return null;
        if (direction === 'right') return (selectedIndex + 1) % recordCount;
        if (direction === 'left') return (selectedIndex - 1 + recordCount) % recordCount;
        return null;
    }
}
