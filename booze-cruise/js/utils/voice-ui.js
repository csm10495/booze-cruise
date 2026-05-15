// Listening overlay UI for voice input.
//
// Usage:
//   const overlay = new VoiceOverlay();
//   overlay.show({
//       onResult: (finalTranscript) => { ... },
//       onCancel: () => { ... },
//       onError: (err) => { ... }
//   });
//
// The overlay owns its engine instance for the duration of a session and
// hides itself automatically on final result, error, or cancel.

(function (global) {
    'use strict';

    const OVERLAY_ID = 'voice-overlay';

    class VoiceOverlay {
        constructor(voiceManager) {
            this.manager = voiceManager || new global.VoiceManager();
            this.engine = null;
            this._callbacks = null;
            this._finalReceived = false;
        }

        _ensureDom() {
            let el = document.getElementById(OVERLAY_ID);
            if (el) return el;

            el = document.createElement('div');
            el.id = OVERLAY_ID;
            el.className = 'voice-overlay hidden';
            el.innerHTML = `
                <div class="voice-overlay-content">
                    <div class="voice-mic" aria-hidden="true">🎤</div>
                    <div class="voice-status">Listening…</div>
                    <div class="voice-transcript" id="voice-transcript"></div>
                    <div class="voice-hint">Say something like<br><strong>"Coke for Matt and Gina"</strong></div>
                    <div class="voice-actions">
                        <button type="button" class="btn btn-outline" id="voice-cancel">Cancel</button>
                        <button type="button" class="btn" id="voice-stop">Done</button>
                    </div>
                </div>
            `;
            document.body.appendChild(el);

            el.querySelector('#voice-cancel').addEventListener('click', () => this._cancel());
            el.querySelector('#voice-stop').addEventListener('click', () => this._stop());
            el.addEventListener('click', (e) => {
                if (e.target === el) this._cancel();
            });

            return el;
        }

        async show(callbacks) {
            this._callbacks = callbacks || {};
            this._finalReceived = false;

            // Ensure async manager init (Vosk cache probe) has completed
            // before we decide which engine to use. Without this, offline
            // users can hit the "no engine available" path before Vosk has
            // been detected as ready.
            if (this.manager.whenReady) await this.manager.whenReady();

            const engine = this.manager.bestAvailableEngine();
            if (!engine) {
                const message = this.manager.unavailableReason();
                this._callbacks.onError && this._callbacks.onError({ code: 'unavailable', message });
                return;
            }

            const el = this._ensureDom();
            el.classList.remove('hidden');
            const transcriptEl = el.querySelector('#voice-transcript');
            const statusEl = el.querySelector('.voice-status');
            transcriptEl.textContent = '';
            statusEl.textContent = 'Listening…';

            this.engine = engine;

            engine.onPartialResult((text) => {
                transcriptEl.textContent = text;
            });
            engine.onFinalResult((text, alternatives) => {
                transcriptEl.textContent = text;
                this._finalReceived = true;
                statusEl.textContent = 'Got it';
                this._hide();
                this._callbacks.onResult && this._callbacks.onResult(text, alternatives || [text]);
            });
            engine.onError((err) => {
                this._hide();
                this._callbacks.onError && this._callbacks.onError(err);
            });
            engine.onEnd(() => {
                // The engine ended without firing a final result and without
                // an explicit cancel — treat as a soft cancel.
                if (!this._finalReceived) {
                    this._hide();
                    this._callbacks.onCancel && this._callbacks.onCancel();
                }
            });

            engine.start();
        }

        _stop() {
            // User tapped "Done" — ask the engine to finalize. The final
            // result will fire via onFinalResult or onEnd.
            if (this.engine) this.engine.stop();
        }

        _cancel() {
            this._finalReceived = true; // suppress the onEnd→onCancel double-fire
            if (this.engine) this.engine.stop();
            this._hide();
            this._callbacks && this._callbacks.onCancel && this._callbacks.onCancel();
        }

        _hide() {
            const el = document.getElementById(OVERLAY_ID);
            if (el) el.classList.add('hidden');
            this.engine = null;
        }
    }

    global.VoiceOverlay = VoiceOverlay;
})(typeof window !== 'undefined' ? window : globalThis);
