import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { PlaybackService } from '../src/application/playback-service.js';
import { RecordCatalogService } from '../src/application/record-catalog-service.js';
import { RecordSelectionService } from '../src/application/record-selection-service.js';
import { PlaybackPolicy } from '../src/domain/playback-policy.js';
import { RecordSelectionPolicy } from '../src/domain/record-selection-policy.js';
import { RecordSelection } from '../src/domain/record-selection.js';
import { PlaybackDirection } from '../src/domain/playback-direction.js';
import { PlaybackSession } from '../src/domain/playback-session.js';
import { PlaybackSeconds } from '../src/domain/playback-seconds.js';
import { PlaybackTimeline } from '../src/domain/playback-timeline.js';
import { RotationSpeedPercent } from '../src/domain/rotation-speed-percent.js';
import { Record } from '../src/domain/record.js';
import { RecordCatalog } from '../src/domain/record-catalog.js';
import { BrowserInteractionController } from '../src/presentation/browser-interaction-controller.js';
import { RecordPickerController } from '../src/presentation/record-picker-controller.js';
import { TextRevealController } from '../src/presentation/text-reveal-controller.js';
import { SplashController } from '../src/presentation/splash-controller.js';
import { PlaybackStateRepository } from '../src/infrastructure/playback-state-repository.js';
import { RecordJsonRepository } from '../src/infrastructure/record-json-repository.js';
import { WebAudioEngine } from '../src/infrastructure/web-audio-engine.js';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function createPlaybackService({
    state = { recordId: 'record-a', playbackSeconds: 12.5, noiseEnabled: false, visualizerEnabled: true },
    currentSeconds = 31.25,
    playbackRate = 1,
} = {}) {
    const engineCalls = [];
    const repositoryCalls = [];
    const audioEngine = {
        isNoiseEnabled: state.noiseEnabled,
        direction: 'forward',
        duration: 120,
        playbackRate,
        isLoading: false,
        audioLoadProgress: 100,
        isPlaying: false,
        hasSource: true,
        unlock: async () => engineCalls.push(['unlock']),
        setCallbacks: (callbacks) => engineCalls.push(['setCallbacks', callbacks]),
        setSource: (url, seconds) => {
            engineCalls.push(['setSource', url, seconds]);
            return Promise.resolve();
        },
        getCurrentSeconds: () => {
            engineCalls.push(['getCurrentSeconds']);
            return currentSeconds;
        },
        getFrequencyData: () => new Uint8Array([1]),
        getTimeDomainData: () => new Uint8Array([2]),
        play: () => Promise.resolve(),
        stop: () => engineCalls.push(['stop']),
        seek: (seconds) => engineCalls.push(['seek', seconds]),
        previewSeek: (seconds) => engineCalls.push(['previewSeek', seconds]),
        setDirection: (direction) => {
            engineCalls.push(['setDirection', direction]);
            audioEngine.direction = direction;
        },
        setPlaybackRate: (rate) => {
            engineCalls.push(['setPlaybackRate', rate]);
            audioEngine.playbackRate = rate;
        },
        setNoiseEnabled: async (enabled) => {
            engineCalls.push(['setNoiseEnabled', enabled]);
            audioEngine.isNoiseEnabled = enabled;
        },
    };
    const playbackStateRepository = {
        load: () => state,
        saveRecordId: (id) => repositoryCalls.push(['saveRecordId', id]),
        savePlaybackSeconds: (seconds) => repositoryCalls.push(['savePlaybackSeconds', seconds]),
        saveNoiseEnabled: (enabled) => repositoryCalls.push(['saveNoiseEnabled', enabled]),
        saveVisualizerEnabled: (enabled) => repositoryCalls.push(['saveVisualizerEnabled', enabled]),
    };
    return {
        service: new PlaybackService({ audioEngine, playbackStateRepository }),
        audioEngine,
        engineCalls,
        repositoryCalls,
    };
}

function createBrowserInteractionFixture({ innerWidth = 400, scrollY = 0, wasDiscarded = false, playbackService = null, playerHidden = false, pickerHidden = true } = {}) {
    const windowListeners = new Map();
    const documentListeners = new Map();
    let reloadCount = 0;
    let mutationObserverCallback = null;
    const windowRef = {
        innerWidth,
        scrollY,
        location: { reload: () => reloadCount++ },
        addEventListener: (type, listener) => windowListeners.set(type, listener),
    };
    const documentRef = {
        wasDiscarded,
        hidden: false,
        addEventListener: (type, listener, options) => documentListeners.set(type, { listener, options }),
        querySelector: (selector) => selector === '#playerPanel' ? playerPanel : selector === '#pickerPanel' ? pickerPanel : null,
    };
    const playerPanel = { hidden: playerHidden };
    const pickerPanel = { hidden: pickerHidden };
    class FakeMutationObserver {
        constructor(callback) {
            mutationObserverCallback = callback;
        }
        observe() {}
    }
    class FakeElement {}
    const controller = new BrowserInteractionController({
        windowRef,
        documentRef,
        ElementClass: FakeElement,
        MutationObserverClass: FakeMutationObserver,
        playbackService,
        playerPanel,
        pickerPanel,
    });
    controller.initialize();
    return {
        controller,
        windowRef,
        documentRef,
        FakeElement,
        windowListeners,
        documentListeners,
        playerPanel,
        pickerPanel,
        notifyScreenChanged: () => mutationObserverCallback?.(),
        get reloadCount() {
            return reloadCount;
        },
    };
}

