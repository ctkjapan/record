const PLAYER_STAGE_SWIPE_THRESHOLD = 48;
const PICKER_WRAP_SWIPE_THRESHOLD = 48;

/** レコード一覧の取得、選択状態、カード操作を担当する画面Controller。 */
export class RecordPickerController {
    constructor({ recordCatalogService, playerController, playbackService, openMenu = () => {}, textRevealController = null }) {
        // JSON一覧・プレーヤー・cookie保存を担当する依存オブジェクト。
        this.recordCatalogService = recordCatalogService;
        this.playerController = playerController;
        this.playbackService = playbackService;
        // プレーヤーステージの下スワイプからヘッダーメニューを開く処理。
        this.openMenu = openMenu;
        // レコード情報更新時のテキストアニメーション処理。
        this.textRevealController = textRevealController;
        // レコード選択画面のDOM要素。
        this.changeButton = document.querySelector('#changeButton');
        this.pickerPanel = document.querySelector('#pickerPanel');
        this.pickerTrack = document.querySelector('#pickerTrack');
        this.pickerPosition = document.querySelector('#pickerPosition');
        this.pickerStatus = document.querySelector('#pickerStatus');
        this.albumMaxNumber = document.querySelector('#albumMaxNumber');
        this.pickerPositionMax = document.querySelector('#pickerPositionMax');
        this.playerPanel = document.querySelector('#playerPanel');
        this.hero = document.querySelector('#hero');
        this.albumNumber = document.querySelector('#albumNumber');
        this.albumArtist = document.querySelector('#albumArtist');
        this.albumTitle = document.querySelector('#albumTitle');
        // レコード以外の領域で選択画面へ移動するためのプレーヤーステージ。
        this.playerStage = document.querySelector('#playerStage');
        this.pageBody = document.body;
        // レコード一覧と現在のフォーカス／選択状態。
        this.catalog = null;
        this.records = [];
        this.focusedRecordIndex = 0;
        this.selectedRecordIndex = 0;
        // マウスドラッグによるカードスクロールの一時状態。
        this.pickerPointerId = null;
        this.pickerDragStartX = 0;
        this.pickerDragStartScrollLeft = 0;
        this.pickerDidDrag = false;
        this.pickerPointerStartIndex = null;
        this.pickerPointerStartedAtFirst = false;
        this.pickerPointerStartedAtLast = false;
        this.pickerSelectedOnPointerUp = false;
        this.pickerTouchIdentifier = null;
        this.pickerTouchStartX = 0;
        this.pickerTouchStartedAtFirst = false;
        this.pickerTouchStartedAtLast = false;
        this.pickerSuppressClickIndex = null;
        // プレーヤーステージの左右スワイプ判定用状態。
        this.playerStagePointerId = null;
        this.playerStageSwipeStartX = 0;
        this.playerStageSwipeStartY = 0;
        // タッチ操作で左右／下方向を判定する一時状態。
        this.playerStageTouchIdentifier = null;
        this.playerStageTouchStartX = 0;
        this.playerStageTouchStartY = 0;
        // カード要素とスクロールrAFの管理状態。
        this.pickerCards = [];
        this.pickerScrollFrame = null;
    }

    /** レコード一覧を取得して初期表示を構築する。 */
    async initialize() {
        this.bindEvents();
        this.changeButton.disabled = true;
        try {
            this.catalog = await this.recordCatalogService.load();
            this.records = this.catalog.all();
            this.selectedRecordIndex = this.getStoredRecordIndex();
            this.focusedRecordIndex = this.selectedRecordIndex;
            this.renderPicker();
            this.selectRecord(this.selectedRecordIndex);
            this.changeButton.disabled = false;
        } catch {
            this.pickerStatus.textContent = 'レコード一覧を読み込めませんでした';
        }
    }

