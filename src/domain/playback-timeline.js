import { PlaybackSeconds } from './playback-seconds.js';
import { PlaybackDirection } from './playback-direction.js';
import { PlaybackRate } from './playback-rate.js';

/** 再生位置を音源の時間範囲へ収めるドメインルール。 */
export class PlaybackTimeline {
    /** 再生秒数を正規化し、長さが既知なら音源の終端以内へ制限する。 */
    static normalizePosition(seconds, duration) {
        const position = new PlaybackSeconds(seconds).value;
        const totalDuration = Number(duration);
        if (!Number.isFinite(totalDuration) || totalDuration <= 0) return position;
        return Math.min(position, totalDuration);
    }

    /** 方向・速度・経過時間を反映し、音源内で循環する次の再生位置を返す。 */
    static positionAfter({ startPosition, elapsedSeconds, playbackRate, direction, duration }) {
        const totalDuration = Number(duration);
        if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
            return this.normalizePosition(startPosition, totalDuration);
        }
        const start = this.normalizePosition(startPosition, totalDuration);
        const elapsed = Number(elapsedSeconds);
        const safeElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
        const rate = new PlaybackRate(playbackRate).value;
        const directionFactor = new PlaybackDirection(direction).value === 'reverse' ? -1 : 1;
        const nextPosition = start + safeElapsed * rate * directionFactor;
        return ((nextPosition % totalDuration) + totalDuration) % totalDuration;
    }

    /** 基準位置を副音源のループ位置へ写し、逆方向なら位相を反転する。 */
    static offsetForLoopingTrack(position, trackDuration, direction) {
        const duration = Number(trackDuration);
        if (!Number.isFinite(duration) || duration <= 0) return 0;
        const positionInTrack = ((new PlaybackSeconds(position).value % duration) + duration) % duration;
        if (new PlaybackDirection(direction).value !== 'reverse' || positionInTrack === 0) return positionInTrack;
        return duration - positionInTrack;
    }
}