function createCancelableEvent(properties = {}) {
    let prevented = false;
    return {
        cancelable: true,
        preventDefault: () => {
            prevented = true;
        },
        wasPrevented: () => prevented,
        ...properties,
    };
}

function createSplashFixture({ activateAudio = async () => {}, onPlayerScreenShown = () => {} } = {}) {
    class FakeElement {
        constructor() {
            this.disabled = false;
            this.hidden = false;
            this.textContent = '';
            this.attributes = new Set();
            this.listeners = new Map();
            this.classList = {
                values: new Set(),
                add(name) {
                    this.values.add(name);
                },
                toggle(name, enabled) {
                    if (enabled) this.values.add(name);
                    else this.values.delete(name);
                },
            };
        }

        addEventListener(type, listener) {
            this.listeners.set(type, listener);
        }

        focus() {}

        toggleAttribute(name, enabled) {
            if (enabled) this.attributes.add(name);
            else this.attributes.delete(name);
        }
    }
    const elements = new Map([
        ['#splashScreen', new FakeElement()],
        ['#splashStartButton', new FakeElement()],
        ['#splashStatus', new FakeElement()],
        ['header', new FakeElement()],
        ['main', new FakeElement()],
    ]);
    const documentRef = {
        body: new FakeElement(),
        querySelector: (selector) => elements.get(selector),
    };
    const controller = new SplashController({ playbackService: { activateAudio }, documentRef, onPlayerScreenShown });
    return { controller, elements, documentRef };
}

function createCookieDocument(initialCookies = {}) {
    const cookies = new Map(Object.entries(initialCookies));
    return {
        get cookie() {
            return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
        },
        set cookie(serializedCookie) {
            const [pair] = serializedCookie.split(';');
            const separatorIndex = pair.indexOf('=');
            cookies.set(pair.slice(0, separatorIndex), pair.slice(separatorIndex + 1));
        },
    };
}

test('record change stops playback, saves current position, resets position, and loads the new source', () => {
    const { service, engineCalls, repositoryCalls } = createPlaybackService({ currentSeconds: 31.25 });

    const result = service.selectRecord({ id: 'record-b', audioUrl: 'assets/mp3/b.mp3' });

    assert.deepEqual(result, { isRecordChanged: true });
    assert.deepEqual(engineCalls, [
        ['stop'],
        ['getCurrentSeconds'],
        ['setSource', 'assets/mp3/b.mp3', 0],
    ]);
    assert.deepEqual(repositoryCalls, [
        ['savePlaybackSeconds', 31.25],
        ['saveRecordId', 'record-b'],
    ]);
    assert.deepEqual(service.getState(), {
        recordId: 'record-b',
        playbackSeconds: 0,
        noiseEnabled: false,
        visualizerEnabled: true,
    });
});

test('selecting the same record keeps its saved position and does not stop playback', () => {
    const { service, engineCalls, repositoryCalls } = createPlaybackService();

    const result = service.selectRecord({ id: 'record-a', audioUrl: 'assets/mp3/a.mp3' });

    assert.deepEqual(result, { isRecordChanged: false });
    assert.deepEqual(engineCalls, [['setSource', 'assets/mp3/a.mp3', 12.5]]);
    assert.deepEqual(repositoryCalls, [['saveRecordId', 'record-a']]);
    assert.equal(service.getState().playbackSeconds, 12.5);
});

test('playback rate smoothing preserves the former 0.1 step and 0.01 settling threshold', () => {
    const { service, engineCalls } = createPlaybackService({ playbackRate: 1 });

    assert.deepEqual(service.approachPlaybackRate(2), { rate: 1.1, isSettled: false });
    assert.deepEqual(service.approachPlaybackRate(1.105), { rate: 1.105, isSettled: true });
    assert.deepEqual(engineCalls, [
        ['setPlaybackRate', 1.1],
        ['setPlaybackRate', 1.105],
    ]);
});

test('rotation keeps the previous forward, reverse, and zero-velocity directions', () => {
    assert.equal(PlaybackPolicy.directionFromRotationVelocity(2, 'reverse'), 'forward');
    assert.equal(PlaybackPolicy.directionFromRotationVelocity(-2, 'forward'), 'reverse');
    assert.equal(PlaybackPolicy.directionFromRotationVelocity(0, 'reverse'), 'reverse');
    assert.equal(PlaybackPolicy.directionFromRotationVelocity(0, 'invalid'), 'forward');
});

test('rotation delta follows the shortest path across the angle boundary', () => {
    assert.equal(PlaybackPolicy.normalizeRotationDelta(350), -10);
    assert.equal(PlaybackPolicy.normalizeRotationDelta(-350), 10);
    assert.equal(PlaybackPolicy.normalizeRotationDelta(180), 180);
    assert.equal(PlaybackPolicy.normalizeRotationDelta(-180), -180);
});

test('rotation velocity normalizes pointer angle changes to the 16ms frame interval', () => {
    assert.equal(PlaybackPolicy.rotationVelocityFromDelta(8, 16), 8);
    assert.equal(PlaybackPolicy.rotationVelocityFromDelta(8, 32), 4);
    assert.equal(PlaybackPolicy.rotationVelocityFromDelta(-8, 16), -8);
    assert.equal(PlaybackPolicy.rotationVelocityFromDelta(8, 0), 128);
});

