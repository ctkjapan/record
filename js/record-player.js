const record = document.querySelector('#record');
const resetButton = document.querySelector('#resetButton');
const dragHint = document.querySelector('#dragHint');
const playState = document.querySelector('#playState');
const audioTime = document.querySelector('#audioTime');
const playbackRateValue = document.querySelector('#playbackRateValue');
const angleValue = document.querySelector('#angleValue');
const meterFill = document.querySelector('#meterFill');
const pageBody = document.body;

let rotation = 0;
let previousAngle = null;
let pointerId = null;
let lastMoveTime = 0;
let velocity = 0;
let momentumFrame;
let playbackRateFrame;
let targetPlaybackRate = 0;
let isAudioPlaying = false;
let logicalAudioTime = 0;
let audioDirection = 'forward';
let audioContext;
let audioBuffer;
let reversedAudioBuffer;
let audioLoadPromise;
let audioLoadRequestId = 0;
let audioLoadController;
const audioBufferCache = new Map();
let audioSource;
let audioSourceStartedAt = 0;
let audioSourceStartTime = 0;
let audioSourceRate = 1;
let audioTimeFrame;
let audioUnlocked = false;
let isAudioLoading = false;
let audioLoadProgress = 0;
let lastAudioTimeLabel = '';
let lastPlaybackRateLabel = '';
let lastPlayStateLabel = '';
let lastAudioBusyState = null;

const ATTENUATION_RATE = 1;
const MIN_PLAYBACK_RATE = 0;
const MAX_PLAYBACK_RATE = 4;
const PLAYBACK_RATE_SMOOTHING = 0.1;
const ROTATION_SPEED_SCALE = 4;
const DEFAULT_AUDIO_SOURCE_URL = 'mp3/1-01%20Dance!.mp3';
let audioSourceUrl = DEFAULT_AUDIO_SOURCE_URL;

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
    const nextLabel = `${formatTime(logicalAudioTime)} / ${formatTime(getAudioDuration())}`;
    if (nextLabel === lastAudioTimeLabel) return;
    audioTime.textContent = nextLabel;
    lastAudioTimeLabel = nextLabel;
}

function updatePlaybackRateLabel() {
    const nextLabel = `${audioSourceRate.toFixed(2)}x`;
    if (nextLabel === lastPlaybackRateLabel) return;
    playbackRateValue.textContent = nextLabel;
    lastPlaybackRateLabel = nextLabel;
}

function updatePlayState() {
    const nextLabel = isAudioLoading ? `LOADING AUDIO ${audioLoadProgress}%` : isAudioPlaying ? 'NOW SPINNING' : 'READY TO SPIN';
    if (nextLabel !== lastPlayStateLabel) {
        playState.textContent = nextLabel;
        lastPlayStateLabel = nextLabel;
    }
    const nextBusyState = String(isAudioLoading);
    if (nextBusyState !== lastAudioBusyState) {
        record.setAttribute('aria-busy', nextBusyState);
        lastAudioBusyState = nextBusyState;
    }
}

function updateAudioLoadProgress(progress) {
    const nextProgress = Math.max(0, Math.min(99, Math.floor(progress)));
    if (nextProgress === audioLoadProgress) return;
    audioLoadProgress = nextProgress;
    updatePlayState();
}

async function readAudioResponse(response) {
    const totalBytes = Number(response.headers.get('content-length'));
    if (!response.body || !Number.isFinite(totalBytes) || totalBytes <= 0) {
        const data = await response.arrayBuffer();
        updateAudioLoadProgress(99);
        return data;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let loadedBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        loadedBytes += value.byteLength;
        updateAudioLoadProgress((loadedBytes / totalBytes) * 100);
    }

    updateAudioLoadProgress(99);
    const data = new Uint8Array(loadedBytes);
    let offset = 0;
    chunks.forEach((chunk) => {
        data.set(chunk, offset);
        offset += chunk.byteLength;
    });
    return data.buffer;
}

