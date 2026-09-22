import { findTouchByIdentifier } from './touch-utils.js';

// プレーヤー画面のスワイプ操作を実行する最小距離（px）。
const PLAYER_STAGE_SWIPE_THRESHOLD = 48;
// レコード選択パネルのスライド遷移時間（ms）。
const PICKER_SLIDE_DURATION_MS = 400;
// 端から外向きへ循環移動する選択画面のスワイプ距離（px）。
const PICKER_WRAP_SWIPE_THRESHOLD = 48;
// 端から外向きの意図を通常の横スクロールより先に検出する距離（px）。
const PICKER_WRAP_INTENT_THRESHOLD = 8;

/** レコード一覧の取得、選択状態、カード操作を担当する画面Controller。 */
export class RecordPickerController {
    /** レコード取得・選択・再生を担当するサービスと画面連携処理を受け取る。 */
    constructor({ recordCatalogService, recordSelectionService, playerController, playbackService, openMenu = () => {}, textRevealController = null }) {
        // JSON一覧・プレーヤー・cookie保存を担当する依存オブジェクト。
        this.recordCatalogService = recordCatalogService;
        this.recordSelectionService = recordSelectionService;
        this.playerController = playerController;
        this.playbackService = playbackService;
        // プレーヤーステージの上スワイプからヘッダーメニューを開く処理。
        this.openMenu = openMenu;
        // プレーヤー画面へ戻ったときのテキストアニメーション処理。
        this.textRevealController = textRevealController;
        // レコード選択画面のDOM要素。
        this.changeButton = document.querySelector('#changeButton');
        this.pickerPanel = document.querySelector('#pickerPanel');
        this.pickerTrack = document.querySelector('#pickerTrack');
        this.pickerPosition = document.querySelector('#pickerPosition');
        this.pickerStatus = document.querySelector('#pickerStatus');
        this.albumMaxNumber = document.querySelector('#albumMaxNumber');
        this.pickerPositionMax = document.querySelector('#pickerPositionMax');
        this.albumNumber = document.querySelector('#albumNumber');
        this.albumArtist = document.querySelector('#albumArtist');
        this.albumTitle = document.querySelector('#albumTitle');
        // レコード以外の領域で選択画面へ移動するためのプレーヤーステージ。
        this.playerStage = document.querySelector('#playerStage');
        this.pageBody = document.body;
        // レコード一覧と現在のフォーカス／選択状態。
        this.records = [];
        // マウスドラッグによるカードスクロールの一時状態。
        this.pickerPointerId = null;
        this.pickerDragStartX = 0;
        this.pickerDragStartScrollLeft = 0;
        this.pickerDidDrag = false;
        this.pickerPointerStartIndex = null;
        this.pickerPointerStartFocusedIndex = null;
        this.pickerSelectedOnPointerUp = false;
        this.pickerTouchIdentifier = null;
        this.pickerTouchStartX = 0;
        this.pickerTouchStartY = 0;
        this.pickerTouchStartFocusedIndex = null;
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
        this.pickerOpenFrame = null;
        this.pickerCloseTimer = null;
        this.pickerCloseHandler = null;
    }