test('rotation momentum uses the established start and stop threshold boundaries', () => {
    assert.equal(PlaybackPolicy.shouldStartRotationMomentum(0.021), true);
    assert.equal(PlaybackPolicy.shouldStartRotationMomentum(-0.021), true);
    assert.equal(PlaybackPolicy.shouldStartRotationMomentum(0.02), false);
    assert.equal(PlaybackPolicy.isRotationMomentumBelowThreshold(0.019), true);
    assert.equal(PlaybackPolicy.isRotationMomentumBelowThreshold(-0.019), true);
    assert.equal(PlaybackPolicy.isRotationMomentumBelowThreshold(0.02), false);
});

test('PlaybackDirection is an immutable value object with a valid reverse operation', () => {
    const invalidDirection = new PlaybackDirection('invalid');
    const reverseDirection = new PlaybackDirection('reverse');

    assert.equal(invalidDirection.value, 'forward');
    assert.equal(invalidDirection.reverse().value, 'reverse');
    assert.equal(reverseDirection.reverse().value, 'forward');
    assert.equal(Object.isFrozen(reverseDirection), true);
});

test('rotation speed conversion follows the domain policy in both directions', () => {
    const { service } = createPlaybackService();

    assert.equal(PlaybackPolicy.rotationVelocityFromSpeedPercent(80, 'forward'), 10);
    assert.equal(PlaybackPolicy.rotationVelocityFromSpeedPercent(80, 'reverse'), -10);
    assert.equal(PlaybackPolicy.rotationSpeedPercentFromVelocity(-10), 80);
    assert.equal(PlaybackPolicy.rotationSpeedPercentFromVelocity(20), 100);
    assert.equal(service.rotationVelocityFromSpeedPercent(80, 'reverse'), -10);
    assert.equal(service.rotationSpeedPercentFromVelocity(-10), 80);
    assert.equal(PlaybackPolicy.rateFromRotationSpeedPercent(-10), 0);
    assert.equal(PlaybackPolicy.rateFromRotationSpeedPercent(150), 2);
    assert.equal(PlaybackPolicy.rateFromRotationSpeedPercent(Number.NaN), 0);
});

test('RotationSpeedPercent enforces its finite 0 to 100 domain range', () => {
    assert.equal(new RotationSpeedPercent('42.5').value, 42.5);
    assert.equal(new RotationSpeedPercent(-1).value, 0);
    assert.equal(new RotationSpeedPercent(101).value, 100);
    assert.equal(new RotationSpeedPercent(Number.NaN).value, 0);
    assert.equal(Object.isFrozen(new RotationSpeedPercent(1)), true);
});

test('playback session continues to normalize stored seconds and preserve settings on record change', () => {
    const session = new PlaybackSession({
        recordId: 'record-a',
        playbackSeconds: 12.5,
        noiseEnabled: true,
        visualizerEnabled: false,
    });

    assert.equal(session.playbackSeconds, 12.5);
    assert.equal(session.selectRecord('record-a').playbackSeconds, 12.5);
    assert.deepEqual(session.selectRecord('record-b').toSnapshot(), {
        recordId: 'record-b',
        playbackSeconds: 0,
        noiseEnabled: true,
        visualizerEnabled: false,
    });
    assert.equal(new PlaybackSession({ playbackSeconds: -5 }).playbackSeconds, 0);
});

test('PlaybackSeconds owns the finite non-negative playback position invariant', () => {
    assert.equal(new PlaybackSeconds('12.5').value, 12.5);
    assert.equal(new PlaybackSeconds(-1).value, 0);
    assert.equal(new PlaybackSeconds(Number.NaN).value, 0);
    assert.equal(new PlaybackSeconds(Number.POSITIVE_INFINITY).value, 0);
    assert.equal(Object.isFrozen(new PlaybackSeconds(1)), true);
    assert.equal(new PlaybackSession({ playbackSeconds: -1 }).playbackSeconds, 0);
});

test('PlaybackSession toggles the visualizer preference without changing other session state', () => {
    const session = new PlaybackSession({ recordId: 'record-a', playbackSeconds: 8, noiseEnabled: true, visualizerEnabled: true });
    const nextSession = session.toggleVisualizer();

    assert.equal(session.visualizerEnabled, true);
    assert.deepEqual(nextSession.toSnapshot(), {
        recordId: 'record-a',
        playbackSeconds: 8,
        noiseEnabled: true,
        visualizerEnabled: false,
    });
});

test('PlaybackTimeline constrains playback position to the known audio duration', () => {
    assert.equal(PlaybackTimeline.normalizePosition(12.5, 30), 12.5);
    assert.equal(PlaybackTimeline.normalizePosition(45, 30), 30);
    assert.equal(PlaybackTimeline.normalizePosition(-4, 30), 0);
    assert.equal(PlaybackTimeline.normalizePosition(Number.NaN, 30), 0);
    assert.equal(PlaybackTimeline.normalizePosition(45, 0), 45);
    assert.equal(PlaybackTimeline.normalizePosition(45, Number.NaN), 45);
});

test('PlaybackTimeline advances and wraps positions in forward and reverse directions', () => {
    const timeline = (direction, startPosition, elapsedSeconds, playbackRate = 1) => PlaybackTimeline.positionAfter({
        startPosition,
        elapsedSeconds,
        playbackRate,
        direction,
        duration: 30,
    });

    assert.equal(timeline('forward', 29, 2), 1);
    assert.equal(timeline('reverse', 1, 2), 29);
    assert.equal(timeline('forward', 4, 2, 0.5), 5);
    assert.equal(timeline('reverse', 4, -2), 4);
});

