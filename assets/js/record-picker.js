/** レコード一覧の取得、選択状態、カード操作を担当する画面Controller。 */
export class RecordPickerController {
    constructor({ recordCatalogService, playerController, playbackStateRepository }) {
        // JSON一覧・プレーヤー・cookie保存を担当する依存オブジェクト。
        this.recordCatalogService = recordCatalogService;
        this.playerController = playerController;
        this.playbackStateRepository = playbackStateRepository;
        // レコード選択画面のDOM要素。
        this.changeButton = document.querySelector('#changeButton');
        this.closePickerButton = document.querySelector('#closePickerButton');
        this.pickerPanel = document.querySelector('#pickerPanel');
        this.pickerTrack = document.querySelector('#pickerTrack');
        this.pickerPosition = document.querySelector('#pickerPosition');
        this.pickerStatus = document.querySelector('#pickerStatus');
        this.albumMaxNumber = document.querySelector('#albumMaxNumber');
        this.pickerPositionMax = document.querySelector('#pickerPositionMax');
        this.playerPanel = document.querySelector('#playerPanel');
        this.albumNumber = document.querySelector('#albumNumber');
        this.albumArtist = document.querySelector('#albumArtist');
        this.albumTitle = document.querySelector('#albumTitle');
        // 旧HTMLのclass指定と現行HTMLのid指定のどちらでもラベルを取得する。
        this.labelNumber = document.querySelector('#labelNumber, .labelNumber');
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
        this.pickerSelectedOnPointerUp = false;
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
        this.closePickerButton.addEventListener('click', () => this.closePicker());
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
        this.pickerTrack.addEventListener('click', (event) => this.handleClick(event));
    }

    /** cookieのレコードIDを一覧内の配列位置へ変換する。 */
    getStoredRecordIndex() {
        return this.catalog.indexOfId(this.playbackStateRepository.load().recordId);
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

    /** レコードを選択し、音源・cookie・タイトル表示を同期する。 */
    selectRecord(index) {
        this.selectedRecordIndex = index;
        const record = this.catalog.at(index);
        const storedState = this.playbackStateRepository.load();
        const initialSeconds = record.id === storedState.recordId ? storedState.playbackSeconds : 0;
        this.playerController.setAudioSource(record.audioUrl, initialSeconds).catch(() => {});
        this.playbackStateRepository.saveRecordId(record.id);
        this.labelNumber.textContent = record.id;
        document.documentElement.style.setProperty('--accent', record.color);
        this.albumNumber.textContent = String(index + 1).padStart(2, '0');
        this.albumArtist.textContent = record.artist;
        this.albumTitle.textContent = record.trackTitle;
        this.pickerCards.forEach((card, cardIndex) => card.classList.toggle('is-selected', cardIndex === this.selectedRecordIndex));
        this.pickerStatus.textContent = `${record.title} を再生中`;
    }

    /** 選択画面を開き、現在のレコードを中央へスクロールする。 */
    openPicker() {
        this.playerController.stop();
        this.pickerPanel.hidden = false;
        this.playerPanel.hidden = true;
        this.pageBody.classList.add('picker-open');
        this.changeButton.textContent = 'SELECTING';
        this.changeButton.setAttribute('aria-pressed', 'true');
        this.setFocusedRecord(this.selectedRecordIndex);
        requestAnimationFrame(() => this.pickerTrack.querySelector(`[data-record-index="${this.selectedRecordIndex}"]`)?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' }));
    }

    /** 選択画面を閉じてプレーヤー画面へ戻る。 */
    closePicker() {
        this.pickerPanel.hidden = true;
        this.playerPanel.hidden = false;
        this.pageBody.classList.remove('picker-open');
        this.changeButton.textContent = 'COLLECTION';
        this.changeButton.setAttribute('aria-pressed', 'false');
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
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        this.pickerPointerId = event.pointerId;
        this.pickerDragStartX = event.clientX;
        this.pickerDragStartScrollLeft = this.pickerTrack.scrollLeft;
        this.pickerDidDrag = false;
        this.pickerPointerStartIndex = Number(event.target.closest('.picker-card')?.dataset.recordIndex ?? NaN);
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
        const shouldSelect = event.type === 'pointerup' && !this.pickerDidDrag && Number.isInteger(this.pickerPointerStartIndex);
        const selectedIndex = this.pickerPointerStartIndex;
        this.pickerPointerId = null;
        this.pickerPointerStartIndex = null;
        this.pickerTrack.classList.remove('is-dragging');
        this.pickerDidDrag = false;
        if (shouldSelect && selectedIndex === this.focusedRecordIndex) {
            this.selectRecord(selectedIndex);
            this.closePicker();
            this.pickerSelectedOnPointerUp = true;
        }
    }

    /** 円盤クリックを選択操作または中央寄せ操作として処理する。 */
    handleClick(event) {
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
