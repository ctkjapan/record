// 再生方向のドメイン値。
export const PLAYBACK_DIRECTION_FORWARD = 'forward';
export const PLAYBACK_DIRECTION_REVERSE = 'reverse';

/** 正転・逆転の切り替えルールを表すドメインサービス。 */
export class PlaybackDirection {
    /** 不正な方向を正転へ補正する。 */
    static normalize(direction) {
        return direction === PLAYBACK_DIRECTION_REVERSE
            ? PLAYBACK_DIRECTION_REVERSE
            : PLAYBACK_DIRECTION_FORWARD;
    }

    /** 現在方向の反対方向を返す。 */
    static reverse(direction) {
        return this.normalize(direction) === PLAYBACK_DIRECTION_REVERSE
            ? PLAYBACK_DIRECTION_FORWARD
            : PLAYBACK_DIRECTION_REVERSE;
    }
}