test('PlaybackTimeline aligns a looping secondary track with the main playback direction', () => {
    assert.equal(PlaybackTimeline.offsetForLoopingTrack(37, 8, 'forward'), 5);
    assert.equal(PlaybackTimeline.offsetForLoopingTrack(37, 8, 'reverse'), 3);
    assert.equal(PlaybackTimeline.offsetForLoopingTrack(32, 8, 'reverse'), 0);
    assert.equal(PlaybackTimeline.offsetForLoopingTrack(12, 0, 'forward'), 0);
});

test('noise state persists on success and falls back to off on failure', async () => {
    const success = createPlaybackService();
    assert.equal(await success.service.toggleNoise(), true);
    assert.deepEqual(success.repositoryCalls, [['saveNoiseEnabled', true]]);

    const failure = createPlaybackService();
    failure.audioEngine.setNoiseEnabled = async () => {
        throw new Error('audio unavailable');
    };
    await assert.rejects(failure.service.toggleNoise(), /audio unavailable/);
    assert.equal(failure.service.getState().noiseEnabled, false);
    assert.deepEqual(failure.repositoryCalls, [['saveNoiseEnabled', false]]);
});

test('playback service activates browser audio through its application boundary', async () => {
    const { service, engineCalls } = createPlaybackService();
    await service.activateAudio();
    assert.deepEqual(engineCalls, [['unlock']]);
});

test('playback service exposes autoplay recovery through its audio boundary', async () => {
    const { service, audioEngine } = createPlaybackService();
    audioEngine.isAutoplayAllowed = async () => false;

    assert.equal(await service.isAutoplayAllowed(), false);
});

test('playback service normalizes seek position using the current audio duration', () => {
    const { service } = createPlaybackService();
    assert.equal(service.normalizePlaybackPosition(140), 120);
    assert.equal(service.normalizePlaybackPosition(-1), 0);
});

test('splash keeps start, unlock, and retry behavior through PlaybackService', async () => {
    let activations = 0;
    let shownCount = 0;
    const fixture = createSplashFixture({
        activateAudio: async () => activations++,
        onPlayerScreenShown: () => shownCount++,
    });
    fixture.controller.initialize();
    const splashScreen = fixture.elements.get('#splashScreen');
    const startButton = fixture.elements.get('#splashStartButton');
    const splashStatus = fixture.elements.get('#splashStatus');

    assert.equal(fixture.elements.get('header').attributes.has('inert'), true);
    assert.equal(fixture.elements.get('main').attributes.has('inert'), true);
    await fixture.controller.startApplication();
    assert.equal(activations, 1);
    assert.equal(shownCount, 1);
    assert.equal(splashScreen.hidden, true);
    assert.equal(startButton.disabled, false);
    assert.equal(fixture.elements.get('header').attributes.has('inert'), false);
    assert.equal(fixture.documentRef.body.classList.values.has('is-splash-visible'), false);

    const retry = createSplashFixture({
        activateAudio: async () => {
            throw new Error('audio unavailable');
        },
    });
    retry.controller.initialize();
    await retry.controller.startApplication();
    assert.equal(retry.elements.get('#splashStatus').textContent, 'Tap to try again.');
    assert.equal(retry.elements.get('#splashStartButton').disabled, false);
    assert.equal(retry.elements.get('#splashScreen').hidden, false);
});

test('record JSON repository keeps no-store fetching and hydrates domain records', async () => {
    let request;
    const repository = new RecordJsonRepository('/records.json', {
        fetchImpl: async (...args) => {
            request = args;
            return {
                ok: true,
                json: async () => [{
                    id: 'record-a',
                    title: 'Artist / Track',
                    color: '#112233',
                    audioUrl: 'assets/mp3/a.mp3',
                    imageUrl: 'assets/img/a.jpg',
                }],
            };
        },
    });

    const records = await repository.findAll();
    assert.deepEqual(request, ['/records.json', { cache: 'no-store' }]);
    assert.equal(records.length, 1);
    assert.equal(records[0] instanceof Record, true);
    assert.equal(records[0].artist, 'Artist');
    assert.equal(records[0].trackTitle, 'Track');
    assert.equal(Object.isFrozen(records[0]), true);
});

test('Record rejects blank or non-string required values and keeps title parsing', () => {
    const validRecord = {
        id: 'record-a',
        title: 'Artist / Track / Remix',
        color: '#112233',
        audioUrl: 'assets/mp3/a.mp3',
        imageUrl: 'assets/img/a.jpg',
    };
    const record = new Record(validRecord);

    assert.equal(record.artist, 'Artist');
    assert.equal(record.trackTitle, 'Track / Remix');
    for (const field of Object.keys(validRecord)) {
        assert.throws(() => new Record({ ...validRecord, [field]: '   ' }), /レコード定義が不正/);
        assert.throws(() => new Record({ ...validRecord, [field]: 1 }), /レコード定義が不正/);
    }
});

test('record JSON repository retains the browser global receiver when invoking fetch', async () => {
    let receiver;
    const repository = new RecordJsonRepository('/records.json', {
        fetchImpl: function () {
            receiver = this;
            return Promise.resolve({ ok: true, json: async () => [] });
        },
    });
    await repository.findAll();
    assert.equal(receiver, globalThis);
});

