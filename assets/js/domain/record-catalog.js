/** レコード一覧を管理し、存在するレコードだけを返すドメインモデル。 */
export class RecordCatalog {
    /** 空の一覧を拒否し、外部から配列を直接変更できないようにする。 */
    constructor(records) {
        if (!Array.isArray(records) || records.length === 0) throw new Error('レコード一覧が空です。');
        this.records = Object.freeze([...records]);
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
