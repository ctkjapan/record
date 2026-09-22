import { PlaybackSeconds } from './playback-seconds.js';

/** 再生位置を音源の時間範囲へ収めるドメインルール。 */
export class PlaybackTimeline {
    /** 再生秒数を正規化し、長さが既知なら音源の終端以内へ制限する。 */
    static normalizePosition(seconds, duration) {
        const position = new PlaybackSeconds(seconds).value;
        const totalDuration = Number(duration);
        if (!Number.isFinite(totalDuration) || totalDuration <= 0) return position;
        return Math.min(position, totalDuration);
    }
}