function syncLogicalAudioTime() {
    const duration = getAudioDuration();
    if (audioSource && audioContext && duration > 0) {
        const elapsed = Math.max(0, audioContext.currentTime - audioSourceStartedAt);
        const directionFactor = audioDirection === 'reverse' ? -1 : 1;
        const nextTime = audioSourceStartTime + elapsed * audioSourceRate * directionFactor;
        logicalAudioTime = ((nextTime % duration) + duration) % duration;
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
    const sourceUrl = audioSourceUrl;
    const requestId = ++audioLoadRequestId;
    const cachedBuffers = audioBufferCache.get(sourceUrl);
    if (cachedBuffers) {
        audioBuffer = cachedBuffers.forward;
        reversedAudioBuffer = cachedBuffers.reverse;
        updateAudioTime();
        return Promise.resolve(audioBuffer);
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    audioLoadController = controller;
    audioLoadPromise = fetch(sourceUrl, controller ? { signal: controller.signal } : undefined)
        .then((response) => {
            if (!response.ok) throw new Error(`音声の読み込みに失敗しました: ${response.status}`);
            return readAudioResponse(response);
        })
        .then((data) => context.decodeAudioData(data))
        .then((buffer) => {
            if (requestId !== audioLoadRequestId || sourceUrl !== audioSourceUrl) return null;
            audioBuffer = buffer;
            reversedAudioBuffer = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
            for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
                const sourceChannel = buffer.getChannelData(channel);
                const reversedChannel = reversedAudioBuffer.getChannelData(channel);
                for (let index = 0; index < sourceChannel.length; index += 1) {
                    reversedChannel[index] = sourceChannel[sourceChannel.length - index - 1];
                }
            }
            audioBufferCache.set(sourceUrl, { forward: buffer, reverse: reversedAudioBuffer });
            audioLoadProgress = 100;
            updatePlayState();
            updateAudioTime();
            return audioBuffer;
        });
    const currentLoadPromise = audioLoadPromise;
    currentLoadPromise.then(
        () => {
            if (audioLoadController === controller) audioLoadController = null;
        },
        () => {
            if (audioLoadController === controller) audioLoadController = null;
        },
    );
    currentLoadPromise.catch(() => {
        if (audioLoadPromise === currentLoadPromise) audioLoadPromise = null;
    });
    return audioLoadPromise;
}

function setAudioSource(sourceUrl) {
    const nextSourceUrl = sourceUrl || DEFAULT_AUDIO_SOURCE_URL;
    if (nextSourceUrl === audioSourceUrl && (audioBuffer || audioLoadPromise)) {
        return audioLoadPromise || Promise.resolve(audioBuffer);
    }
    if (audioSource) stopAudioSource();
    if (audioLoadController) {
        audioLoadController.abort();
        audioLoadController = null;
    }
    audioSourceUrl = nextSourceUrl;
    audioLoadRequestId += 1;
    audioLoadPromise = null;
    audioBuffer = null;
    reversedAudioBuffer = null;
    logicalAudioTime = 0;
    updateAudioTime();
    audioLoadProgress = 0;
    isAudioLoading = true;
    pageBody.classList.add('is-loading');
    updatePlayState();
    const nextLoadPromise = loadAudioBuffer();
    return nextLoadPromise.then(
        (buffer) => {
            if (nextSourceUrl === audioSourceUrl) {
                isAudioLoading = false;
                pageBody.classList.remove('is-loading');
                updatePlayState();
            }
            return buffer;
        },
        (error) => {
            if (nextSourceUrl !== audioSourceUrl) return null;
            isAudioLoading = false;
            pageBody.classList.remove('is-loading');
            playState.textContent = 'AUDIO LOAD ERROR';
            lastPlayStateLabel = 'AUDIO LOAD ERROR';
            record.setAttribute('aria-busy', 'false');
            lastAudioBusyState = 'false';
            throw error;
        },
    );
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

function stopAudioSource() {
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
    updateAudioTime();
}

function startAudioSource() {
    if (!isAudioPlaying || !audioBuffer || !reversedAudioBuffer || !audioContext || audioSource) return;
    const duration = getAudioDuration();
    if (audioDirection === 'reverse' && logicalAudioTime <= 0) {
        updatePlaying(false);
        return;
    }
    const source = audioContext.createBufferSource();
    source.buffer = audioDirection === 'reverse' ? reversedAudioBuffer : audioBuffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = duration;
    source.playbackRate.value = audioSourceRate;
    source.connect(audioContext.destination);
    audioSource = source;
    audioSourceStartedAt = audioContext.currentTime;
    audioSourceStartTime = logicalAudioTime;
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

function angleFromCenter(event) {
    const bounds = record.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    return (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
}

function getRotationSpeedPercent() {
    return Math.min(Math.abs(velocity) * ROTATION_SPEED_SCALE, 100);
}

function getPlaybackRateForSpeed(speedPercent) {
    if (speedPercent <= 40) {
        return MIN_PLAYBACK_RATE + (speedPercent / 40) * (1 - MIN_PLAYBACK_RATE);
    }
    if (speedPercent <= 60) {
        return 1;
    }
    return 1 + ((speedPercent - 60) / 40) * (MAX_PLAYBACK_RATE - 1);
}

function setRotation(nextRotation) {
    rotation = nextRotation;
    record.style.transform = `rotate(${rotation}deg)`;
    const normalized = ((Math.round(rotation) % 360) + 360) % 360;
    angleValue.textContent = `${String(normalized).padStart(3, '0')}°`;
    record.setAttribute('aria-valuenow', normalized);
    const speedPercent = getRotationSpeedPercent();
    meterFill.style.width = `${speedPercent}%`;
    targetPlaybackRate = getPlaybackRateForSpeed(speedPercent);
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
    pageBody.classList.toggle('is-playing', isPlaying);
    updatePlayState();
    if (isPlaying) {
        dragHint.classList.add('is-hidden');
        if (getAudioDuration() > 0 && logicalAudioTime >= getAudioDuration()) logicalAudioTime = 0;
        prepareAudio();
    } else {
        stopAudioSource();
    }
}

function stopPlayback() {
    stopMomentum();
    updatePlaying(false);
}

function stopMomentum() {
    cancelAnimationFrame(momentumFrame);
    velocity = 0;
    meterFill.style.width = '0%';
    targetPlaybackRate = MIN_PLAYBACK_RATE;
    if (!playbackRateFrame) playbackRateFrame = requestAnimationFrame(updatePlaybackRate);
}

function applyMomentum() {
    if (Math.abs(velocity) < 0.02) {
        stopMomentum();
        updatePlaying(false);
        return;
    }
    setRotation(rotation + velocity);
    velocity *= ATTENUATION_RATE;
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

record.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    velocity = direction * 2;
    setRotation(rotation + direction * 12);
    updatePlaying(true);
    cancelAnimationFrame(momentumFrame);
    momentumFrame = requestAnimationFrame(applyMomentum);
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

window.RecordPlayer = Object.freeze({
    setAudioSource,
    stop: stopPlayback,
});

setRotation(0);
updateAudioTime();
updatePlaybackRateLabel();

try {
    setAudioSource(DEFAULT_AUDIO_SOURCE_URL).catch(() => {});
} catch {
    // 音声未対応環境でも画面操作は継続できるようにする。
}
