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
        }
        onPartialResult(cb) { this._partialCb = cb; }
        onFinalResult(cb) { this._finalCb = cb; }
        onError(cb) { this._errorCb = cb; }
        onEnd(cb) { this._endCb = cb; }
        isAvailable() { return false; }
        start() { throw new Error('not implemented'); }
        stop() { throw new Error('not implemented'); }
    }

    // --- Web Speech API engine ------------------------------------------

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

        start() {
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
            recog.lang = (navigator.language || 'en-US');
            recog.interimResults = true;
            recog.maxAlternatives = 1;
            recog.continuous = false;

            recog.onresult = (event) => {
                let interim = '';
                let final = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const r = event.results[i];
                    if (r.isFinal) final += r[0].transcript;
                    else interim += r[0].transcript;
                }
                if (interim && this._partialCb) this._partialCb(interim);
                if (final && this._finalCb) this._finalCb(final);
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
                this._recog = null;
                this._stopping = false;
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
            if (this._recog && !this._stopping) {
                this._stopping = true;
                try { this._recog.stop(); } catch (e) { /* already stopped */ }
            }
        }
    }

    // --- Manager ---------------------------------------------------------

    class VoiceManager {
        constructor() {
            this.webSpeech = new WebSpeechEngine();
            // VoskEngine will be wired in a later phase. For now it's null
            // and the manager falls back to Web Speech only.
            this.vosk = null;
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
            if (!this.webSpeech.isSupported() && !this.vosk) {
                return 'Voice input is not supported in this browser.';
            }
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                return 'You appear to be offline. Enable offline voice in Settings to use voice without internet.';
            }
            return 'Voice input is unavailable right now.';
        }
    }

    global.VoiceEngine = VoiceEngine;
    global.WebSpeechEngine = WebSpeechEngine;
    global.VoiceManager = VoiceManager;
})(typeof window !== 'undefined' ? window : globalThis);
