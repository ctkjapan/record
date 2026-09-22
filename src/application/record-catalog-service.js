import { RecordCatalog } from '../domain/record-catalog.js';

/** レコード一覧取得のユースケースを提供するアプリケーションサービス。 */
export class RecordCatalogService {
    /** レコード取得を担当するリポジトリを受け取る。 */
    constructor(recordRepository) {
        this.recordRepository = recordRepository;
    }

    /** リポジトリのデータからドメインのRecordCatalogを生成する。 */
    async load() {
        return new RecordCatalog(await this.recordRepository.findAll());
    }
}
