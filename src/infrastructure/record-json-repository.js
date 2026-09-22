import { Record } from '../domain/record.js';

/** JSONファイルをレコードドメインモデルへ変換するリポジトリ。 */
export class RecordJsonRepository {
    /** レコード定義JSONの取得先URLを保持する。 */
    constructor(url, { fetchImpl = globalThis.fetch } = {}) {
        // 取得対象のJSON URLとブラウザーの実行環境に結び付けたfetch関数。
        this.url = url;
        this.fetch = fetchImpl.bind(globalThis);
    }

    /** JSONを取得し、各要素をRecordへ変換して返す。 */
    async findAll() {
        const response = await this.fetch(this.url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`レコード一覧の読み込みに失敗しました: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('レコード一覧の形式が不正です。');
        return data.map((item) => new Record(item));
    }
}