test('record JSON repository rejects HTTP errors and invalid document shapes', async () => {
    const httpFailure = new RecordJsonRepository('/records.json', {
        fetchImpl: async () => ({ ok: false, status: 503 }),
    });
    await assert.rejects(httpFailure.findAll(), /503/);

    const shapeFailure = new RecordJsonRepository('/records.json', {
        fetchImpl: async () => ({ ok: true, json: async () => ({ records: [] }) }),
    });
    await assert.rejects(shapeFailure.findAll(), /形式が不正/);
});

test('RecordCatalog requires unique record IDs and preserves lookup behavior', () => {
    const recordA = new Record({ id: 'record-a', title: 'Artist / Track A', color: '#111111', audioUrl: 'a.mp3', imageUrl: 'a.jpg' });
    const recordB = new Record({ id: 'record-b', title: 'Artist / Track B', color: '#222222', audioUrl: 'b.mp3', imageUrl: 'b.jpg' });
    const catalog = new RecordCatalog([recordA, recordB]);
    const shippedRecords = JSON.parse(readFileSync(join(projectRoot, 'assets/data/records.json'), 'utf8')).map((item) => new Record(item));

    assert.equal(catalog.indexOfId('record-b'), 1);
    assert.equal(catalog.indexOfId('unknown'), 0);
    assert.throws(() => new RecordCatalog([recordA, recordA]), /重複したID/);
    assert.throws(() => new RecordCatalog([recordA, { id: 'record-c' }]), /不正な要素/);
    assert.throws(() => new RecordCatalog([recordA, null]), /不正な要素/);
    assert.throws(() => new RecordCatalog([recordA, , recordB]), /不正な要素/);
    assert.equal(new RecordCatalog(shippedRecords).all().length, shippedRecords.length);
});

test('record catalog application service keeps the domain aggregate behind its query boundary', async () => {
    const recordA = new Record({ id: 'record-a', title: 'Artist / Track A', color: '#111111', audioUrl: 'a.mp3', imageUrl: 'a.jpg' });
    const recordB = new Record({ id: 'record-b', title: 'Artist / Track B', color: '#222222', audioUrl: 'b.mp3', imageUrl: 'b.jpg' });
    let loadCount = 0;
    const service = new RecordCatalogService({
        findAll: async () => {
            loadCount += 1;
            return [recordA, recordB];
        },
    });

    assert.throws(() => service.getRecordAt(0), /読み込まれていません/);
    assert.equal('recordCatalog' in service, false);
    assert.equal('requireCatalog' in service, false);
    const records = await service.load();

    assert.equal(loadCount, 1);
    assert.deepEqual(records, [recordA, recordB]);
    assert.equal(service.indexOfRecordId('record-b'), 1);
    assert.equal(service.indexOfRecordId('unknown'), 0);
    assert.equal(service.getRecordAt(1), recordB);
    assert.throws(() => service.getRecordAt(2), /レコードが見つかりません/);
});

test('record selection domain rule wraps between both ends independently on consecutive gestures', () => {
    const service = new RecordSelectionService();

    const lastIndex = service.wrapTargetIndex(0, 3, 'right');
    const firstIndex = service.wrapTargetIndex(lastIndex, 3, 'left');

    assert.equal(lastIndex, 2);
    assert.equal(firstIndex, 0);
    assert.equal(RecordSelectionPolicy.wrapTargetIndex(0, 3, 'left'), null);
    assert.equal(RecordSelectionPolicy.wrapTargetIndex(1, 3, 'right'), null);
    assert.equal(RecordSelectionPolicy.wrapTargetIndex(0, 1, 'right'), null);
    assert.equal(RecordSelectionPolicy.wrapTargetIndex(-1, 3, 'right'), null);
});

test('RecordSelection keeps focus and selected record separate and normalizes focus within the catalog', () => {
    const selection = new RecordSelection(3, 2);

    assert.deepEqual(selection.focus(-4), { selectedIndex: 2, focusedIndex: 0 });
    assert.deepEqual(selection.focus(3.8), { selectedIndex: 2, focusedIndex: 2 });
    assert.deepEqual(selection.wrap('left'), { selectedIndex: 2, focusedIndex: 0 });
    assert.deepEqual(selection.select(99), { selectedIndex: 2, focusedIndex: 2 });
    assert.equal(RecordSelectionPolicy.normalizeIndex(Number.NaN, 3), 0);
    assert.equal(RecordSelectionPolicy.normalizeIndex(0, 0), null);
    assert.throws(() => new RecordSelection(0), /1件以上/);
});

