const record = document.querySelector('#record');
const resetButton = document.querySelector('#resetButton');
const dragHint = document.querySelector('#dragHint');
const playState = document.querySelector('#playState');
const audioTime = document.querySelector('#audioTime');
const playbackRateValue = document.querySelector('#playbackRateValue');
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
let playbackRateFrame;
let targetPlaybackRate = 1;
let isAudioPlaying = false;
let logicalAudioTime = 0;
let audioDirection = 'forward';
let audioContext;
let audioBuffer;
let reversedAudioBuffer;
let audioLoadPromise;
let audioSource;
let audioSourceStartedAt = 0;
let audioSourceStartTime = 0;
let audioSourceRate = 1;
let audioTimeFrame;
let audioUnlocked = false;

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 8;
const PLAYBACK_RATE_SMOOTHING = 0.2;
const AUDIO_SOURCE_URL = 'mp3/1-01%20Dance!.mp3';

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');
    return hours > 0 ? `${String(hours).padStart(2, '0')}:${formattedMinutes}:${formattedSeconds}` : `${formattedMinutes}:${formattedSeconds}`;
}

function getAudioDuration() {
    return audioBuffer?.duration || 0;
}

function updateAudioTime() {
    audioTime.textContent = `${formatTime(logicalAudioTime)} / ${formatTime(getAudioDuration())}`;
}

function updatePlaybackRateLabel() {
    playbackRateValue.textContent = `${audioSourceRate.toFixed(2)}x`;
}

function syncLogicalAudioTime() {
    const duration = getAudioDuration();
    if (audioSource && audioContext) {
        const elapsed = Math.max(0, audioContext.currentTime - audioSourceStartedAt);
        const directionFactor = audioDirection === 'reverse' ? -1 : 1;
        logicalAudioTime = Math.min(duration, Math.max(0, audioSourceStartTime + elapsed * audioSourceRate * directionFactor));
    }
    updateAudioTime();
}

function updateAudioTimeLoop() {
    if (!audioSource) return;
    syncLogicalAudioTime();
    audioTimeFrame = requestAnimationFrame(updateAudioTimeLoop);
}

function createAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio API is not supported.');
    const probeContext = new AudioContextClass();
    const hardwareSampleRate = probeContext.sampleRate || 48000;
    probeContext.close();
    try {
        return new AudioContextClass({ sampleRate: hardwareSampleRate });
    } catch {
        return new AudioContextClass({ sampleRate: 48000 });
    }
}

function initializeAudioContext() {
    if (!audioContext) audioContext = createAudioContext();
    return audioContext;
}

function loadAudioBuffer() {
    if (audioLoadPromise) return audioLoadPromise;
    const context = initializeAudioContext();
    audioLoadPromise = fetch(AUDIO_SOURCE_URL)
        .then((response) => {
            if (!response.ok) throw new Error(`音声の読み込みに失敗しました: ${response.status}`);
            return response.arrayBuffer();
        })
        .then((data) => context.decodeAudioData(data))
        .then((buffer) => {
            audioBuffer = buffer;
            reversedAudioBuffer = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
            for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
                const sourceChannel = buffer.getChannelData(channel);
                const reversedChannel = reversedAudioBuffer.getChannelData(channel);
                for (let index = 0; index < sourceChannel.length; index += 1) {
                    reversedChannel[index] = sourceChannel[sourceChannel.length - index - 1];
                }
            }
            updateAudioTime();
            return audioBuffer;
        });
    audioLoadPromise.catch(() => {
        audioLoadPromise = null;
    });
    return audioLoadPromise;
}

function unlockAudioContext() {
    const context = initializeAudioContext();
    const resumePromise = context.state === 'suspended' ? context.resume() : Promise.resolve();
    return resumePromise.then(() => {
        if (audioUnlocked) return;
        const silentBuffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * 0.01)), context.sampleRate);
        const silentSource = context.createBufferSource();
        silentSource.buffer = silentBuffer;
        silentSource.connect(context.destination);
        silentSource.start(0);
        silentSource.stop(context.currentTime + 0.01);
        audioUnlocked = true;
    });
}

function prepareAudio() {
    const unlockPromise = unlockAudioContext();
    const loadPromise = loadAudioBuffer();
    Promise.all([unlockPromise, loadPromise])
        .then(() => {
            if (isAudioPlaying) startAudioSource();
        })
        .catch(() => {});
}

