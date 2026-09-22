// 再生方向のドメイン値。
export const PLAYBACK_DIRECTION_FORWARD = 'forward';
export const PLAYBACK_DIRECTION_REVERSE = 'reverse';

/** 正転・逆転を不変値として扱うドメイン値オブジェクト。 */
export class PlaybackDirection {
    /** 不正な方向を正転へ補正する。 */
    constructor(value = PLAYBACK_DIRECTION_FORWARD) {
        this.value = value === PLAYBACK_DIRECTION_REVERSE
            ? PLAYBACK_DIRECTION_REVERSE
            : PLAYBACK_DIRECTION_FORWARD;
        Object.freeze(this);
    }

    /** 現在方向の反対方向を返す。 */
    reverse() {
        return new PlaybackDirection(this.value === PLAYBACK_DIRECTION_REVERSE
            ? PLAYBACK_DIRECTION_FORWARD
            : PLAYBACK_DIRECTION_REVERSE);
    }
}