    /** ボタン、スクロール、ポインター操作のイベントを登録する。 */
    bindEvents() {
        this.changeButton.addEventListener('click', () => this.openPicker());
        this.playerStage?.addEventListener('pointerdown', (event) => this.handlePlayerStagePointerDown(event));
        this.playerStage?.addEventListener('pointermove', (event) => this.handlePlayerStagePointerMove(event));
        this.playerStage?.addEventListener('pointerup', (event) => this.releasePlayerStagePointer(event));
        this.playerStage?.addEventListener('pointercancel', (event) => this.releasePlayerStagePointer(event));
        this.playerStage?.addEventListener('lostpointercapture', (event) => this.releasePlayerStagePointer(event));
        this.playerStage?.addEventListener('touchstart', (event) => this.handlePlayerStageTouchStart(event), { passive: true });
        this.playerStage?.addEventListener('touchmove', (event) => this.handlePlayerStageTouchMove(event), { passive: false });
        this.playerStage?.addEventListener('touchend', (event) => this.releasePlayerStageTouch(event), { passive: false });
        this.playerStage?.addEventListener('touchcancel', (event) => this.releasePlayerStageTouch(event), { passive: false });
        this.pickerTrack.addEventListener(
            'scroll',
            () => {
                if (!this.pickerScrollFrame) this.pickerScrollFrame = requestAnimationFrame(() => this.updateFocusedRecordFromScroll());
            },
            { passive: true },
        );
        this.pickerTrack.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
        this.pickerTrack.addEventListener('pointermove', (event) => this.handlePointerMove(event));
        this.pickerTrack.addEventListener('pointerup', (event) => this.releasePickerPointer(event));
        this.pickerTrack.addEventListener('pointercancel', (event) => this.releasePickerPointer(event));
        this.pickerTrack.addEventListener('lostpointercapture', (event) => this.releasePickerPointer(event));
        this.pickerTrack.addEventListener('touchstart', (event) => this.handlePickerTouchStart(event), { passive: true });
        this.pickerTrack.addEventListener('touchend', (event) => this.handlePickerTouchEnd(event), { passive: true });
        this.pickerTrack.addEventListener('touchcancel', () => this.resetPickerTouch(), { passive: true });
        this.pickerTrack.addEventListener('click', (event) => this.handleClick(event));
    }

    /** レコード以外のプレーヤーステージでスワイプを開始する。 */
    handlePlayerStagePointerDown(event) {
        if (event.isPrimary === false || event.pointerType === 'touch' || event.target.closest('#record')) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        this.playerStagePointerId = event.pointerId;
        this.playerStageSwipeStartX = event.clientX;
        this.playerStageSwipeStartY = event.clientY;
        this.playerStage.setPointerCapture(event.pointerId);
    }

    /** プレーヤーステージのスワイプ中にブラウザーの標準操作を抑制する。 */
    handlePlayerStagePointerMove(event) {
        if (event.pointerId !== this.playerStagePointerId) return;
        const deltaX = event.clientX - this.playerStageSwipeStartX;
        const deltaY = event.clientY - this.playerStageSwipeStartY;
        const isDirectionalSwipe = Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8;
        if (isDirectionalSwipe && event.cancelable) event.preventDefault();
    }

    /** プレーヤーステージの左右スワイプ完了時に選択画面を開く。 */
    releasePlayerStagePointer(event) {
        if (event.pointerId !== this.playerStagePointerId) return;
        const deltaX = event.clientX - this.playerStageSwipeStartX;
        const deltaY = event.clientY - this.playerStageSwipeStartY;
        const isSwipeCompleted = event.type === 'pointerup' || event.type === 'pointercancel';
        const shouldOpenPicker = isSwipeCompleted
            && Math.abs(deltaX) >= PLAYER_STAGE_SWIPE_THRESHOLD
            && Math.abs(deltaX) > Math.abs(deltaY);
        const shouldOpenMenu = isSwipeCompleted
            && deltaY >= PLAYER_STAGE_SWIPE_THRESHOLD
            && deltaY > Math.abs(deltaX);
        this.playerStagePointerId = null;
        if (this.playerStage.hasPointerCapture?.(event.pointerId)) this.playerStage.releasePointerCapture(event.pointerId);
        if (shouldOpenPicker || shouldOpenMenu) {
            if (event.cancelable) event.preventDefault();
            this.openPlayerStageSwipe(deltaX, deltaY);
        }
    }

    /** タッチ開始位置を記録し、レコード上の操作を除外する。 */
    handlePlayerStageTouchStart(event) {
        if (event.touches.length !== 1 || event.target.closest('#record')) return;
        const touch = event.touches[0];
        this.playerStageTouchIdentifier = touch.identifier;
        this.playerStageTouchStartX = touch.clientX;
        this.playerStageTouchStartY = touch.clientY;
    }

