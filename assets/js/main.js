import { RecordCatalogService } from './application/record-catalog-service.js';
import { PlaybackStateRepository } from './infrastructure/playback-state-repository.js';
import { RecordJsonRepository } from './infrastructure/record-json-repository.js';
import { WebAudioEngine } from './infrastructure/web-audio-engine.js';
import { RecordPickerController } from './record-picker.js';
import { RecordPlayerController } from './record-player.js';

// レコード一覧JSONの公開URL。
const RECORDS_LIST = '/assets/data/records.json';

// cookieを介して選択レコードと再生秒数を永続化する実装。
const playbackStateRepository = new PlaybackStateRepository();
// 音声再生とプレーヤー画面を接続するController。
const playerController = new RecordPlayerController({
    audioEngine: new WebAudioEngine(),
    playbackStateRepository,
});
playerController.initialize();
window.RecordPlayer = Object.freeze({
    // 既存の外部呼び出し向けに、音源切り替えAPIだけを公開する。
    setAudioSource: (...args) => playerController.setAudioSource(...args),
    // cookieに保存された再生秒数を返す。
    getStoredPlaybackSeconds: () => playerController.getStoredPlaybackSeconds(),
    // 再生と慣性回転を停止する。
    stop: () => playerController.stop(),
});

// JSONからレコード一覧を取得するアプリケーションサービス。
const recordCatalogService = new RecordCatalogService(new RecordJsonRepository(new URL(RECORDS_LIST, import.meta.url)));
// 選択画面とプレーヤーControllerを依存性注入で接続する。
const pickerController = new RecordPickerController({
    recordCatalogService,
    playerController,
    playbackStateRepository,
});
pickerController.initialize();
