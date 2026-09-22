import { Record } from './record.js';

/** レコード一覧を管理し、存在するレコードだけを返すドメインモデル。 */
export class RecordCatalog {
    /** 空の一覧、不正要素、重複IDを拒否し、配列を不変にする。 */
    constructor(records) {
        if (!Array.isArray(records) || records.length === 0) throw new Error('レコード一覧が空です。');
        const entries = [...records];
        if (entries.some((record) => !(record instanceof Record))) {
            throw new Error('レコード一覧に不正な要素があります。');
        }
        if (new Set(entries.map((record) => record.id)).size !== entries.length) {
            throw new Error('レコード一覧に重複したIDがあります。');
        }
        this.records = Object.freeze(entries);
    }

    /** 管理している全レコードを返す。 */
    all() {
        return this.records;
    }

    /** 配列位置からレコードを取得し、存在しない場合はエラーにする。 */
    at(index) {
        const record = this.records[index];
        if (!record) throw new Error(`レコードが見つかりません: ${index}`);
        return record;
    }

    /** レコードIDから配列位置を求め、見つからない場合は先頭を返す。 */
    indexOfId(id) {
        const index = this.records.findIndex((record) => record.id === id);
        return index >= 0 ? index : 0;
    }
}
