import { RecordSelectionPolicy } from './record-selection-policy.js';

/** レコード選択画面のフォーカス位置と確定選択位置を管理するドメイン状態。 */
export class RecordSelection {
    /** レコード件数と保存済みの選択位置から選択状態を作る。 */
    constructor(recordCount, selectedIndex = 0) {
        const normalizedIndex = RecordSelectionPolicy.normalizeIndex(selectedIndex, recordCount);
        if (normalizedIndex === null) throw new Error('レコード選択には1件以上必要です。');
        // 一覧件数と、確定選択・現在フォーカス中の位置。
        this.recordCount = recordCount;
        this.selectedIndex = normalizedIndex;
        this.focusedIndex = normalizedIndex;
    }

    /** フォーカス位置を有効範囲へ補正して更新する。 */
    focus(index) {
        this.focusedIndex = RecordSelectionPolicy.normalizeIndex(index, this.recordCount);
        return this.toSnapshot();
    }

    /** フォーカス中のレコードを選択状態へ確定する。 */
    select(index = this.focusedIndex) {
        const normalizedIndex = RecordSelectionPolicy.normalizeIndex(index, this.recordCount);
        this.focusedIndex = normalizedIndex;
        this.selectedIndex = normalizedIndex;
        return this.toSnapshot();
    }

    /** 現在のフォーカスが端にあり外向き操作なら循環先へ移動する。 */
    wrap(direction) {
        const wrappedIndex = RecordSelectionPolicy.wrapTargetIndex(this.focusedIndex, this.recordCount, direction);
        if (wrappedIndex === null) return null;
        this.focusedIndex = wrappedIndex;
        return this.toSnapshot();
    }

    /** 確定選択位置から左右の隣接レコード位置を求める。 */
    adjacentIndex(direction) {
        return RecordSelectionPolicy.adjacentIndex(this.selectedIndex, this.recordCount, direction);
    }

    /** UIへ渡す選択状態の複製を返す。 */
    toSnapshot() {
        return { selectedIndex: this.selectedIndex, focusedIndex: this.focusedIndex };
    }
}
