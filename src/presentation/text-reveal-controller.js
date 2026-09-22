// プレーヤー画面のheroを再表示する間隔（10秒）。
const HERO_REVEAL_INTERVAL_MS = 10_000;

/** テキストを1文字ずつ下から表示するアニメーションController。 */
export class TextRevealController {
    /** テキスト表示対象を探すDocumentとタイマー制御用Windowを受け取る。 */
    constructor({ documentRef = document, windowRef = window } = {}) {
        this.document = documentRef;
        this.window = windowRef;
        // 初回表示とレコード情報の更新でアニメーションする要素。
        this.splashScreen = this.document.querySelector('#splashScreen');
        this.splashTitle = this.document.querySelector('#splashTitle');
        this.hero = this.document.querySelector('#hero');
        // hero表示を繰り返すsetIntervalの識別子。
        this.heroRevealInterval = null;
    }

    /** 初回表示対象のテキストアニメーションを開始する。 */
    initialize() {
        this.reveal(this.splashTitle);
        if (!this.splashScreen || this.splashScreen.hidden) this.onPlayerScreenShown();
        this.document.addEventListener('visibilitychange', () => {
            if (this.document.hidden) {
                this.onPlayerScreenHidden();
                return;
            }
            this.onPlayerScreenShown();
        });
    }

    /** プレーヤー画面の表示開始時にheroを再生し、10秒周期を開始し直す。 */
    onPlayerScreenShown() {
        if (!this.isPlayerScreenVisible()) {
            this.onPlayerScreenHidden();
            return;
        }
        this.reveal(this.hero);
        this.onPlayerScreenHidden();
        this.heroRevealInterval = this.window.setInterval(() => this.revealHero(), HERO_REVEAL_INTERVAL_MS);
    }

    /** プレーヤーが非表示になった時にheroの再表示タイマーを解放する。 */
    onPlayerScreenHidden() {
        if (this.heroRevealInterval === null) return;
        this.window.clearInterval(this.heroRevealInterval);
        this.heroRevealInterval = null;
    }

    /** プレーヤー画面が表示中のときだけheroを再アニメーションする。 */
    revealHero() {
        if (!this.isPlayerScreenVisible()) {
            this.onPlayerScreenHidden();
            return;
        }
        this.reveal(this.hero);
    }

    /** ページ、スプラッシュ、プレーヤーパネルの表示状態を判定する。 */
    isPlayerScreenVisible() {
        if (!this.hero || this.document.hidden || (this.splashScreen && !this.splashScreen.hidden)) return false;
        const playerPanel = this.hero.closest?.('#playerPanel');
        return !playerPanel?.hidden;
    }

    /** 対象要素のテキストを文字単位に分割して表示する。 */
    reveal(root) {
        if (!root) return;
        this.restoreText(root);
        const textNodes = this.collectTextNodes(root);
        let characterIndex = 0;
        textNodes.forEach((textNode) => {
            const fragment = this.document.createDocumentFragment();
            Array.from(textNode.nodeValue).forEach((character) => {
                const characterElement = this.document.createElement('span');
                characterElement.className = 'text-reveal-character';
                characterElement.style.setProperty('--text-reveal-index', characterIndex);
                characterElement.textContent = character;
                fragment.append(characterElement);
                characterIndex += 1;
            });
            textNode.replaceWith(fragment);
        });
    }

    /** 既存の文字要素を通常のテキストへ戻す。 */
    restoreText(root) {
        root.querySelectorAll('.text-reveal-character').forEach((characterElement) => {
            characterElement.replaceWith(this.document.createTextNode(characterElement.textContent));
        });
    }

    /** 空白だけのテキストノードを除外して取得する。 */
    collectTextNodes(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let currentNode = walker.nextNode();
        while (currentNode) {
            if (currentNode.nodeValue.trim()) textNodes.push(currentNode);
            currentNode = walker.nextNode();
        }
        return textNodes;
    }
}