function stopAudioSource(preserveTime = true) {
    if (!audioSource) return;
    syncLogicalAudioTime();
    const source = audioSource;
    audioSource = null;
    source.onended = null;
    try {
        source.stop();
    } catch {
        // 再生終了済みのソースは停止処理を不要とする。
    }
    source.disconnect();
    cancelAnimationFrame(audioTimeFrame);
    audioTimeFrame = null;
    if (!preserveTime) logicalAudioTime = audioDirection === 'reverse' ? 0 : getAudioDuration();
    updateAudioTime();
}

function startAudioSource() {
    if (!isAudioPlaying) return;
    if (!audioBuffer || !reversedAudioBuffer || !audioContext || audioSource) return;
    const duration = getAudioDuration();
    if (audioDirection === 'reverse' && logicalAudioTime <= 0) {
        updatePlaying(false);
        return;
    }
    const source = audioContext.createBufferSource();
    source.buffer = audioDirection === 'reverse' ? reversedAudioBuffer : audioBuffer;
    source.playbackRate.value = audioSourceRate;
    source.connect(audioContext.destination);
    audioSource = source;
    audioSourceStartedAt = audioContext.currentTime;
    audioSourceStartTime = logicalAudioTime;
    source.onended = () => {
        if (audioSource !== source) return;
        audioSource = null;
        cancelAnimationFrame(audioTimeFrame);
        audioTimeFrame = null;
        logicalAudioTime = audioDirection === 'reverse' ? 0 : duration;
        updateAudioTime();
        updatePlaying(false);
    };
    const offset = audioDirection === 'reverse' ? duration - logicalAudioTime : logicalAudioTime;
    source.start(0, Math.min(duration, Math.max(0, offset)));
    audioTimeFrame = requestAnimationFrame(updateAudioTimeLoop);
}

function setAudioDirection(direction) {
    if (direction === audioDirection) return;
    if (isAudioPlaying) stopAudioSource();
    audioDirection = direction;
    if (isAudioPlaying) startAudioSource();
}

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
    stopMomentum();
    updatePlaying(false);
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
    targetPlaybackRate = velocity === 0 ? 1 : Math.min(Math.max(Math.abs(velocity), MIN_PLAYBACK_RATE), MAX_PLAYBACK_RATE);
    setAudioDirection(velocity < 0 ? 'reverse' : velocity > 0 ? 'forward' : audioDirection);
    if (!playbackRateFrame) playbackRateFrame = requestAnimationFrame(updatePlaybackRate);
}

function updatePlaybackRate() {
    const difference = targetPlaybackRate - audioSourceRate;
    if (Math.abs(difference) < 0.01) {
        audioSourceRate = targetPlaybackRate;
        if (audioSource && audioContext) {
            syncLogicalAudioTime();
            audioSourceStartTime = logicalAudioTime;
            audioSourceStartedAt = audioContext.currentTime;
            audioSource.playbackRate.value = audioSourceRate;
        }
        updatePlaybackRateLabel();
        playbackRateFrame = null;
        return;
    }
    audioSourceRate += difference * PLAYBACK_RATE_SMOOTHING;
    if (audioSource && audioContext) {
        syncLogicalAudioTime();
        audioSourceStartTime = logicalAudioTime;
        audioSourceStartedAt = audioContext.currentTime;
        audioSource.playbackRate.value = audioSourceRate;
    }
    updatePlaybackRateLabel();
    playbackRateFrame = requestAnimationFrame(updatePlaybackRate);
}

function updatePlaying(isPlaying) {
    isAudioPlaying = isPlaying;
    document.body.classList.toggle('is-playing', isPlaying);
    playState.textContent = isPlaying ? 'NOW SPINNING' : 'READY TO SPIN';
    if (isPlaying) {
        dragHint.classList.add('is-hidden');
        if (getAudioDuration() > 0 && logicalAudioTime >= getAudioDuration()) logicalAudioTime = 0;
        prepareAudio();
    } else {
        stopAudioSource();
    }
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
    // モバイルブラウザの自動再生制限を満たすため、ユーザー操作中に再生を開始する。
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
updateAudioTime();
updatePlaybackRateLabel();
renderPicker();

try {
    initializeAudioContext();
    loadAudioBuffer().catch(() => {});
} catch {
    // 音声未対応環境でも画面操作は継続できるようにする。
}