test('record picker accepts the opposite edge swipe immediately after wrapping', () => {
    const controller = Object.create(RecordPickerController.prototype);
    const wrappedIndices = [];
    controller.records = [{}, {}, {}];
    controller.recordSelectionService = new RecordSelectionService();
    controller.recordSelectionService.initialize(3, 0);
    controller.wrapPickerToRecord = (index) => {
        wrappedIndices.push(index);
        controller.recordSelectionService.focus(index);
    };

    controller.handlePickerTouchStart({ touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    const rightMove = { cancelable: true, touches: [{ identifier: 1, clientX: 20, clientY: 10 }], preventDefault() { this.defaultPrevented = true; } };
    controller.handlePickerTouchMove(rightMove);
    controller.handlePickerTouchEnd({ type: 'touchend', changedTouches: [{ identifier: 1, clientX: 70 }] });
    controller.handlePickerTouchStart({ touches: [{ identifier: 2, clientX: 70, clientY: 10 }] });
    const leftMove = { cancelable: true, touches: [{ identifier: 2, clientX: 60, clientY: 10 }], preventDefault() { this.defaultPrevented = true; } };
    controller.handlePickerTouchMove(leftMove);
    controller.handlePickerTouchEnd({ type: 'touchend', changedTouches: [{ identifier: 2, clientX: 10 }] });

    assert.equal(rightMove.defaultPrevented, true);
    assert.equal(leftMove.defaultPrevented, true);
    assert.deepEqual(wrappedIndices, [2, 0]);
    assert.equal(controller.focusedRecordIndex, 0);
});

test('record picker leaves an interior horizontal swipe to native scrolling', () => {
    const controller = Object.create(RecordPickerController.prototype);
    controller.records = [{}, {}, {}];
    controller.recordSelectionService = new RecordSelectionService();
    controller.recordSelectionService.initialize(3, 1);
    controller.handlePickerTouchStart({ touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    const move = { cancelable: true, touches: [{ identifier: 1, clientX: 20, clientY: 10 }], preventDefault() { this.defaultPrevented = true; } };

    controller.handlePickerTouchMove(move);

    assert.equal(move.defaultPrevented, undefined);
});

test('hero text reveal pauses while the picker overlays the player and resumes on return', () => {
    const controller = Object.create(TextRevealController.prototype);
    const splashTitle = {};
    const hero = {};
    const splashScreen = { hidden: false };
    const playerPanel = { hidden: false };
    const pickerPanel = { hidden: true };
    const revealed = [];
    let intervalCallback;
    let intervalMs;
    let intervalId = 0;
    let intervalStarts = 0;
    let visibilityListener;
    const clearedIntervals = [];
    controller.splashScreen = splashScreen;
    controller.splashTitle = splashTitle;
    controller.hero = hero;
    controller.pickerPanel = pickerPanel;
    controller.document = {
        hidden: false,
        addEventListener(type, listener) {
            if (type === 'visibilitychange') visibilityListener = listener;
        },
    };
    controller.window = {
        setInterval(callback, delay) {
            intervalCallback = callback;
            intervalMs = delay;
            intervalStarts += 1;
            intervalId += 1;
            return intervalId;
        },
        clearInterval(id) { clearedIntervals.push(id); },
    };
    controller.heroRevealInterval = null;
    controller.reveal = (element) => revealed.push(element);
    hero.closest = () => playerPanel;

    controller.initialize();
    assert.deepEqual(revealed, [splashTitle]);
    splashScreen.hidden = true;
    controller.onPlayerScreenShown();
    intervalCallback();
    controller.document.hidden = true;
    intervalCallback();
    controller.document.hidden = false;
    pickerPanel.hidden = false;
    visibilityListener();
    assert.equal(intervalStarts, 1);
    assert.equal(clearedIntervals.length, 1);
    pickerPanel.hidden = true;
    visibilityListener();
    playerPanel.hidden = true;
    intervalCallback();

    assert.equal(intervalMs, 10_000);
    assert.equal(intervalStarts, 2);
    assert.deepEqual(revealed, [splashTitle, hero, hero, hero]);
    assert.deepEqual(clearedIntervals, [1, 2]);
});

test('Web Audio engine loads and reverses audio through its injected fetch boundary', async () => {
    let receiver;
    let request;
    const sourceBuffer = {
        numberOfChannels: 1,
        length: 3,
        sampleRate: 44100,
        duration: 3 / 44100,
        getChannelData: () => Float32Array.from([0.1, 0.2, 0.3]),
    };
    const context = {
        decodeAudioData: async (data) => {
            assert.equal(data, audioData);
            return sourceBuffer;
        },
        createBuffer: (channels, length, sampleRate) => {
            assert.deepEqual([channels, length, sampleRate], [1, 3, 44100]);
            const channel = new Float32Array(length);
            return { getChannelData: () => channel };
        },
    };
    const audioData = new ArrayBuffer(3);
    const engine = new WebAudioEngine({
        fetchImpl: function (...args) {
            receiver = this;
            request = args;
            return Promise.resolve({
                ok: true,
                headers: { get: () => null },
                body: null,
                arrayBuffer: async () => audioData,
            });
        },
    });
    engine.audioSourceUrl = '/audio/record.mp3';
    engine.initializeAudioContext = () => context;

    const result = await engine.loadAudioBuffer();

    assert.equal(result, sourceBuffer);
    assert.equal(receiver, globalThis);
    assert.equal(request[0], '/audio/record.mp3');
    assert.equal(request[1].signal instanceof AbortSignal, true);
    assert.deepEqual([...engine.reversedAudioBuffer.getChannelData()], [...Float32Array.from([0.3, 0.2, 0.1])]);
    assert.equal(engine.audioBufferCache.has('/audio/record.mp3'), true);
});

test('Web Audio engine normalizes direction with the domain rule', () => {
    const engine = new WebAudioEngine({ fetchImpl: async () => {} });

    engine.setDirection('reverse');
    assert.equal(engine.direction, 'reverse');
    engine.setDirection('invalid');
    assert.equal(engine.direction, 'forward');
});

test('Web Audio engine detects denied autoplay and resumes when policy checks are unavailable', async () => {
    let deniedPolicyResumeCount = 0;
    const deniedEngine = new WebAudioEngine({
        fetchImpl: async () => {},
        navigatorRef: { getAutoplayPolicy: () => 'disallowed' },
    });
    deniedEngine.audioUnlocked = true;
    deniedEngine.audioContext = {
        state: 'suspended',
        resume: async () => { deniedPolicyResumeCount++; },
    };
    assert.equal(await deniedEngine.isAutoplayAllowed(), false);
    assert.equal(deniedPolicyResumeCount, 0);

    const fallbackEngine = new WebAudioEngine({ fetchImpl: async () => {}, navigatorRef: {} });
    fallbackEngine.audioUnlocked = true;
    fallbackEngine.audioContext = {
        state: 'suspended',
        resume: async function resume() { this.state = 'running'; },
    };
    assert.equal(await fallbackEngine.isAutoplayAllowed(), true);

    const deniedFallbackEngine = new WebAudioEngine({ fetchImpl: async () => {}, navigatorRef: {} });
    deniedFallbackEngine.audioUnlocked = true;
    deniedFallbackEngine.audioContext = {
        state: 'suspended',
        resume: async () => { throw new Error('NotAllowedError'); },
    };
    assert.equal(await deniedFallbackEngine.isAutoplayAllowed(), false);

    const pendingFallbackEngine = new WebAudioEngine({ fetchImpl: async () => {}, navigatorRef: {} });
    pendingFallbackEngine.audioUnlocked = true;
    pendingFallbackEngine.audioContext = { state: 'suspended', resume: () => new Promise(() => {}) };
    assert.equal(await pendingFallbackEngine.isAutoplayAllowed(), false);
});

test('playback cookie repository preserves fallback, normalization, and encoded writes', () => {
    const documentRef = createCookieDocument({
        'groove-record-index': 'record%20002',
        'groove-record-playback-position': '-3',
        'groove-record-noise-enabled': 'true',
        'groove-record-visualizer-enabled': 'false',
    });
    const repository = new PlaybackStateRepository({ documentRef });
    assert.deepEqual(repository.load(), {
        recordId: 'record 002',
        playbackSeconds: 0,
        noiseEnabled: true,
        visualizerEnabled: false,
    });

    repository.saveRecordId('record 003');
    repository.savePlaybackSeconds(4.75);
    repository.saveNoiseEnabled(false);
    repository.saveVisualizerEnabled(true);
    assert.deepEqual(repository.load(), {
        recordId: 'record 003',
        playbackSeconds: 4.75,
        noiseEnabled: false,
        visualizerEnabled: true,
    });
    assert.match(documentRef.cookie, /groove-record-index=record%20003/);

    repository.savePlaybackSeconds(-3);
    assert.equal(repository.load().playbackSeconds, 0);
});

test('browser interaction controller preserves page restoration reload behavior', () => {
    const fixture = createBrowserInteractionFixture();
    fixture.windowListeners.get('pageshow')({ persisted: false });
    assert.equal(fixture.reloadCount, 0);

    fixture.windowListeners.get('pageshow')({ persisted: true });
    assert.equal(fixture.reloadCount, 1);

    fixture.documentRef.wasDiscarded = true;
    fixture.windowListeners.get('pageshow')({ persisted: false });
    assert.equal(fixture.reloadCount, 2);
});

test('browser interaction controller reloads the visible player when autoplay becomes unavailable', async () => {
    let permissionChecks = 0;
    const fixture = createBrowserInteractionFixture({
        playbackService: { isAutoplayAllowed: async () => { permissionChecks++; return false; } },
    });
    const visibilityChange = fixture.documentListeners.get('visibilitychange').listener;

    fixture.documentRef.hidden = true;
    await visibilityChange();
    fixture.documentRef.hidden = false;
    await visibilityChange();

    assert.equal(permissionChecks, 1);
    assert.equal(fixture.reloadCount, 1);
});

test('browser interaction controller checks autoplay on both screens and preserves available permission', async () => {
    let permissionChecks = 0;
    const pickerFixture = createBrowserInteractionFixture({
        playbackService: { isAutoplayAllowed: async () => { permissionChecks++; return false; } },
        playerHidden: true,
        pickerHidden: false,
    });
    await pickerFixture.windowListeners.get('focus')();
    assert.equal(permissionChecks, 1);
    assert.equal(pickerFixture.reloadCount, 1);

    const playerFixture = createBrowserInteractionFixture({
        playbackService: { isAutoplayAllowed: async () => true },
    });
    const playerVisibilityChange = playerFixture.documentListeners.get('visibilitychange').listener;
    playerFixture.documentRef.hidden = true;
    await playerVisibilityChange();
    playerFixture.documentRef.hidden = false;
    await playerVisibilityChange();
    assert.equal(playerFixture.reloadCount, 0);
});

test('browser interaction controller checks autoplay when changing between player and picker screens', async () => {
    let permissionChecks = 0;
    const fixture = createBrowserInteractionFixture({
        playbackService: { isAutoplayAllowed: async () => { permissionChecks++; return false; } },
    });

    fixture.playerPanel.hidden = true;
    fixture.pickerPanel.hidden = false;
    fixture.notifyScreenChanged();
    await Promise.resolve();

    assert.equal(permissionChecks, 1);
    assert.equal(fixture.reloadCount, 1);
});

test('browser interaction controller suppresses edge history swipes and top pull-to-refresh only', () => {
    const fixture = createBrowserInteractionFixture();
    const touchStart = fixture.documentListeners.get('touchstart').listener;
    const touchMove = fixture.documentListeners.get('touchmove').listener;
    assert.deepEqual(fixture.documentListeners.get('touchstart').options, { passive: true });
    assert.deepEqual(fixture.documentListeners.get('touchmove').options, { passive: false });

    touchStart({ touches: [{ clientX: 10, clientY: 100 }] });
    const backSwipe = createCancelableEvent({ touches: [{ clientX: 70, clientY: 101 }] });
    touchMove(backSwipe);
    assert.equal(backSwipe.wasPrevented(), true);

    touchStart({ touches: [{ clientX: 390, clientY: 100 }] });
    const forwardSwipe = createCancelableEvent({ touches: [{ clientX: 330, clientY: 101 }] });
    touchMove(forwardSwipe);
    assert.equal(forwardSwipe.wasPrevented(), true);

    touchStart({ touches: [{ clientX: 200, clientY: 10 }] });
    const pullToRefresh = createCancelableEvent({ touches: [{ clientX: 201, clientY: 70 }] });
    fixture.windowRef.scrollY = 0;
    touchMove(pullToRefresh);
    assert.equal(pullToRefresh.wasPrevented(), true);

    touchStart({ touches: [{ clientX: 200, clientY: 10 }] });
    const scrolledPage = createCancelableEvent({ touches: [{ clientX: 201, clientY: 70 }] });
    fixture.windowRef.scrollY = 20;
    touchMove(scrolledPage);
    assert.equal(scrolledPage.wasPrevented(), false);

    touchStart({ touches: [{ clientX: 200, clientY: 100 }] });
    const middleSwipe = createCancelableEvent({ touches: [{ clientX: 260, clientY: 101 }] });
    touchMove(middleSwipe);
    assert.equal(middleSwipe.wasPrevented(), false);

    touchStart({ touches: [{ clientX: 10, clientY: 100 }, { clientX: 20, clientY: 100 }] });
    const multiTouchMove = createCancelableEvent({ touches: [{ clientX: 70, clientY: 101 }, { clientX: 80, clientY: 101 }] });
    touchMove(multiTouchMove);
    assert.equal(multiTouchMove.wasPrevented(), false);
});

test('browser interaction controller suppresses element context menus and all drag starts', () => {
    const fixture = createBrowserInteractionFixture();
    const contextMenu = fixture.documentListeners.get('contextmenu').listener;
    const dragStart = fixture.documentListeners.get('dragstart').listener;
    const elementMenu = createCancelableEvent({ target: new fixture.FakeElement() });
    const nonElementMenu = createCancelableEvent({ target: {} });
    const drag = createCancelableEvent({ target: {} });

    contextMenu(elementMenu);
    contextMenu(nonElementMenu);
    dragStart(drag);
    assert.equal(elementMenu.wasPrevented(), true);
    assert.equal(nonElementMenu.wasPrevented(), false);
    assert.equal(drag.wasPrevented(), true);
});

test('dependencies point inward and browser controllers do not import domain or infrastructure', () => {
    const collectFiles = (directory) =>
        readdirSync(join(projectRoot, directory), { withFileTypes: true }).flatMap((entry) => {
            const relativePath = join(directory, entry.name);
            return entry.isDirectory() ? collectFiles(relativePath) : [relativePath];
        });
    const assertNoForbiddenImports = (files, pattern, description) => {
        for (const file of files) {
            const source = readFileSync(join(projectRoot, file), 'utf8');
            assert.doesNotMatch(source, pattern, `${file} must not depend on ${description}`);
        }
    };

    assertNoForbiddenImports(collectFiles('src/domain'), /from\s+['"][^'"]*\/(?:application|infrastructure|presentation)\//, 'outer layers');
    assertNoForbiddenImports(collectFiles('src/application'), /from\s+['"][^'"]*\/(?:infrastructure|presentation)\//, 'outer layers');
    assertNoForbiddenImports(collectFiles('src/presentation'), /from\s+['"][^'"]*\/(?:domain|infrastructure)\//, 'domain or infrastructure');
    const pickerController = readFileSync(join(projectRoot, 'src/presentation/record-picker-controller.js'), 'utf8');
    assert.doesNotMatch(pickerController, /this\.catalog\.(?:all|at|indexOfId)\(/, 'Presentation must query the catalog through its application service');
    const playerSection = readFileSync(join(projectRoot, 'src/components/sections/PlayerSection.jsx'), 'utf8');
    const pickerSection = readFileSync(join(projectRoot, 'src/components/sections/PickerSection.jsx'), 'utf8');
    assert.match(playerSection, /id='hero' className='hero' aria-labelledby='pageTitle'/);
    assert.match(playerSection, /id='playerPanel' className='player' role='region' aria-label='レコードプレーヤー'/);
    assert.match(pickerSection, /id='pickerPanel' className='picker-panel' role='region' aria-label='レコードを変更'/);
    const compositionRoot = readFileSync(join(projectRoot, 'src/composition-root.js'), 'utf8');
    assert.match(compositionRoot, /new BrowserInteractionController\(\{/);
    assert.match(compositionRoot, /playbackService,/);
    assert.match(compositionRoot, /playerPanel: document\.querySelector\('#playerPanel'\)/);
    assert.match(compositionRoot, /pickerPanel: document\.querySelector\('#pickerPanel'\)/);
    assert.doesNotMatch(compositionRoot, /document\.addEventListener\(|window\.addEventListener\(/);
    const splashController = readFileSync(join(projectRoot, 'src/presentation/splash-controller.js'), 'utf8');
    assert.match(splashController, /playbackService\.activateAudio\(\)/);
    assert.doesNotMatch(splashController, /audioEngine|infrastructure/);
});
