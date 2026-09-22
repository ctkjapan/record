import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { PlaybackService } from '../assets/js/application/playback-service.js';
import { PlaybackPolicy } from '../assets/js/domain/playback-policy.js';
import { PlaybackDirection } from '../assets/js/domain/playback-direction.js';
import { PlaybackSession } from '../assets/js/domain/playback-session.js';
import { PlaybackSeconds } from '../assets/js/domain/playback-seconds.js';
import { RotationSpeedPercent } from '../assets/js/domain/rotation-speed-percent.js';
import { Record } from '../assets/js/domain/record.js';
import { RecordCatalog } from '../assets/js/domain/record-catalog.js';
import { BrowserInteractionController } from '../assets/js/controller/browser-interaction-controller.js';
import { SplashController } from '../assets/js/controller/splash-controller.js';
import { PlaybackStateRepository } from '../assets/js/infrastructure/playback-state-repository.js';
import { RecordJsonRepository } from '../assets/js/infrastructure/record-json-repository.js';
import { WebAudioEngine } from '../assets/js/infrastructure/web-audio-engine.js';

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

function createBrowserInteractionFixture({ innerWidth = 400, scrollY = 0, wasDiscarded = false } = {}) {
    const windowListeners = new Map();
    const documentListeners = new Map();
    let reloadCount = 0;
    const windowRef = {
        innerWidth,
        scrollY,
        location: { reload: () => reloadCount++ },
        addEventListener: (type, listener) => windowListeners.set(type, listener),
    };
    const documentRef = {
        wasDiscarded,
        addEventListener: (type, listener, options) => documentListeners.set(type, { listener, options }),
    };
    class FakeElement {}
    const controller = new BrowserInteractionController({ windowRef, documentRef, ElementClass: FakeElement });
    controller.initialize();
    return {
        controller,
        windowRef,
        documentRef,
        FakeElement,
        windowListeners,
        documentListeners,
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

function createSplashFixture({ activateAudio = async () => {} } = {}) {
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
    const controller = new SplashController({ playbackService: { activateAudio }, documentRef });
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
        playbackSeconds: -5,
        noiseEnabled: true,
        visualizerEnabled: false,
    });

    assert.equal(session.playbackSeconds, 0);
    assert.deepEqual(session.selectRecord('record-b').toSnapshot(), {
        recordId: 'record-b',
        playbackSeconds: 0,
        noiseEnabled: true,
        visualizerEnabled: false,
    });
});

test('PlaybackSeconds owns the finite non-negative playback position invariant', () => {
    assert.equal(new PlaybackSeconds('12.5').value, 12.5);
    assert.equal(new PlaybackSeconds(-1).value, 0);
    assert.equal(new PlaybackSeconds(Number.NaN).value, 0);
    assert.equal(new PlaybackSeconds(Number.POSITIVE_INFINITY).value, 0);
    assert.equal(Object.isFrozen(new PlaybackSeconds(1)), true);
    assert.equal(new PlaybackSession({ playbackSeconds: -1 }).playbackSeconds, 0);
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

test('splash keeps start, unlock, and retry behavior through PlaybackService', async () => {
    let activations = 0;
    const fixture = createSplashFixture({ activateAudio: async () => activations++ });
    fixture.controller.initialize();
    const splashScreen = fixture.elements.get('#splashScreen');
    const startButton = fixture.elements.get('#splashStartButton');
    const splashStatus = fixture.elements.get('#splashStatus');

    assert.equal(fixture.elements.get('header').attributes.has('inert'), true);
    assert.equal(fixture.elements.get('main').attributes.has('inert'), true);
    await fixture.controller.startApplication();
    assert.equal(activations, 1);
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

    assertNoForbiddenImports(collectFiles('assets/js/domain'), /from\s+['"][^'"]*\/(?:application|infrastructure|controller)\//, 'outer layers');
    assertNoForbiddenImports(collectFiles('assets/js/application'), /from\s+['"][^'"]*\/(?:infrastructure|controller)\//, 'outer layers');
    assertNoForbiddenImports(collectFiles('assets/js/controller'), /from\s+['"][^'"]*\/(?:domain|infrastructure)\//, 'domain or infrastructure');
    const compositionRoot = readFileSync(join(projectRoot, 'assets/js/main.js'), 'utf8');
    assert.match(compositionRoot, /new BrowserInteractionController\(\)/);
    assert.doesNotMatch(compositionRoot, /document\.addEventListener\(|window\.addEventListener\(/);
    const splashController = readFileSync(join(projectRoot, 'assets/js/controller/splash-controller.js'), 'utf8');
    assert.match(splashController, /playbackService\.activateAudio\(\)/);
    assert.doesNotMatch(splashController, /audioEngine|infrastructure/);
});
