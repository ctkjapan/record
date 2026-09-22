/** TouchListから識別子が一致するタッチを検索し、配列への変換を避ける。 */
export function findTouchByIdentifier(touchList, identifier) {
    for (let index = 0; index < touchList.length; index += 1) {
        const touch = touchList[index];
        if (touch.identifier === identifier) return touch;
    }
    return null;
}
