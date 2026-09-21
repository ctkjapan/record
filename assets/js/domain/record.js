/** レコード1件のドメインモデル。表示情報と再生対象URLを保持する。 */
export class Record {
    /** JSONのレコード定義を検証し、表示用のアーティスト名と曲名を分離する。 */
    constructor({ id, title, color, audioUrl, imageUrl }) {
        if (!id || !title || !color || !audioUrl || !imageUrl) throw new Error('レコード定義が不正です。');
        const [artist, ...titleParts] = title.split(' / ');
        this.id = id;
        this.title = title;
        this.artist = artist;
        this.trackTitle = titleParts.join(' / ') || title;
        this.color = color;
        this.audioUrl = audioUrl;
        this.imageUrl = imageUrl;
        Object.freeze(this);
    }
}