    /** タッチ移動中にプレーヤーステージのブラウザー操作を抑制する。 */
    handlePlayerStageTouchMove(event) {
        const touch = Array.from(event.touches).find(({ identifier }) => identifier === this.playerStageTouchIdentifier);
        if (!touch) return;
        const deltaX = touch.clientX - this.playerStageTouchStartX;
        const deltaY = touch.clientY - this.playerStageTouchStartY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8 && event.cancelable) event.preventDefault();
    }

    /** タッチ終了時に左右なら選択画面、下方向ならメニューを開く。 */
    releasePlayerStageTouch(event) {
        if (this.playerStageTouchIdentifier === null) return;
        const touch = Array.from(event.changedTouches).find(({ identifier }) => identifier === this.playerStageTouchIdentifier);
        if (!touch) return;
        const deltaX = touch.clientX - this.playerStageTouchStartX;
        const deltaY = touch.clientY - this.playerStageTouchStartY;
        this.playerStageTouchIdentifier = null;
        if (event.type === 'touchend' && (this.isHorizontalPlayerStageSwipe(deltaX, deltaY) || this.isDownPlayerStageSwipe(deltaX, deltaY))) {
            if (event.cancelable) event.preventDefault();
            this.openPlayerStageSwipe(deltaX, deltaY);
        }
    }

    /** プレーヤーステージの横方向スワイプか判定する。 */
    isHorizontalPlayerStageSwipe(deltaX, deltaY) {
        return Math.abs(deltaX) >= PLAYER_STAGE_SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY);
    }

    /** プレーヤーステージの下方向スワイプか判定する。 */
    isDownPlayerStageSwipe(deltaX, deltaY) {
        return deltaY >= PLAYER_STAGE_SWIPE_THRESHOLD && deltaY > Math.abs(deltaX);
    }

    /** プレーヤーステージのスワイプ方向に応じた画面を開く。 */
    openPlayerStageSwipe(deltaX, deltaY) {
        if (this.isDownPlayerStageSwipe(deltaX, deltaY)) {
            this.openMenu();
            return;
        }
        if (this.isHorizontalPlayerStageSwipe(deltaX, deltaY)) this.openPicker();
    }

    /** cookieのレコードIDを一覧内の配列位置へ変換する。 */
    getStoredRecordIndex() {
        return this.catalog.indexOfId(this.playbackService.getState().recordId);
    }

    /** レコード件数を画面の分母表示へ反映する。 */
    updateRecordCount() {
        const recordCount = String(this.records.length).padStart(2, '0');
        this.albumMaxNumber.textContent = recordCount;
        this.pickerPositionMax.textContent = recordCount;
    }

    /** レコード一覧から選択カードのHTMLを生成する。 */
    renderPicker() {
        this.updateRecordCount();
        this.pickerTrack.innerHTML = this.records
            .map(
                (record, index) => `
    <button class="picker-card${index === this.selectedRecordIndex ? ' is-selected' : ''}${index === this.focusedRecordIndex ? ' is-focused' : ''}" type="button" data-record-index="${index}" data-display-index="${String(index + 1).padStart(2, '0')} / ${String(this.records.length).padStart(2, '0')}" aria-label="${record.title}を選択">
      <span class="picker-disc" style="--disc-color: ${record.color}"></span>
      <p>${record.id}<strong>${record.title}</strong></p>
    </button>
  `,
            )
            .join('');
        this.pickerCards = [...this.pickerTrack.querySelectorAll('.picker-card')];
    }

    /** 中央に表示するカードを更新し、位置と案内文を変更する。 */
    setFocusedRecord(index) {
        this.focusedRecordIndex = Math.max(0, Math.min(this.records.length - 1, index));
        this.pickerCards.forEach((card, cardIndex) => card.classList.toggle('is-focused', cardIndex === this.focusedRecordIndex));
        this.pickerPosition.textContent = String(this.focusedRecordIndex + 1).padStart(2, '0');
        this.pickerStatus.textContent = this.focusedRecordIndex === this.selectedRecordIndex ? '中央のレコードをクリックして選択' : `${this.records[this.focusedRecordIndex].title} をクリックして変更`;
    }

    /** レコード選択ユースケースを実行し、選択画面の表示を同期する。 */
    selectRecord(index) {
        this.selectedRecordIndex = index;
        const record = this.catalog.at(index);
        const { isRecordChanged } = this.playbackService.selectRecord(record);
        if (isRecordChanged) this.playerController.resetForRecordChange();
        this.playerController.setRecordImage(record.imageUrl);
        document.documentElement.style.setProperty('--accent', record.color);
        this.albumNumber.textContent = String(index + 1).padStart(2, '0');
        this.albumArtist.textContent = record.artist;
        this.albumTitle.textContent = record.trackTitle;
        this.textRevealController?.reveal(this.hero);
        this.pickerCards.forEach((card, cardIndex) => card.classList.toggle('is-selected', cardIndex === this.selectedRecordIndex));
        this.pickerStatus.textContent = `${record.title} を再生中`;
    }

    /** 選択画面を開き、現在のレコードを中央へスクロールする。 */
    openPicker() {
        this.playerController.setVisualizerVisible?.(false);
        this.pickerPanel.hidden = false;
        this.playerPanel.hidden = true;
        this.pageBody.classList.add('picker-open');
        this.changeButton.setAttribute('aria-pressed', 'true');
        this.setFocusedRecord(this.selectedRecordIndex);
        requestAnimationFrame(() => this.pickerTrack.querySelector(`[data-record-index="${this.selectedRecordIndex}"]`)?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' }));
    }

    /** 選択画面を閉じてプレーヤー画面へ戻る。 */
    closePicker() {
        this.pickerPanel.hidden = true;
        this.playerPanel.hidden = false;
        this.pageBody.classList.remove('picker-open');
        this.changeButton.setAttribute('aria-pressed', 'false');
        this.playerController.restoreVisualizerVisibility?.();
    }

    /** スクロール位置から中央に最も近いカードを計算する。 */
    updateFocusedRecordFromScroll() {
        this.pickerScrollFrame = null;
        const trackBounds = this.pickerTrack.getBoundingClientRect();
        const trackCenter = trackBounds.left + trackBounds.width / 2;
        let closestIndex = 0;
        let closestDistance = Infinity;
        this.pickerCards.forEach((card, index) => {
            const bounds = card.getBoundingClientRect();
            const distance = Math.abs(bounds.left + bounds.width / 2 - trackCenter);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });
        if (closestIndex !== this.focusedRecordIndex) this.setFocusedRecord(closestIndex);
    }

    /** マウスドラッグの開始位置と対象カードを記録する。 */
    handlePointerDown(event) {
        this.pickerSuppressClickIndex = null;
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        this.pickerPointerId = event.pointerId;
        this.pickerDragStartX = event.clientX;
        this.pickerDragStartScrollLeft = this.pickerTrack.scrollLeft;
        this.pickerDidDrag = false;
        this.pickerPointerStartIndex = Number(event.target.closest('.picker-card')?.dataset.recordIndex ?? NaN);
        this.pickerPointerStartedAtFirst = this.focusedRecordIndex === 0;
        this.pickerPointerStartedAtLast = this.focusedRecordIndex === this.records.length - 1;
        this.pickerTrack.setPointerCapture(this.pickerPointerId);
        this.pickerTrack.classList.add('is-dragging');
    }

    /** ドラッグ距離に応じてカード一覧の横スクロールを更新する。 */
    handlePointerMove(event) {
        if (event.pointerId !== this.pickerPointerId) return;
        const distance = event.clientX - this.pickerDragStartX;
        if (Math.abs(distance) > 4) this.pickerDidDrag = true;
        this.pickerTrack.scrollLeft = this.pickerDragStartScrollLeft - distance;
    }

    /** ポインター解放時に、ドラッグでなければ中央カードを選択する。 */
    releasePickerPointer(event) {
        if (event.pointerId !== this.pickerPointerId) return;
        const dragDistance = event.clientX - this.pickerDragStartX;
        const shouldWrapToLast = event.type === 'pointerup'
            && this.pickerDidDrag
            && this.pickerPointerStartedAtFirst
            && dragDistance >= PICKER_WRAP_SWIPE_THRESHOLD;
        const shouldWrapToFirst = event.type === 'pointerup'
            && this.pickerDidDrag
            && this.pickerPointerStartedAtLast
            && dragDistance <= -PICKER_WRAP_SWIPE_THRESHOLD;
        const shouldSelect = event.type === 'pointerup' && !this.pickerDidDrag && Number.isInteger(this.pickerPointerStartIndex);
        const selectedIndex = this.pickerPointerStartIndex;
        this.pickerPointerId = null;
        this.pickerPointerStartIndex = null;
        this.pickerPointerStartedAtFirst = false;
        this.pickerPointerStartedAtLast = false;
        this.pickerTrack.classList.remove('is-dragging');
        this.pickerDidDrag = false;
        if (shouldWrapToLast) this.wrapPickerToRecord(this.records.length - 1, 0);
        else if (shouldWrapToFirst) this.wrapPickerToRecord(0, this.records.length - 1);
        if (shouldSelect && selectedIndex === this.focusedRecordIndex) {
            this.selectRecord(selectedIndex);
            this.closePicker();
            this.pickerSelectedOnPointerUp = true;
        }
    }

    /** 先頭カードから右へタッチスワイプしたときの開始状態を記録する。 */
    handlePickerTouchStart(event) {
        this.pickerSuppressClickIndex = null;
        if (event.touches.length !== 1) {
            this.resetPickerTouch();
            return;
        }
        const touch = event.touches[0];
        this.pickerTouchIdentifier = touch.identifier;
        this.pickerTouchStartX = touch.clientX;
        this.pickerTouchStartedAtFirst = this.focusedRecordIndex === 0;
        this.pickerTouchStartedAtLast = this.focusedRecordIndex === this.records.length - 1;
    }

    /** 先頭端から右へスワイプした場合、末尾カードへフォーカスを循環する。 */
    handlePickerTouchEnd(event) {
        if (this.pickerTouchIdentifier === null) return;
        const touch = Array.from(event.changedTouches).find(({ identifier }) => identifier === this.pickerTouchIdentifier);
        if (!touch) return;
        const swipeDistance = touch.clientX - this.pickerTouchStartX;
        const shouldWrapToLast = event.type === 'touchend'
            && this.pickerTouchStartedAtFirst
            && swipeDistance >= PICKER_WRAP_SWIPE_THRESHOLD;
        const shouldWrapToFirst = event.type === 'touchend'
            && this.pickerTouchStartedAtLast
            && swipeDistance <= -PICKER_WRAP_SWIPE_THRESHOLD;
        this.resetPickerTouch();
        if (shouldWrapToLast) this.wrapPickerToRecord(this.records.length - 1, 0);
        else if (shouldWrapToFirst) this.wrapPickerToRecord(0, this.records.length - 1);
    }

    /** タッチスワイプ判定用の状態を消去する。 */
    resetPickerTouch() {
        this.pickerTouchIdentifier = null;
        this.pickerTouchStartedAtFirst = false;
        this.pickerTouchStartedAtLast = false;
    }

    /** 指定カードを中央へ移動してフォーカスし、スワイプ後の合成クリックを抑止する。 */
    wrapPickerToRecord(index, suppressClickIndex) {
        if (this.records.length < 2) return;
        this.setFocusedRecord(index);
        this.pickerCards[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        this.pickerSuppressClickIndex = suppressClickIndex;
    }

    /** 円盤クリックを選択操作または中央寄せ操作として処理する。 */
    handleClick(event) {
        if (this.pickerSuppressClickIndex !== null) {
            const clickedIndex = Number(event.target.closest('.picker-card')?.dataset.recordIndex ?? NaN);
            const shouldSuppressClick = clickedIndex === this.pickerSuppressClickIndex;
            this.pickerSuppressClickIndex = null;
            if (shouldSuppressClick) return;
        }
        if (this.pickerSelectedOnPointerUp) {
            this.pickerSelectedOnPointerUp = false;
            return;
        }
        if (this.pickerDidDrag) {
            this.pickerDidDrag = false;
            return;
        }
        const disc = event.target.closest('.picker-disc');
        if (!disc) return;
        const card = disc.closest('.picker-card');
        const index = Number(card.dataset.recordIndex);
        if (index === this.focusedRecordIndex) {
            this.selectRecord(index);
            this.closePicker();
        } else {
            this.setFocusedRecord(index);
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}
