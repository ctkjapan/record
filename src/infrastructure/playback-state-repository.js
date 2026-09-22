import { PlaybackSeconds } from '../domain/playback-seconds.js';

// 選択レコードIDを保存するcookie名。
const RECORD_ID_COOKIE = 'groove-record-index';
// 音声ファイル上の再生秒数を保存するcookie名。
const PLAYBACK_SECONDS_COOKIE = 'groove-record-playback-seconds';
// ノイズ音声の同期再生状態を保存するcookie名。
const NOISE_ENABLED_COOKIE = 'groove-record-noise-enabled';
// ビジュアライザー描画状態を保存するcookie名。
const VISUALIZER_ENABLED_COOKIE = 'groove-record-visualizer-enabled';
// 旧バージョンの再生位置cookie。既存ユーザーの状態復元に使用する。
const LEGACY_PLAYBACK_COOKIE = 'groove-record-playback-position';
// cookieを保持する期間（1年）。
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 選択状態、再生秒数、音声設定をcookieへ保存・復元するリポジトリ。 */
export class PlaybackStateRepository {
    constructor({ documentRef = globalThis.document } = {}) {
        this.document = documentRef;
    }

    /** cookieから再生状態を読み込み、異常値は初期値へ補正する。 */
    load() {
        const recordId = this.readCookie(RECORD_ID_COOKIE);
        const storedSeconds = this.readCookie(PLAYBACK_SECONDS_COOKIE) ?? this.readCookie(LEGACY_PLAYBACK_COOKIE);
        return {
            recordId,
            playbackSeconds: new PlaybackSeconds(storedSeconds).value,
            noiseEnabled: this.readCookie(NOISE_ENABLED_COOKIE) === 'true',
            visualizerEnabled: this.readCookie(VISUALIZER_ENABLED_COOKIE) !== 'false',
        };
    }

    /** 選択中レコードのIDをcookieへ保存する。 */
    saveRecordId(recordId) {
        this.writeCookie(RECORD_ID_COOKIE, recordId);
    }

    /** 音声ファイル上の再生秒数をcookieへ保存する。 */
    savePlaybackSeconds(seconds) {
        this.writeCookie(PLAYBACK_SECONDS_COOKIE, String(new PlaybackSeconds(seconds).value));
    }

    /** ノイズ音声の同期再生状態をcookieへ保存する。 */
    saveNoiseEnabled(enabled) {
        this.writeCookie(NOISE_ENABLED_COOKIE, String(Boolean(enabled)));
    }

    /** ビジュアライザー描画状態をcookieへ保存する。 */
    saveVisualizerEnabled(enabled) {
        this.writeCookie(VISUALIZER_ENABLED_COOKIE, String(Boolean(enabled)));
    }

    /** 指定名のcookie値を読み込む。 */
    readCookie(name) {
        const cookie = this.document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
        if (!cookie) return null;
        try {
            return decodeURIComponent(cookie.slice(name.length + 1));
        } catch {
            return null;
        }
    }

    /** cookie値をURLエンコードして保存する。 */
    writeCookie(name, value) {
        this.document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
    }
}
