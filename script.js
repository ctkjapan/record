const record = document.querySelector('#record');
const resetButton = document.querySelector('#resetButton');
const dragHint = document.querySelector('#dragHint');
const playState = document.querySelector('#playState');
const rpmValue = document.querySelector('#rpmValue');
const angleValue = document.querySelector('#angleValue');
const meterFill = document.querySelector('#meterFill');
const changeButton = document.querySelector('#changeButton');
const closePickerButton = document.querySelector('#closePickerButton');
const pickerPanel = document.querySelector('#pickerPanel');
const pickerTrack = document.querySelector('#pickerTrack');
const pickerPosition = document.querySelector('#pickerPosition');
const pickerStatus = document.querySelector('#pickerStatus');

const records = [
    { id: '001', title: 'MOSS / FIRST LIGHT', color: '#b4d34b' },
    { id: '002', title: 'EMBER / AFTER HOURS', color: '#ed6a4e' },
    { id: '003', title: 'GOLD / SUNDAY LOOP', color: '#d8c46a' },
    { id: '004', title: 'TIDE / BLUE MOTION', color: '#91b9b0' },
];
let focusedRecordIndex = 0;
let selectedRecordIndex = 0;
let pickerPointerId = null;
let pickerDragStartX = 0;
let pickerDragStartScrollLeft = 0;
let pickerDidDrag = false;

let rotation = 0;
let previousAngle = null;
let pointerId = null;
let lastMoveTime = 0;
let velocity = 0;
let momentumFrame;

function renderPicker() {
    pickerTrack.innerHTML = records
        .map(
            (item, index) => `
    <button class="picker-card${index === selectedRecordIndex ? ' is-selected' : ''}${index === focusedRecordIndex ? ' is-focused' : ''}" type="button" data-record-index="${index}" aria-label="${item.title}を選択">
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
    document.querySelector('.label strong').textContent = nextRecord.id;
    document.querySelector('.label').style.background = nextRecord.color;
    document.querySelector('.session-label').innerHTML = `SIDE A <span>/</span> ${nextRecord.id}`;
    pickerTrack.querySelectorAll('.picker-card').forEach((card, cardIndex) => {
        card.classList.toggle('is-selected', cardIndex === selectedRecordIndex);
    });
    pickerStatus.textContent = `${nextRecord.title} を再生中`;
}

function openPicker() {
    stopMomentum();
    updatePlaying(false);
    pickerPanel.hidden = false;
    document.querySelector('.player').hidden = true;
    changeButton.textContent = '選択中';
    changeButton.setAttribute('aria-pressed', 'true');
    setFocusedRecord(selectedRecordIndex);
    requestAnimationFrame(() => {
        pickerTrack.querySelector(`[data-record-index="${selectedRecordIndex}"]`).scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
    });
}

function closePicker() {
    pickerPanel.hidden = true;
    document.querySelector('.player').hidden = false;
    changeButton.textContent = '変更';
    changeButton.setAttribute('aria-pressed', 'false');
}

function angleFromCenter(event) {
    const bounds = record.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    return (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
}

function setRotation(nextRotation) {
    rotation = nextRotation;
    record.style.transform = `rotate(${rotation}deg)`;
    const normalized = ((Math.round(rotation) % 360) + 360) % 360;
    angleValue.textContent = `${String(normalized).padStart(3, '0')}°`;
    record.setAttribute('aria-valuenow', normalized);
    meterFill.style.width = `${Math.min(Math.abs(velocity) * 7, 100)}%`;
}

function updatePlaying(isPlaying) {
    document.body.classList.toggle('is-playing', isPlaying);
    playState.textContent = isPlaying ? 'NOW SPINNING' : 'READY TO SPIN';
    if (isPlaying) dragHint.classList.add('is-hidden');
}

function stopMomentum() {
    cancelAnimationFrame(momentumFrame);
    velocity = 0;
    meterFill.style.width = '0%';
}

function applyMomentum() {
    if (Math.abs(velocity) < 0.02) {
        stopMomentum();
        updatePlaying(false);
        return;
    }
    setRotation(rotation + velocity);
    velocity *= 0.965;
    momentumFrame = requestAnimationFrame(applyMomentum);
}

record.addEventListener('pointerdown', (event) => {
    stopMomentum();
    pointerId = event.pointerId;
    previousAngle = angleFromCenter(event);
    lastMoveTime = performance.now();
    record.setPointerCapture(pointerId);
    updatePlaying(true);
});

record.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const currentAngle = angleFromCenter(event);
    let delta = currentAngle - previousAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const now = performance.now();
    const elapsed = Math.max(now - lastMoveTime, 1);
    velocity = (delta / elapsed) * 16;
    setRotation(rotation + delta);
    previousAngle = currentAngle;
    lastMoveTime = now;
});

function releasePointer(event) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    previousAngle = null;
    if (Math.abs(velocity) > 0.02) momentumFrame = requestAnimationFrame(applyMomentum);
    else updatePlaying(false);
}

record.addEventListener('pointerup', releasePointer);
record.addEventListener('pointercancel', releasePointer);

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
    pickerPointerId = null;
    pickerTrack.classList.remove('is-dragging');
}

pickerTrack.addEventListener('pointerup', releasePickerPointer);
pickerTrack.addEventListener('pointercancel', releasePickerPointer);
pickerTrack.addEventListener('lostpointercapture', releasePickerPointer);

pickerTrack.addEventListener('click', (event) => {
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

record.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        velocity = direction * 2;
        setRotation(rotation + direction * 12);
        updatePlaying(true);
        cancelAnimationFrame(momentumFrame);
        momentumFrame = requestAnimationFrame(applyMomentum);
    }
});

resetButton.addEventListener('click', () => {
    stopMomentum();
    rotation = 0;
    record.style.transform = 'rotate(0deg)';
    angleValue.textContent = '000°';
    record.setAttribute('aria-valuenow', '0');
    updatePlaying(false);
    dragHint.classList.remove('is-hidden');
});

setRotation(0);
renderPicker();
