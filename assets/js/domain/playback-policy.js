import { MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE, PlaybackRate } from './playback-rate.js';

// 回転と音声再生を同期するためのドメインルール設定。
export const MOMENTUM_PERSISTENCE_RATE = 1;
export const PLAYBACK_RATE_SMOOTHING = 0.1;
export const ROTATION_SPEED_SCALE = 8;
const MIN_CENTER_SPEED_PERCENT = 45;
const MAX_CENTER_SPEED_PERCENT = 55;
const PLAYBACK_RATE_SETTLING_THRESHOLD = 0.01;

/** レコード回転と音声再生速度の変換ルールを提供するドメインサービス。 */
export class PlaybackPolicy {
    /** 音声再生速度をレコード回転の速度割合へ変換する。 */
    static rotationSpeedPercentFromRate(rate) {
        const normalizedRate = new PlaybackRate(rate).value;
        if (normalizedRate <= 1) return normalizedRate * MIN_CENTER_SPEED_PERCENT;
        return MAX_CENTER_SPEED_PERCENT
            + ((normalizedRate - 1) / (MAX_PLAYBACK_RATE - 1)) * (100 - MAX_CENTER_SPEED_PERCENT);
    }

    /** レコード回転の速度割合を音声再生速度へ変換する。 */
    static rateFromRotationSpeedPercent(speedPercent) {
        if (speedPercent <= MIN_CENTER_SPEED_PERCENT) {
            return MIN_PLAYBACK_RATE + (speedPercent / MIN_CENTER_SPEED_PERCENT) * (1 - MIN_PLAYBACK_RATE);
        }
        if (speedPercent <= MAX_CENTER_SPEED_PERCENT) return 1;
        return 1 + ((speedPercent - MAX_CENTER_SPEED_PERCENT) / MIN_CENTER_SPEED_PERCENT) * (MAX_PLAYBACK_RATE - 1);
    }

    /** 目標速度へ滑らかに近づく次の速度と収束状態を返す。 */
    static nextSmoothedRate(currentRate, targetRate) {
        const current = new PlaybackRate(currentRate).value;
        const target = new PlaybackRate(targetRate).value;
        const difference = target - current;
        if (Math.abs(difference) < PLAYBACK_RATE_SETTLING_THRESHOLD) {
            return { rate: target, isSettled: true };
        }
        return {
            rate: new PlaybackRate(current + difference * PLAYBACK_RATE_SMOOTHING).value,
            isSettled: false,
        };
    }

    /** レコード回転の向きから次の音声再生方向を決める。 */
    static directionFromRotationVelocity(velocity, currentDirection) {
        if (velocity < 0) return 'reverse';
        if (velocity > 0) return 'forward';
        return currentDirection;
    }

}
