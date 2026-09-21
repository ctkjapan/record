import { Record } from '../domain/record.js';

/** JSONファイルをレコードドメインモデルへ変換するリポジトリ。 */
export class RecordJsonRepository {
    /** レコード定義JSONの取得先URLを保持する。 */
    constructor(url) {
        this.url = url;
    }

    /** JSONを取得し、各要素をRecordへ変換して返す。 */
    async findAll() {
        const response = await fetch(this.url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`レコード一覧の読み込みに失敗しました: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('レコード一覧の形式が不正です。');
        return data.map((item) => new Record(item));
    }
}
