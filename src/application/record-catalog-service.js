import { RecordCatalog } from '../domain/record-catalog.js';

/** レコード一覧取得のユースケースを提供するアプリケーションサービス。 */
export class RecordCatalogService {
    // Domain集約はアプリケーション層に閉じ込める状態。
    #recordCatalog = null;

    /** レコード取得を担当するリポジトリを受け取る。 */
    constructor(recordRepository) {
        this.recordRepository = recordRepository;
    }

    /** リポジトリから一覧を読み込み、Presentation向けにレコード配列を返す。 */
    async load() {
        this.#recordCatalog = new RecordCatalog(await this.recordRepository.findAll());
        return this.#recordCatalog.all();
    }

    /** レコードIDから表示・選択に使う一覧位置を求める。 */
    indexOfRecordId(recordId) {
        return this.#requireCatalog().indexOfId(recordId);
    }

    /** 一覧位置から選択対象のレコードを取得する。 */
    getRecordAt(index) {
        return this.#requireCatalog().at(index);
    }

    /** 読み込み済みのDomain集約を取得し、未ロードなら呼び出し順の誤りを示す。 */
    #requireCatalog() {
        if (!this.#recordCatalog) throw new Error('レコード一覧が読み込まれていません。');
        return this.#recordCatalog;
    }
}
