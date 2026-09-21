// 選択レコードIDを保存するcookie名。
const RECORD_ID_COOKIE = 'groove-record-index';
// 音声ファイル上の再生秒数を保存するcookie名。
const PLAYBACK_SECONDS_COOKIE = 'groove-record-playback-seconds';
// 旧バージョンの再生位置cookie。既存ユーザーの状態復元に使用する。
const LEGACY_PLAYBACK_COOKIE = 'groove-record-playback-position';
// cookieを保持する期間（1年）。
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 選択状態と再生秒数をcookieへ保存・復元するリポジトリ。 */
export class PlaybackStateRepository {
    /** cookieからレコードIDと再生秒数を読み込み、異常値は初期値へ補正する。 */
    load() {
        const recordId = this.readCookie(RECORD_ID_COOKIE);
        const storedSeconds = this.readCookie(PLAYBACK_SECONDS_COOKIE) ?? this.readCookie(LEGACY_PLAYBACK_COOKIE);
        const playbackSeconds = Number(storedSeconds);
        return {
            recordId,
            playbackSeconds: Number.isFinite(playbackSeconds) && playbackSeconds >= 0 ? playbackSeconds : 0,
        };
    }

    /** 選択中レコードのIDをcookieへ保存する。 */
    saveRecordId(recordId) {
        this.writeCookie(RECORD_ID_COOKIE, recordId);
    }

    /** 音声ファイル上の再生秒数をcookieへ保存する。 */
    savePlaybackSeconds(seconds) {
        this.writeCookie(PLAYBACK_SECONDS_COOKIE, String(Math.max(0, Number(seconds) || 0)));
    }

    /** 指定名のcookie値を読み込む。 */
    readCookie(name) {
        const cookie = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
    }

    /** cookie値をURLエンコードして保存する。 */
    writeCookie(name, value) {
        document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
    }
}
