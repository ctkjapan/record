const changeButton = document.querySelector('#changeButton');
const closePickerButton = document.querySelector('#closePickerButton');
const pickerPanel = document.querySelector('#pickerPanel');
const pickerTrack = document.querySelector('#pickerTrack');
const pickerPosition = document.querySelector('#pickerPosition');
const pickerStatus = document.querySelector('#pickerStatus');
const albumMaxNumber = document.querySelector('#albumMaxNumber');
const pickerPositionMax = document.querySelector('#pickerPositionMax');
const playerPanel = document.querySelector('#playerPanel');
const albumNumber = document.querySelector('#albumNumber');
const albumArtist = document.querySelector('#albumArtist');
const albumTitle = document.querySelector('#albumTitle');
const labelNumber = document.querySelector('.label strong');
const sessionLabel = document.querySelector('.session-label');
const pickerPageBody = document.body;

const records = [
    { id: '001', title: 'P4D / Dance!', color: '#f3ec05', audioUrl: 'mp3/Dance!.mp3' },
    { id: '002', title: 'P5 / Life Will Change', color: '#e12230', audioUrl: 'mp3/Life Will Change.mp3' },
    { id: '003', title: 'SEKAI NO OWARI / 虹色の戦争', color: '#54c9c5', audioUrl: 'mp3/虹色の戦争.mp3' },
    { id: '004', title: 'Mrs. GREEN APPLE / 青と夏', color: '#02599e', audioUrl: 'mp3/mga_2.mp3' },
    { id: '005', title: 'Earth, Wind & Fire / September', color: '#eaa734', audioUrl: 'mp3/Earth, Wind & Fire - September.mp3' },
    { id: '006', title: 'Ken Ishii / Extra', color: '#c9c94d', audioUrl: 'mp3/Ken Ishii - Extra.mp3' },
    { id: '007', title: 'Creepy Nuts / Bling-Bang-Bang-Born', color: '#c90665', audioUrl: 'mp3/Creepy Nuts - Bling-Bang-Bang-Born.mp3' },
    { id: '008', title: 'Metaphor: ReFantazio / 英雄譚序曲', color: '#eeeeee', audioUrl: 'mp3/英雄譚序曲.mp3' },
    { id: '009', title: 'Official髭男dism / Pretender', color: '#b97959', audioUrl: 'mp3/Official髭男dism - Pretender.mp3' },
];
let focusedRecordIndex = 0;
let selectedRecordIndex = 0;
let pickerPointerId = null;
let pickerDragStartX = 0;
let pickerDragStartScrollLeft = 0;
let pickerDidDrag = false;
let pickerPointerStartIndex = null;
let pickerSelectedOnPointerUp = false;
let pickerCards = [];
let pickerScrollFrame;

function updateRecordCount() {
    const recordCount = String(records.length).padStart(2, '0');
    albumMaxNumber.textContent = recordCount;
    pickerPositionMax.textContent = recordCount;
}

function renderPicker() {
    updateRecordCount();
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
    pickerCards = [...pickerTrack.querySelectorAll('.picker-card')];
}

function setFocusedRecord(index) {
    focusedRecordIndex = Math.max(0, Math.min(records.length - 1, index));
    pickerCards.forEach((card, cardIndex) => {
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
    labelNumber.textContent = nextRecord.id;
    document.documentElement.style.setProperty('--accent', nextRecord.color);
    sessionLabel.textContent = nextRecord.id;
    albumNumber.textContent = String(index + 1).padStart(2, '0');
    albumArtist.textContent = artist;
    albumTitle.textContent = title;
    pickerCards.forEach((card, cardIndex) => {
        card.classList.toggle('is-selected', cardIndex === selectedRecordIndex);
    });
    pickerStatus.textContent = `${nextRecord.title} を再生中`;
}

function openPicker() {
    window.RecordPlayer.stop();
    pickerPanel.hidden = false;
    playerPanel.hidden = true;
    pickerPageBody.classList.add('picker-open');
    changeButton.textContent = 'SELECTING';
    changeButton.setAttribute('aria-pressed', 'true');
    setFocusedRecord(selectedRecordIndex);
    requestAnimationFrame(() => {
        pickerTrack.querySelector(`[data-record-index="${selectedRecordIndex}"]`).scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
    });
}

function closePicker() {
    pickerPanel.hidden = true;
    playerPanel.hidden = false;
    pickerPageBody.classList.remove('picker-open');
    changeButton.textContent = 'COLLECTION';
    changeButton.setAttribute('aria-pressed', 'false');
}

function updateFocusedRecordFromScroll() {
    pickerScrollFrame = null;
    const trackBounds = pickerTrack.getBoundingClientRect();
    const trackCenter = trackBounds.left + trackBounds.width / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;
    pickerCards.forEach((card, index) => {
        const bounds = card.getBoundingClientRect();
        const distance = Math.abs(bounds.left + bounds.width / 2 - trackCenter);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
        }
    });
    if (closestIndex !== focusedRecordIndex) setFocusedRecord(closestIndex);
}

pickerTrack.addEventListener(
    'scroll',
    () => {
        if (!pickerScrollFrame) pickerScrollFrame = requestAnimationFrame(updateFocusedRecordFromScroll);
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
selectRecord(0);
