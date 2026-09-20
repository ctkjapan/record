const record = document.querySelector('#record');
const playState = document.querySelector('#playState');
const audioTime = document.querySelector('#audioTime');
const audioSeek = document.querySelector('#audioSeek');
const playbackRateValue = document.querySelector('#playbackRateValue');
const angleValue = document.querySelector('#angleValue');
const meterFill = document.querySelector('#meterFill');
const visualizerCanvas = document.querySelector('#visualizer');
const visualizerContext = visualizerCanvas?.getContext('2d');
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
let audioAnalyser;
let visualizerFrame;
let visualizerData;
let audioSourceStartedAt = 0;
let audioSourceStartTime = 0;
let audioSourceRate = 1;
let audioTimeFrame;
let audioUnlocked = false;
let isAudioLoading = false;
let audioLoadProgress = 0;
let isSeeking = false;
let lastAudioTimeLabel = '';
let lastPlaybackRateLabel = '';
let lastPlayStateLabel = '';
let lastAudioBusyState = null;

const ATTENUATION_RATE = 1;
const MIN_PLAYBACK_RATE = 0;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_SMOOTHING = 0.1;
const ROTATION_SPEED_SCALE = 8;
const DOWNLOAD_PROGRESS_MAX = 80;
const DECODE_PROGRESS = 85;
const REVERSE_BUFFER_PROGRESS_START = 92;
const MIN_CENTER = 45;
const MAX_CENTER = 55;
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
    const duration = getAudioDuration();
    const nextLabel = `${formatTime(logicalAudioTime)} / ${formatTime(duration)}`;
    if (nextLabel !== lastAudioTimeLabel) {
        audioTime.textContent = nextLabel;
        lastAudioTimeLabel = nextLabel;
    }
    if (audioSeek) {
        audioSeek.max = String(duration);
        audioSeek.disabled = duration <= 0;
        if (!isSeeking) audioSeek.value = String(Math.min(logicalAudioTime, duration));
    }
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

function isAudioPlayable() {
    return Boolean(audioContext && audioContext.state !== 'closed' && audioBuffer && reversedAudioBuffer && getAudioDuration() > 0);
}

function completeAudioLoading() {
    if (!isAudioPlayable()) return false;
    audioLoadProgress = 100;
    isAudioLoading = false;
    pageBody.classList.remove('is-loading');
    updatePlayState();
    return true;
}

