const changeButton = document.querySelector('#changeButton');
const closePickerButton = document.querySelector('#closePickerButton');
const pickerPanel = document.querySelector('#pickerPanel');
const pickerTrack = document.querySelector('#pickerTrack');
const pickerPosition = document.querySelector('#pickerPosition');
const pickerStatus = document.querySelector('#pickerStatus');

const records = [
    { id: '001', title: 'P4D / Dance!', color: '#b4d34b', audioUrl: 'mp3/1-01%20Dance!.mp3' },
    { id: '002', title: 'P5 / Life Will Change', color: '#ed6a4e', audioUrl: 'mp3/04%20Life%20Will%20Change.mp3' },
    { id: '003', title: 'JSR / All', color: '#d8c46a', audioUrl: 'mp3/JSR.mp3' },
    { id: '004', title: 'TIDE / BLUE MOTION', color: '#91b9b0' },
];

let focusedRecordIndex = 0;
let selectedRecordIndex = 0;
let pickerPointerId = null;
let pickerDragStartX = 0;
let pickerDragStartScrollLeft = 0;
let pickerDidDrag = false;
let pickerPointerStartIndex = null;
let pickerSelectedOnPointerUp = false;

function renderPicker() {
    pickerTrack.innerHTML = records
        .map(
            (item, index) => `
    <button class="picker-card${index === selectedRecordIndex ? ' is-selected' : ''}${index === focusedRecordIndex ? ' is-focused' : ''}" type="button" data-record-index="${index}" data-display-index="${String(index + 1).padStart(2, '0')} / ${String(records.length).padStart(2, '0')}" aria-label="${item.title}を選択">
      <span class="picker-disc" style="--disc-color: ${item.color}"></span>
      <p>${item.id}<strong>${item.title}</strong></p>
    </button>
  `,
        )
        .join('');
}

function setFocusedRecord(index) {
    focusedRecordIndex = Math.max(0, Math.min(records.length - 1, index));
    pickerTrack.querySelectorAll('.picker-card').forEach((card, cardIndex) => {
        card.classList.toggle('is-focused', cardIndex === focusedRecordIndex);
    });
    pickerPosition.textContent = String(focusedRecordIndex + 1).padStart(2, '0');
    pickerStatus.textContent = focusedRecordIndex === selectedRecordIndex ? '中央のレコードをクリックして選択' : `${records[focusedRecordIndex].title} をクリックして変更`;
}

function selectRecord(index) {
    selectedRecordIndex = index;
    const nextRecord = records[index];
    window.RecordPlayer.setAudioSource(nextRecord.audioUrl);
    const [artist, title] = nextRecord.title.split(' / ');
    document.querySelector('.label strong').textContent = nextRecord.id;
    document.documentElement.style.setProperty('--accent', nextRecord.color);
    document.querySelector('.session-label').textContent = nextRecord.id;
    document.querySelector('#albumNumber').textContent = String(index + 1).padStart(2, '0');
    document.querySelector('#albumArtist').textContent = artist;
    document.querySelector('#albumTitle').textContent = title;
    pickerTrack.querySelectorAll('.picker-card').forEach((card, cardIndex) => {
        card.classList.toggle('is-selected', cardIndex === selectedRecordIndex);
    });
    pickerStatus.textContent = `${nextRecord.title} を再生中`;
}

function openPicker() {
    window.RecordPlayer.stop();
    pickerPanel.hidden = false;
    document.querySelector('.player').hidden = true;
    document.body.classList.add('picker-open');
    changeButton.textContent = 'SELECTING';
    changeButton.setAttribute('aria-pressed', 'true');
    setFocusedRecord(selectedRecordIndex);
    requestAnimationFrame(() => {
        pickerTrack.querySelector(`[data-record-index="${selectedRecordIndex}"]`).scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
    });
}

function closePicker() {
    pickerPanel.hidden = true;
    document.querySelector('.player').hidden = false;
    document.body.classList.remove('picker-open');
    changeButton.textContent = 'COLLECTION';
    changeButton.setAttribute('aria-pressed', 'false');
}

pickerTrack.addEventListener(
    'scroll',
    () => {
        const trackBounds = pickerTrack.getBoundingClientRect();
        const trackCenter = trackBounds.left + trackBounds.width / 2;
        let closestIndex = 0;
        let closestDistance = Infinity;
        pickerTrack.querySelectorAll('.picker-card').forEach((card, index) => {
            const bounds = card.getBoundingClientRect();
            const distance = Math.abs(bounds.left + bounds.width / 2 - trackCenter);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });
        if (closestIndex !== focusedRecordIndex) setFocusedRecord(closestIndex);
    },
    { passive: true },
);

pickerTrack.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    pickerPointerId = event.pointerId;
    pickerDragStartX = event.clientX;
    pickerDragStartScrollLeft = pickerTrack.scrollLeft;
    pickerDidDrag = false;
    pickerPointerStartIndex = Number(event.target.closest('.picker-card')?.dataset.recordIndex ?? NaN);
    pickerTrack.setPointerCapture(pickerPointerId);
    pickerTrack.classList.add('is-dragging');
});

pickerTrack.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pickerPointerId) return;
    const distance = event.clientX - pickerDragStartX;
    if (Math.abs(distance) > 4) pickerDidDrag = true;
    pickerTrack.scrollLeft = pickerDragStartScrollLeft - distance;
});

function releasePickerPointer(event) {
    if (event.pointerId !== pickerPointerId) return;
    const shouldSelect = event.type === 'pointerup' && !pickerDidDrag && Number.isInteger(pickerPointerStartIndex);
    const selectedIndex = pickerPointerStartIndex;
    pickerPointerId = null;
    pickerPointerStartIndex = null;
    pickerTrack.classList.remove('is-dragging');
    pickerDidDrag = false;
    if (shouldSelect && selectedIndex === focusedRecordIndex) {
        selectRecord(selectedIndex);
        closePicker();
        pickerSelectedOnPointerUp = true;
    }
}

pickerTrack.addEventListener('pointerup', releasePickerPointer);
pickerTrack.addEventListener('pointercancel', releasePickerPointer);
pickerTrack.addEventListener('lostpointercapture', releasePickerPointer);

pickerTrack.addEventListener('click', (event) => {
    if (pickerSelectedOnPointerUp) {
        pickerSelectedOnPointerUp = false;
        return;
    }
    if (pickerDidDrag) {
        pickerDidDrag = false;
        return;
    }
    const disc = event.target.closest('.picker-disc');
    if (!disc) return;
    const card = disc.closest('.picker-card');
    const index = Number(card.dataset.recordIndex);
    if (index === focusedRecordIndex) {
        selectRecord(index);
        closePicker();
    } else {
        setFocusedRecord(index);
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
});

changeButton.addEventListener('click', openPicker);
closePickerButton.addEventListener('click', closePicker);

renderPicker();
