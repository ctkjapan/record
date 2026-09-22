import { RecordSelectionPolicy } from '../domain/record-selection-policy.js';
import { RecordSelection } from '../domain/record-selection.js';

/** レコード選択状態、Catalog照会、選択時の再生切替を調停するアプリケーションサービス。 */
export class RecordSelectionService {
    /** Domain状態、レコード照会、選択時の再生切替を担当するサービスを受け取る。 */
    constructor({ recordCatalogService = null, playbackService = null } = {}) {
        // 選択レコードを解決するCatalogと、再生状態を切り替えるApplication Service。
        this.recordCatalogService = recordCatalogService;
        this.playbackService = playbackService;
        // 選択・フォーカス状態を保持するDomainモデル。
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

    /** 選択状態を更新し、対象レコードの取得と再生切替まで調停する。 */
    selectRecord(index) {
        if (!this.recordCatalogService || !this.playbackService) {
            throw new Error('レコード選択の依存サービスが設定されていません。');
        }
        // Domainの選択状態を更新し、その位置から選択対象を解決する。
        const selection = this.select(index);
        const record = this.recordCatalogService.getRecordAt(selection.selectedIndex);
        const { isRecordChanged } = this.playbackService.selectRecord(record);
        return { ...selection, record, isRecordChanged };
    }

    /** 保存済みレコードIDに対応するCatalog位置を取得する。 */
    indexOfRecordId(recordId) {
        if (!this.recordCatalogService) throw new Error('レコード一覧サービスが設定されていません。');
        return this.recordCatalogService.indexOfRecordId(recordId);
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