async function readAudioResponse(response) {
    const totalBytes = Number(response.headers.get('content-length'));
    if (!response.body || !Number.isFinite(totalBytes) || totalBytes <= 0) {
        const data = await response.arrayBuffer();
        updateAudioLoadProgress(DOWNLOAD_PROGRESS_MAX);
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
        updateAudioLoadProgress((loadedBytes / totalBytes) * DOWNLOAD_PROGRESS_MAX);
    }

    updateAudioLoadProgress(DOWNLOAD_PROGRESS_MAX);
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
    if (!isSeeking && audioSource && audioContext && duration > 0) {
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

function initializeAudioAnalyser(context) {
    if (audioAnalyser || !visualizerCanvas || !visualizerContext) return audioAnalyser;
    audioAnalyser = context.createAnalyser();
    audioAnalyser.fftSize = 128;
    audioAnalyser.smoothingTimeConstant = 0.8;
    audioAnalyser.connect(context.destination);
    visualizerData = new Uint8Array(audioAnalyser.frequencyBinCount);
    return audioAnalyser;
}

function resizeVisualizerCanvas() {
    if (!visualizerCanvas || !visualizerContext) return null;
    const bounds = visualizerCanvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(bounds.width * pixelRatio));
    const height = Math.max(1, Math.floor(bounds.height * pixelRatio));
    if (visualizerCanvas.width !== width || visualizerCanvas.height !== height) {
        visualizerCanvas.width = width;
        visualizerCanvas.height = height;
        visualizerContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
    return { width: bounds.width, height: bounds.height, bounds };
}

function clearVisualizer() {
    cancelAnimationFrame(visualizerFrame);
    visualizerFrame = null;
    if (!visualizerCanvas || !visualizerContext) return;
    const size = resizeVisualizerCanvas();
    if (size) visualizerContext.clearRect(0, 0, size.width, size.height);
}

function updateVisualizer() {
    if (!audioSource || !audioAnalyser || !visualizerContext || !visualizerData) {
        clearVisualizer();
        return;
    }
    const size = resizeVisualizerCanvas();
    if (!size) return;
    audioAnalyser.getByteFrequencyData(visualizerData);
    const recordBounds = record.getBoundingClientRect();
    const centerX = recordBounds.left - size.bounds.left + recordBounds.width / 2;
    const centerY = recordBounds.top - size.bounds.top + recordBounds.height / 2;
    const baseRadius = recordBounds.width / 2 + 12;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#83bd98';
    const barCount = visualizerData.length;
    const barAngle = (Math.PI * 2) / barCount;

    visualizerContext.clearRect(0, 0, size.width, size.height);
    visualizerContext.lineWidth = 2;
    visualizerContext.lineCap = 'round';
    for (let index = 0; index < barCount; index += 1) {
        const amplitude = visualizerData[index] / 255;
        const angle = index * barAngle - Math.PI / 2;
        const innerRadius = baseRadius;
        const outerRadius = innerRadius + 8 + amplitude * 52;
        visualizerContext.strokeStyle = accent;
        visualizerContext.globalAlpha = 0.16 + amplitude * 0.55;
        visualizerContext.beginPath();
        visualizerContext.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
        visualizerContext.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
        visualizerContext.stroke();
    }
    visualizerContext.globalAlpha = 1;
    visualizerFrame = requestAnimationFrame(updateVisualizer);
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
        .then((data) => {
            updateAudioLoadProgress(DECODE_PROGRESS);
            return context.decodeAudioData(data);
        })
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
                updateAudioLoadProgress(REVERSE_BUFFER_PROGRESS_START + ((channel + 1) / buffer.numberOfChannels) * (99 - REVERSE_BUFFER_PROGRESS_START));
            }
            updateAudioLoadProgress(99);
            audioBufferCache.set(sourceUrl, { forward: buffer, reverse: reversedAudioBuffer });
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
    isSeeking = false;
    updateAudioTime();
    audioLoadProgress = 0;
    isAudioLoading = true;
    pageBody.classList.add('is-loading');
    updatePlayState();
    const nextLoadPromise = loadAudioBuffer();
    return nextLoadPromise.then(
        (buffer) => {
            if (nextSourceUrl === audioSourceUrl) {
                completeAudioLoading();
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
    clearVisualizer();
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

function updateSeekPreview() {
    const duration = getAudioDuration();
    if (!audioSeek || duration <= 0) return;
    isSeeking = true;
    logicalAudioTime = Math.max(0, Math.min(duration, Number(audioSeek.value)));
    updateAudioTime();
}

function commitSeek() {
    if (!isSeeking) return;
    if (audioSource) {
        stopAudioSource();
        if (isAudioPlaying) startAudioSource();
    }
    isSeeking = false;
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
    source.connect(initializeAudioAnalyser(audioContext) || audioContext.destination);
    audioSource = source;
    audioSourceStartedAt = audioContext.currentTime;
    audioSourceStartTime = logicalAudioTime;
    const offset = audioDirection === 'reverse' ? duration - logicalAudioTime : logicalAudioTime;
    source.start(0, Math.min(duration, Math.max(0, offset)));
    completeAudioLoading();
    audioTimeFrame = requestAnimationFrame(updateAudioTimeLoop);
    visualizerFrame = requestAnimationFrame(updateVisualizer);
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
    if (speedPercent <= MIN_CENTER) {
        return MIN_PLAYBACK_RATE + (speedPercent / MIN_CENTER) * (1 - MIN_PLAYBACK_RATE);
    }
    if (speedPercent <= MAX_CENTER) {
        return 1;
    }
    return 1 + ((speedPercent - MAX_CENTER) / MIN_CENTER) * (MAX_PLAYBACK_RATE - 1);
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

audioSeek.addEventListener('input', updateSeekPreview);
audioSeek.addEventListener('change', commitSeek);
audioSeek.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') commitSeek();
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