    /** レコード一覧を取得して初期表示を構築する。 */
    async initialize() {
        this.bindEvents();
        this.changeButton.disabled = true;
        try {
            this.records = await this.recordCatalogService.load();
            const { selectedIndex } = this.recordSelectionService.initialize(this.records.length, this.getStoredRecordIndex());
            this.renderPicker();
            this.selectRecord(selectedIndex);
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
        this.pickerTrack.addEventListener('touchmove', (event) => this.handlePickerTouchMove(event), { passive: false });
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

    /** プレーヤーステージで完了したスワイプの操作を振り分ける。 */
    releasePlayerStagePointer(event) {
        if (event.pointerId !== this.playerStagePointerId) return;
        const deltaX = event.clientX - this.playerStageSwipeStartX;
        const deltaY = event.clientY - this.playerStageSwipeStartY;
        const isSwipeCompleted = event.type === 'pointerup';
        const shouldHandleSwipe = isSwipeCompleted && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= PLAYER_STAGE_SWIPE_THRESHOLD;
        this.playerStagePointerId = null;
        if (this.playerStage.hasPointerCapture?.(event.pointerId)) this.playerStage.releasePointerCapture(event.pointerId);
        if (shouldHandleSwipe) {
            if (event.cancelable) event.preventDefault();
            this.handlePlayerStageSwipe(deltaX, deltaY);
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
        const touch = findTouchByIdentifier(event.touches, this.playerStageTouchIdentifier);
        if (!touch) return;
        const deltaX = touch.clientX - this.playerStageTouchStartX;
        const deltaY = touch.clientY - this.playerStageTouchStartY;
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8 && event.cancelable) event.preventDefault();
    }

    /** タッチ終了時に上下の画面操作または左右のレコード切り替えを行う。 */
    releasePlayerStageTouch(event) {
        if (this.playerStageTouchIdentifier === null) return;
        const touch = findTouchByIdentifier(event.changedTouches, this.playerStageTouchIdentifier);
        if (!touch) return;
        const deltaX = touch.clientX - this.playerStageTouchStartX;
        const deltaY = touch.clientY - this.playerStageTouchStartY;
        this.playerStageTouchIdentifier = null;
        if (event.type === 'touchend' && (this.isHorizontalPlayerStageSwipe(deltaX, deltaY) || this.isDownPlayerStageSwipe(deltaX, deltaY) || this.isUpPlayerStageSwipe(deltaX, deltaY))) {
            if (event.cancelable) event.preventDefault();
            this.handlePlayerStageSwipe(deltaX, deltaY);
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

    /** プレーヤーステージの上方向スワイプか判定する。 */
    isUpPlayerStageSwipe(deltaX, deltaY) {
        return deltaY <= -PLAYER_STAGE_SWIPE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX);
    }

    /** プレーヤーステージの上下左右スワイプを対応する操作へ振り分ける。 */
    handlePlayerStageSwipe(deltaX, deltaY) {
        if (this.isUpPlayerStageSwipe(deltaX, deltaY)) {
            this.openMenu();
            return;
        }
        if (this.isDownPlayerStageSwipe(deltaX, deltaY)) {
            this.openPicker();
            return;
        }
        if (this.isHorizontalPlayerStageSwipe(deltaX, deltaY)) {
            const direction = deltaX > 0 ? 'right' : 'left';
            const nextIndex = this.recordSelectionService.getAdjacentSelectedIndex(direction);
            if (nextIndex !== null) this.selectRecord(nextIndex, { preserveRotation: true });
        }
    }

    /** cookieのレコードIDを一覧内の配列位置へ変換する。 */
    getStoredRecordIndex() {
        return this.recordCatalogService.indexOfRecordId(this.playbackService.getState().recordId);
    }

    /** レコード件数を画面の分母表示へ反映する。 */
    updateRecordCount() {
        const recordCount = String(this.records.length).padStart(2, '0');
        this.albumMaxNumber.textContent = recordCount;
        this.pickerPositionMax.textContent = recordCount;
    }

    /** 現在カード中央へフォーカスしているレコード位置を返す。 */
    get focusedRecordIndex() {
        return this.recordSelectionService.getState().focusedIndex;
    }

    /** プレーヤーで確定選択されているレコード位置を返す。 */
    get selectedRecordIndex() {
        return this.recordSelectionService.getState().selectedIndex;
    }

    /** レコード一覧から選択カードのHTMLを生成する。 */
    renderPicker() {
        this.updateRecordCount();
        this.pickerTrack.innerHTML = this.records
            .map(
                (record, index) => `
    <button class="picker-card${index === this.selectedRecordIndex ? ' is-selected' : ''}${index === this.focusedRecordIndex ? ' is-focused' : ''}" type="button" data-record-index="${index}" data-display-index="${String(index + 1).padStart(2, '0')} / ${String(this.records.length).padStart(2, '0')}" aria-label="${record.title}を選択">
      <span class="picker-disc" style="--disc-color: ${record.color}"></span>
      <p>${record.id}<span class="picker-track-artist">${record.artist}</span><span class="picker-track-title">${record.trackTitle}</span></p>
    </button>
  `,
            )
            .join('');
        this.pickerCards = [...this.pickerTrack.querySelectorAll('.picker-card')];
    }

    /** 中央に表示するカードを更新し、位置と案内文を変更する。 */
    setFocusedRecord(index) {
        const previousFocusedIndex = this.focusedRecordIndex;
        const { focusedIndex, selectedIndex } = this.recordSelectionService.focus(index);
        if (previousFocusedIndex !== focusedIndex) {
            this.pickerCards[previousFocusedIndex]?.classList.remove('is-focused');
            this.pickerCards[focusedIndex]?.classList.add('is-focused');
        }
        this.pickerPosition.textContent = String(focusedIndex + 1).padStart(2, '0');
        this.pickerStatus.textContent = focusedIndex === selectedIndex ? '中央のレコードをクリックして選択' : `${this.records[focusedIndex].title} をクリックして変更`;
    }

    /** レコード選択ユースケースを実行し、選択画面の表示を同期する。 */
    selectRecord(index, { preserveRotation = false } = {}) {
        const previousSelectedIndex = this.selectedRecordIndex;
        const previousFocusedIndex = this.focusedRecordIndex;
        const wasPlaying = preserveRotation && (this.playerController.isAudioPlaying || this.playbackService.audioState.isPlaying);
        const playbackState = preserveRotation ? this.playbackService.audioState : null;
        const { selectedIndex } = this.recordSelectionService.select(index);
        const record = this.recordCatalogService.getRecordAt(selectedIndex);
        const { isRecordChanged } = this.playbackService.selectRecord(record);
        if (isRecordChanged && !preserveRotation) this.playerController.resetForRecordChange();
        if (isRecordChanged && preserveRotation && playbackState) {
            this.playbackService.setDirection(playbackState.direction);
            this.playbackService.setPlaybackRate(playbackState.playbackRate);
            if (wasPlaying) this.playerController.updatePlaying(true);
        }
        this.playerController.setRecordImage(record.imageUrl);
        document.documentElement.style.setProperty('--accent-color', record.color);
        this.playerController.invalidateVisualizer();
        this.albumNumber.textContent = String(selectedIndex + 1).padStart(2, '0');
        this.albumArtist.textContent = record.artist;
        this.albumTitle.textContent = record.trackTitle;
        if (previousSelectedIndex !== selectedIndex) {
            this.pickerCards[previousSelectedIndex]?.classList.remove('is-selected');
            this.pickerCards[selectedIndex]?.classList.add('is-selected');
        }
        if (previousFocusedIndex !== selectedIndex) {
            this.pickerCards[previousFocusedIndex]?.classList.remove('is-focused');
            this.pickerCards[selectedIndex]?.classList.add('is-focused');
        }
        this.pickerPosition.textContent = String(selectedIndex + 1).padStart(2, '0');
        this.pickerStatus.textContent = `${record.title} を再生中`;
    }

    /** 選択画面を開き、現在のレコードを中央へスクロールする。 */
    openPicker() {
        this.clearPickerCloseWait();
        if (this.pickerOpenFrame !== null) cancelAnimationFrame(this.pickerOpenFrame);
        this.textRevealController?.onPlayerScreenHidden?.();
        this.playerController.setVisualizerVisible?.(false);
        this.pickerPanel.hidden = false;
        this.pageBody.classList.add('picker-open');
        this.changeButton.setAttribute('aria-pressed', 'true');
        this.setFocusedRecord(this.selectedRecordIndex);
        this.pickerOpenFrame = requestAnimationFrame(() => {
            this.pickerOpenFrame = requestAnimationFrame(() => {
                this.pickerOpenFrame = null;
                this.pickerPanel.classList.add('is-visible');
            });
        });
        requestAnimationFrame(() => this.pickerCards[this.selectedRecordIndex]?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' }));
    }

    /** 選択画面を閉じてプレーヤー画面へ戻る。 */
    closePicker() {
        if (this.pickerCloseHandler && !this.pickerPanel.classList.contains('is-visible')) return;
        if (this.pickerOpenFrame !== null) {
            cancelAnimationFrame(this.pickerOpenFrame);
            this.pickerOpenFrame = null;
        }
        const wasVisible = this.pickerPanel.classList.contains('is-visible');
        this.pickerPanel.classList.remove('is-visible');
        if (!wasVisible) {
            this.finishPickerClose();
            return;
        }
        this.pickerCloseHandler = (event) => {
            if (event.target === this.pickerPanel && event.propertyName === 'transform') this.finishPickerClose();
        };
        this.pickerPanel.addEventListener('transitionend', this.pickerCloseHandler);
        this.pickerCloseTimer = globalThis.setTimeout(() => this.finishPickerClose(), PICKER_SLIDE_DURATION_MS + 100);
    }

    /** スライドアウト完了後に選択画面を閉じ、プレーヤー操作を復帰する。 */
    finishPickerClose() {
        if (this.pickerPanel.classList.contains('is-visible')) return;
        this.clearPickerCloseWait();
        this.pickerPanel.hidden = true;
        this.pageBody.classList.remove('picker-open');
        this.changeButton.setAttribute('aria-pressed', 'false');
        this.playerController.restoreVisualizerVisibility?.();
        this.textRevealController?.onPlayerScreenShown();
    }

    /** 閉じる遷移のイベントとフォールバックタイマーを解放する。 */
    clearPickerCloseWait() {
        if (this.pickerCloseTimer !== null) globalThis.clearTimeout(this.pickerCloseTimer);
        if (this.pickerCloseHandler) this.pickerPanel.removeEventListener('transitionend', this.pickerCloseHandler);
        this.pickerCloseTimer = null;
        this.pickerCloseHandler = null;
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
        this.pickerPointerStartFocusedIndex = this.focusedRecordIndex;
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
        const wrapDirection = dragDistance >= PICKER_WRAP_SWIPE_THRESHOLD ? 'right' : dragDistance <= -PICKER_WRAP_SWIPE_THRESHOLD ? 'left' : null;
        const wrapTargetIndex = event.type === 'pointerup' && this.pickerDidDrag && wrapDirection ? this.recordSelectionService.wrapTargetIndex(this.pickerPointerStartFocusedIndex, this.records.length, wrapDirection) : null;
        const shouldSelect = event.type === 'pointerup' && !this.pickerDidDrag && Number.isInteger(this.pickerPointerStartIndex);
        const selectedIndex = this.pickerPointerStartIndex;
        const startFocusedIndex = this.pickerPointerStartFocusedIndex;
        this.pickerPointerId = null;
        this.pickerPointerStartIndex = null;
        this.pickerPointerStartFocusedIndex = null;
        this.pickerTrack.classList.remove('is-dragging');
        this.pickerDidDrag = false;
        if (wrapTargetIndex !== null) this.wrapPickerToRecord(wrapTargetIndex, startFocusedIndex);
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
        this.pickerTouchStartY = touch.clientY;
        this.pickerTouchStartFocusedIndex = this.focusedRecordIndex;
    }

    /** 端から外向きの操作を通常の横スクロールより先に捕捉する。 */
    handlePickerTouchMove(event) {
        if (this.pickerTouchIdentifier === null) return;
        const touch = findTouchByIdentifier(event.touches, this.pickerTouchIdentifier);
        if (!touch) return;
        const deltaX = touch.clientX - this.pickerTouchStartX;
        const deltaY = touch.clientY - this.pickerTouchStartY;
        if (Math.abs(deltaX) < PICKER_WRAP_INTENT_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;

        const direction = deltaX > 0 ? 'right' : 'left';
        const wrapTargetIndex = this.recordSelectionService.wrapTargetIndex(this.pickerTouchStartFocusedIndex, this.records.length, direction);
        if (wrapTargetIndex !== null && event.cancelable) event.preventDefault();
    }

    /** 先頭端から右へスワイプした場合、末尾カードへフォーカスを循環する。 */
    handlePickerTouchEnd(event) {
        if (this.pickerTouchIdentifier === null) return;
        const touch = findTouchByIdentifier(event.changedTouches, this.pickerTouchIdentifier);
        if (!touch) return;
        const swipeDistance = touch.clientX - this.pickerTouchStartX;
        const wrapDirection = swipeDistance >= PICKER_WRAP_SWIPE_THRESHOLD ? 'right' : swipeDistance <= -PICKER_WRAP_SWIPE_THRESHOLD ? 'left' : null;
        const wrapTargetIndex = event.type === 'touchend' && wrapDirection ? this.recordSelectionService.wrapTargetIndex(this.pickerTouchStartFocusedIndex, this.records.length, wrapDirection) : null;
        const startFocusedIndex = this.pickerTouchStartFocusedIndex;
        this.resetPickerTouch();
        if (wrapTargetIndex !== null) this.wrapPickerToRecord(wrapTargetIndex, startFocusedIndex);
    }

    /** タッチスワイプ判定用の状態を消去する。 */
    resetPickerTouch() {
        this.pickerTouchIdentifier = null;
        this.pickerTouchStartX = 0;
        this.pickerTouchStartY = 0;
        this.pickerTouchStartFocusedIndex = null;
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
