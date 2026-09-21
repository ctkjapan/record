/** テキストを1文字ずつ下から表示するアニメーションController。 */
export class TextRevealController {
    constructor() {
        // 初回表示とレコード情報の更新でアニメーションする要素。
        this.splashTitle = document.querySelector('#splashTitle');
        this.hero = document.querySelector('#hero');
    }

    /** 初回表示対象のテキストアニメーションを開始する。 */
    initialize() {
        this.reveal(this.splashTitle);
        this.reveal(this.hero);
    }

    /** 対象要素のテキストを文字単位に分割して表示する。 */
    reveal(root) {
        if (!root) return;
        this.restoreText(root);
        const textNodes = this.collectTextNodes(root);
        let characterIndex = 0;
        textNodes.forEach((textNode) => {
            const fragment = document.createDocumentFragment();
            Array.from(textNode.nodeValue).forEach((character) => {
                const characterElement = document.createElement('span');
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
            characterElement.replaceWith(document.createTextNode(characterElement.textContent));
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
