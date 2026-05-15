// Voice engine abstraction. Today we only ship the Web Speech API
// implementation; a Vosk WASM engine for offline use will be added later
// without changing the calling code.
//
// Usage:
//   const manager = new VoiceManager();
//   const engine = manager.bestAvailableEngine();
//   if (!engine) { /* show error */ }
//   engine.start();
//   engine.onPartialResult(text => { ... });
//   engine.onFinalResult(text => { ... });
//   engine.onError(err => { ... });
//   engine.onEnd(() => { ... });
//   engine.stop();

(function (global) {
    'use strict';

    // --- Base ------------------------------------------------------------

    class VoiceEngine {
        constructor(name) {
            this.name = name;
            this._partialCb = null;
            this._finalCb = null;
            this._errorCb = null;
            this._endCb = null;
            this._audioStartCb = null;
        }
        onPartialResult(cb) { this._partialCb = cb; }
        onFinalResult(cb) { this._finalCb = cb; }
        onError(cb) { this._errorCb = cb; }
        onEnd(cb) { this._endCb = cb; }
        // Fires when the microphone is actually hot and the engine is ready
        // to accept speech. UI uses this to switch from "Initializing…" to
        // "Listening…" so the user knows when to start speaking.
        onAudioStart(cb) { this._audioStartCb = cb; }
        isAvailable() { return false; }
        start() { throw new Error('not implemented'); }
        stop() { throw new Error('not implemented'); }
    }

    // --- Web Speech API engine ------------------------------------------

    // How long of a silence pause before we treat the user as "done speaking"
    // and gracefully stop the engine. The native engine's auto-stop fires
    // much faster than this and frequently cut users off mid-phrase.
    const WEB_SPEECH_SILENCE_MS = 1800;

    class WebSpeechEngine extends VoiceEngine {
        constructor() {
            super('web-speech');
            const Ctor = global.SpeechRecognition || global.webkitSpeechRecognition;
            this._supported = !!Ctor;
            this._ctor = Ctor;
            this._recog = null;
            this._stopping = false;
        }

        isSupported() { return this._supported; }

        // Web Speech API is server-backed in Chrome/Edge — it needs internet.
        // navigator.onLine isn't perfect (it returns true on a captive
        // portal) but it's the best signal we have without burning the mic.
        isAvailable() {
            return this._supported && (typeof navigator === 'undefined' || navigator.onLine !== false);
        }

        start(options) {
            options = options || {};
            // In push-to-talk mode we don't auto-stop on silence — the
            // caller (UI) decides when to stop via release.
            const disableAutoStop = !!options.disableAutoStop;
            if (!this._supported) {
                this._errorCb && this._errorCb({
                    code: 'unsupported',
                    message: 'Voice input is not supported in this browser.'
                });
                return;
            }
            if (!this.isAvailable()) {
                this._errorCb && this._errorCb({
                    code: 'offline',
                    message: 'Voice input requires internet. Enable offline voice in Settings.'
                });
                return;
            }

            const recog = new this._ctor();
            recog.lang = 'en-US';
            recog.interimResults = true;
            recog.maxAlternatives = 5;
            recog.continuous = true;

            this._accumulatedFinal = '';
            this._accumulatedAlternatives = [];
            this._silenceTimer = null;
            const resetSilenceTimer = () => {
                if (disableAutoStop) return; // push-to-talk: only release stops
                if (this._stopping) return;
                if (this._silenceTimer) clearTimeout(this._silenceTimer);
                this._silenceTimer = setTimeout(() => {
                    if (this._recog && !this._stopping) {
                        this._stopping = true;
                        try { this._recog.stop(); } catch (e) { /* ignored */ }
                    }
                }, WEB_SPEECH_SILENCE_MS);
            };

            // Fired by the engine when it begins capturing audio. Use this
            // (not onstart) so the UI flips to "Listening…" only after the
            // mic is genuinely hot.
            recog.onaudiostart = () => {
                this._audioStartCb && this._audioStartCb();
            };

            recog.onresult = (event) => {
                // Ignore results that arrive after we've decided to stop —
                // they can otherwise re-arm the silence timer or pollute
                // the accumulated transcript with post-stop noise.
                if (this._stopping) return;
                let interim = '';
                let newFinal = '';
                let newAlternatives = [];
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const r = event.results[i];
                    if (r.isFinal) {
                        newFinal += r[0].transcript;
                        for (let j = 0; j < r.length; j++) {
                            newAlternatives.push(r[j].transcript);
                        }
                    } else {
                        interim += r[0].transcript;
                    }
                }
                if (newFinal) {
                    this._accumulatedFinal = (this._accumulatedFinal + ' ' + newFinal).trim();
                    if (this._accumulatedAlternatives.length === 0) {
                        this._accumulatedAlternatives = newAlternatives.slice();
                    } else {
                        const merged = [];
                        for (const acc of this._accumulatedAlternatives) {
                            for (const alt of newAlternatives) {
                                merged.push((acc + ' ' + alt).trim());
                            }
                        }
                        this._accumulatedAlternatives = merged.slice(0, 8);
                    }
                }

                // Render the rolling transcript live.
                const liveText = (this._accumulatedFinal + ' ' + interim).trim();
                if (liveText && this._partialCb) this._partialCb(liveText);

                // Any sound (interim or final) is evidence the user is
                // still speaking — reset the silence timer.
                if (interim || newFinal) resetSilenceTimer();
            };

            recog.onerror = (event) => {
                // Translate the engine's error codes into something the UI
                // can act on without inspecting browser-specific strings.
                const map = {
                    'not-allowed': { code: 'permission-denied', message: 'Microphone access was denied.' },
                    'service-not-allowed': { code: 'permission-denied', message: 'Microphone access was denied.' },
                    'no-speech': { code: 'no-speech', message: "Didn't hear anything — try again." },
                    'audio-capture': { code: 'no-mic', message: 'No microphone found.' },
                    'network': { code: 'offline', message: 'Network error — voice needs internet.' },
                    'aborted': { code: 'aborted', message: 'Voice input cancelled.' }
                };
                const err = map[event.error] || { code: event.error || 'error', message: 'Voice input failed.' };
                this._errorCb && this._errorCb(err);
            };

            recog.onend = () => {
                if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }
                // Deliver the accumulated final transcript before signaling
                // end-of-session, so the UI can route it through the parser.
                if (this._accumulatedFinal && this._finalCb) {
                    this._finalCb(this._accumulatedFinal, this._accumulatedAlternatives.length ? this._accumulatedAlternatives : [this._accumulatedFinal]);
                }
                this._recog = null;
                this._stopping = false;
                this._accumulatedFinal = '';
                this._accumulatedAlternatives = [];
                this._endCb && this._endCb();
            };

            this._recog = recog;
            try {
                recog.start();
            } catch (e) {
                // Calling start() while a previous session is still tearing down
                // throws InvalidStateError. Surface as a benign error.
                this._errorCb && this._errorCb({
                    code: 'busy',
                    message: 'Voice input is busy — try again in a moment.'
                });
            }
        }

        stop() {
            if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }
            if (this._recog && !this._stopping) {
                this._stopping = true;
                try { this._recog.stop(); } catch (e) { /* already stopped */ }
            }
        }
    }

    // --- Vosk (offline) engine -------------------------------------------

    // Module-level URLs. Library + small English model are both opt-in
    // downloads cached in the Cache API. If alternative hosts are needed
    // (CORS issues, mirroring), change these constants — they're the only
    // places those URLs appear.
    const VOSK_LIB_URL = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.5/dist/vosk.js';
    const VOSK_MODEL_URL = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';
    const VOSK_CACHE = 'cruise-voice-v1';
    const VOSK_LOCALSTORAGE_KEY = 'voice-offline-enabled';
    // How long of silence before auto-finalize for Vosk. Vosk emits
    // 'result' events on internal silence detection, which can trigger
    // even on short mid-phrase pauses; we use our own longer timer
    // measured from the *last* recognition activity.
    const VOSK_SILENCE_MS = 1800;

    // Helper: are the library + model both present in the dedicated cache?
    async function voskAssetsCached() {
        if (!('caches' in global)) return false;
        try {
            const cache = await caches.open(VOSK_CACHE);
            const [lib, model] = await Promise.all([
                cache.match(VOSK_LIB_URL),
                cache.match(VOSK_MODEL_URL)
            ]);
            return !!(lib && model);
        } catch (e) {
            return false;
        }
    }

    // Helper: load the Vosk library (a UMD script that defines window.Vosk).
    // We pull it from the Cache API to keep it offline-capable. If it's not
    // cached yet, we fall back to a network fetch (which itself will be
    // populated into cache by the install flow).
    async function ensureVoskLibLoaded() {
        if (global.Vosk) return global.Vosk;
        const cache = await caches.open(VOSK_CACHE);
        let response = await cache.match(VOSK_LIB_URL);
        if (!response) {
            response = await fetch(VOSK_LIB_URL);
            if (response && response.ok) {
                cache.put(VOSK_LIB_URL, response.clone()).catch(() => {});
            }
        }
        if (!response || !response.ok) {
            throw new Error('Failed to load Vosk library');
        }
        const code = await response.text();
        // Execute the UMD code in the global scope. Using a script tag with
        // a Blob URL is safer than eval and lets the library install its
        // globals normally.
        await new Promise((resolve, reject) => {
            const blobUrl = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
            const script = document.createElement('script');
            script.src = blobUrl;
            script.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
            script.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Vosk script failed to load')); };
            document.head.appendChild(script);
        });
        if (!global.Vosk) throw new Error('Vosk global not exposed by library');
        return global.Vosk;
    }

    async function getVoskModelUrl() {
        const cache = await caches.open(VOSK_CACHE);
        const response = await cache.match(VOSK_MODEL_URL);
        if (!response) throw new Error('Vosk model is not downloaded');
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }

    class VoskEngine extends VoiceEngine {
        constructor() {
            super('vosk');
            this._model = null;
            this._recognizer = null;
            this._audioContext = null;
            this._mediaStream = null;
            this._sourceNode = null;
            this._processorNode = null;
        }

        isAvailable() {
            // We use a synchronous flag set during init() so VoiceManager's
            // bestAvailableEngine() can be sync. The real cache check is
            // performed by init().
            return this._available === true;
        }

        // Called once at startup; updates _available based on opt-in flag
        // and cache contents.
        async init() {
            const optIn = localStorage.getItem(VOSK_LOCALSTORAGE_KEY) === 'true';
            if (!optIn) { this._available = false; return; }
            this._available = await voskAssetsCached();
            // If offline is enabled, prewarm the model in the background so
            // the first 🎤 tap doesn't pay the 1-5 second model-deserialize
            // cost. Failures here are silent — start() retries with full
            // error reporting if the prewarm didn't complete.
            if (this._available) {
                this._prewarm().catch(() => {});
            }
        }

        async _prewarm() {
            if (this._model) return;
            const Vosk = await ensureVoskLibLoaded();
            const modelUrl = await getVoskModelUrl();
            this._model = await Vosk.createModel(modelUrl);
        }

        async start(options) {
            options = options || {};
            const disableAutoStop = !!options.disableAutoStop;
            try {
                if (!global.navigator || !navigator.mediaDevices) {
                    throw new Error('Microphone access is not supported in this browser.');
                }

                const Vosk = await ensureVoskLibLoaded();
                if (!this._model) {
                    const modelUrl = await getVoskModelUrl();
                    this._model = await Vosk.createModel(modelUrl);
                }

                this._mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000 },
                    video: false
                });

                this._audioContext = new (global.AudioContext || global.webkitAudioContext)();
                const actualSampleRate = this._audioContext.sampleRate;

                this._accumulatedFinal = '';
                this._silenceTimer = null;
                this._stopped = false;
                const resetSilence = () => {
                    if (disableAutoStop) return; // push-to-talk
                    if (this._stopped) return;
                    if (this._silenceTimer) clearTimeout(this._silenceTimer);
                    this._silenceTimer = setTimeout(() => this.stop(), VOSK_SILENCE_MS);
                };

                this._recognizer = new this._model.KaldiRecognizer(actualSampleRate);
                this._recognizer.on('result', (message) => {
                    if (this._stopped) return;
                    const text = (message && message.result && message.result.text) || '';
                    if (text) {
                        this._accumulatedFinal = (this._accumulatedFinal + ' ' + text).trim();
                        if (this._partialCb) this._partialCb(this._accumulatedFinal);
                        resetSilence();
                    }
                });
                this._recognizer.on('partialresult', (message) => {
                    if (this._stopped) return;
                    const partial = (message && message.result && message.result.partial) || '';
                    if (partial) {
                        const liveText = (this._accumulatedFinal + ' ' + partial).trim();
                        if (this._partialCb) this._partialCb(liveText);
                        resetSilence();
                    }
                });

                this._processorNode = this._audioContext.createScriptProcessor(4096, 1, 1);
                this._processorNode.onaudioprocess = (event) => {
                    try { this._recognizer.acceptWaveform(event.inputBuffer); }
                    catch (e) { /* recognizer may have been torn down */ }
                };
                this._sourceNode = this._audioContext.createMediaStreamSource(this._mediaStream);
                this._sourceNode.connect(this._processorNode);
                this._processorNode.connect(this._audioContext.destination);

                // Audio nodes are now wired up — mic is genuinely live.
                this._audioStartCb && this._audioStartCb();
            } catch (e) {
                // Translate common failures into the same error codes the
                // Web Speech engine uses so the UI logic is uniform.
                const code = (e && e.name === 'NotAllowedError') ? 'permission-denied'
                          : (e && e.name === 'NotFoundError') ? 'no-mic'
                          : 'error';
                this._errorCb && this._errorCb({
                    code,
                    message: (e && e.message) || 'Offline voice failed to start.'
                });
            }
        }

        stop() {
            if (this._stopped) return;
            this._stopped = true;
            if (this._silenceTimer) { clearTimeout(this._silenceTimer); this._silenceTimer = null; }
            const finalText = (this._accumulatedFinal || '').trim();
            try { if (this._processorNode) this._processorNode.disconnect(); } catch (e) {}
            try { if (this._sourceNode) this._sourceNode.disconnect(); } catch (e) {}
            try { if (this._mediaStream) this._mediaStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            try { if (this._audioContext && this._audioContext.state !== 'closed') this._audioContext.close(); } catch (e) {}
            try { if (this._recognizer && this._recognizer.remove) this._recognizer.remove(); } catch (e) {}
            this._processorNode = this._sourceNode = this._mediaStream = this._audioContext = this._recognizer = null;
            this._accumulatedFinal = '';
            if (finalText && this._finalCb) this._finalCb(finalText, [finalText]);
            this._endCb && this._endCb();
        }
    }

    // --- Vosk installer (used by Settings) -------------------------------

    // Downloads the library + model into the dedicated cache. Progress is
    // reported via the optional onProgress callback as a fraction in [0,1].
    async function installVoskAssets({ onProgress, signal } = {}) {
        if (!('caches' in global)) throw new Error('Cache API not supported');
        const cache = await caches.open(VOSK_CACHE);

        // Download model with progress streaming. Library is tiny so we just
        // fetch and store it without progress reporting.
        async function downloadWithProgress(url, weight, baseProgress) {
            const existing = await cache.match(url);
            if (existing) {
                onProgress && onProgress(baseProgress + weight);
                return;
            }
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error('Download failed for ' + url + ' (HTTP ' + response.status + ')');

            const total = parseInt(response.headers.get('content-length') || '0', 10);
            if (!total || !response.body) {
                // No length header or stream — store as-is, just bump to end.
                await cache.put(url, response.clone());
                onProgress && onProgress(baseProgress + weight);
                return;
            }

            const reader = response.body.getReader();
            const chunks = [];
            let received = 0;
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (onProgress) {
                    onProgress(baseProgress + weight * (received / total));
                }
            }
            const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
            const cached = new Response(blob, {
                status: 200,
                headers: { 'Content-Type': blob.type, 'Content-Length': String(blob.size) }
            });
            await cache.put(url, cached);
        }

        // Weights chosen so the bar moves visibly; model dominates the time.
        await downloadWithProgress(VOSK_LIB_URL, 0.05, 0);
        await downloadWithProgress(VOSK_MODEL_URL, 0.95, 0.05);
        onProgress && onProgress(1);
        localStorage.setItem(VOSK_LOCALSTORAGE_KEY, 'true');
    }

    async function uninstallVoskAssets() {
        if ('caches' in global) {
            try { await caches.delete(VOSK_CACHE); } catch (e) {}
        }
        localStorage.removeItem(VOSK_LOCALSTORAGE_KEY);
    }

    // --- Manager ---------------------------------------------------------

    class VoiceManager {
        constructor() {
            this.webSpeech = new WebSpeechEngine();
            this.vosk = new VoskEngine();
            this._voskReady = this.vosk.init();
        }

        // Promise that resolves once async init (Vosk cache check) is done.
        // Callers that want offline detection to work reliably should await
        // this before consulting bestAvailableEngine.
        async whenReady() {
            try { await this._voskReady; } catch (e) { /* ignored */ }
        }

        // Pick the engine to use right now.
        // Priority: Vosk (if user enabled and model loaded) > Web Speech (online).
        bestAvailableEngine() {
            if (this.vosk && this.vosk.isAvailable()) return this.vosk;
            if (this.webSpeech.isAvailable()) return this.webSpeech;
            return null;
        }

        // Why is no engine available? Used to render a useful error.
        unavailableReason() {
            const hasOffline = this.vosk && this.vosk.isAvailable();
            const onLine = !(typeof navigator !== 'undefined' && navigator.onLine === false);
            if (!this.webSpeech.isSupported() && !hasOffline) {
                return 'Voice input is not supported in this browser.';
            }
            if (!onLine && !hasOffline) {
                return 'You appear to be offline. Enable offline voice in Settings to use voice without internet.';
            }
            return 'Voice input is unavailable right now.';
        }
    }

    global.VoiceEngine = VoiceEngine;
    global.WebSpeechEngine = WebSpeechEngine;
    global.VoskEngine = VoskEngine;
    global.VoiceManager = VoiceManager;
    global.VoskInstaller = {
        install: installVoskAssets,
        uninstall: uninstallVoskAssets,
        isInstalled: voskAssetsCached,
        urls: { lib: VOSK_LIB_URL, model: VOSK_MODEL_URL },
        cacheName: VOSK_CACHE,
        localStorageKey: VOSK_LOCALSTORAGE_KEY
    };
})(typeof window !== 'undefined' ? window : globalThis);
