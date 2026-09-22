import { RecordSelectionPolicy } from '../domain/record-selection-policy.js';
import { RecordSelection } from '../domain/record-selection.js';

/** レコード選択に関するドメインルールを画面操作から利用するアプリケーションサービス。 */
export class RecordSelectionService {
    /** 画面操作で使う選択状態が未初期化の状態から開始する。 */
    constructor() {
        this.selection = null;
    }

    /** 一覧件数と保存済み選択位置から選択状態を作る。 */
    initialize(recordCount, selectedIndex = 0) {
        this.selection = new RecordSelection(recordCount, selectedIndex);
        return this.selection.toSnapshot();
    }

    /** 現在の選択・フォーカス状態を返す。 */
    getState() {
        return this.selection?.toSnapshot() ?? { selectedIndex: 0, focusedIndex: 0 };
    }

    /** フォーカス対象を更新する。 */
    focus(index) {
        if (!this.selection) return this.getState();
        return this.selection.focus(index);
    }

    /** 指定レコードを選択済み状態へ確定する。 */
    select(index) {
        if (!this.selection) return this.getState();
        return this.selection.select(index);
    }

    /** 現在のフォーカス位置を端から循環する。 */
    wrap(direction) {
        return this.selection?.wrap(direction) ?? null;
    }

    /** 端循環ルールに従う移動先を返す。 */
    wrapTargetIndex(focusedIndex, recordCount, direction) {
        return RecordSelectionPolicy.wrapTargetIndex(focusedIndex, recordCount, direction);
    }

    /** 選択中レコードの左右にある次候補位置を取得する。 */
    getAdjacentSelectedIndex(direction) {
        return this.selection?.adjacentIndex(direction) ?? null;
    }
}
