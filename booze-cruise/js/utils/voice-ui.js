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
            this._cancelled = false;
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
                    <div class="voice-hint">Say something like<br><strong>"Coke for Matt and Gina"</strong><br><span class="voice-subhint">Pause when finished, or tap Done</span></div>
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
            this._cancelled = false;

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
            // Show an initializing state until the engine confirms the mic
            // is actually live (via onAudioStart). For Web Speech this fixes
            // the "I tapped the button but nothing's happening" feeling.
            // For Vosk it also covers the model-deserialize delay.
            statusEl.textContent = 'Initializing…';
            el.classList.add('voice-initializing');

            this.engine = engine;

            engine.onAudioStart && engine.onAudioStart(() => {
                if (this._cancelled) return;
                statusEl.textContent = 'Listening…';
                el.classList.remove('voice-initializing');
                el.classList.add('voice-listening');
            });

            engine.onPartialResult((text) => {
                if (this._cancelled) return;
                transcriptEl.textContent = text;
            });
            engine.onFinalResult((text, alternatives) => {
                // If the user cancelled, the engine's stop() may still
                // deliver an accumulated final — drop it.
                if (this._cancelled) return;
                transcriptEl.textContent = text;
                this._finalReceived = true;
                statusEl.textContent = 'Got it';
                this._hide();
                this._callbacks.onResult && this._callbacks.onResult(text, alternatives || [text]);
            });
            engine.onError((err) => {
                if (this._cancelled) return;
                this._hide();
                this._callbacks.onError && this._callbacks.onError(err);
            });
            engine.onEnd(() => {
                // The engine ended without firing a final result and without
                // an explicit cancel — treat as a soft cancel.
                if (this._cancelled) return;
                if (!this._finalReceived) {
                    this._hide();
                    this._callbacks.onCancel && this._callbacks.onCancel();
                }
            });

            engine.start();
        }

        _stop() {
            // User tapped "Done" — show a brief "Processing…" state so they
            // can see we've heard them and aren't still recording, then ask
            // the engine to finalize. The final result will arrive via
            // onFinalResult or onEnd shortly.
            if (this.engine) {
                const statusEl = document.querySelector('#' + OVERLAY_ID + ' .voice-status');
                if (statusEl) statusEl.textContent = 'Processing…';
                this.engine.stop();
            }
        }

        _cancel() {
            // Mark cancelled BEFORE stopping so the engine's stop() doesn't
            // route a final transcript through onFinalResult to the caller.
            this._cancelled = true;
            this._finalReceived = true;
            if (this.engine) this.engine.stop();
            this._hide();
            this._callbacks && this._callbacks.onCancel && this._callbacks.onCancel();
        }

        _hide() {
            const el = document.getElementById(OVERLAY_ID);
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('voice-initializing', 'voice-listening');
            }
            this.engine = null;
        }
    }

    global.VoiceOverlay = VoiceOverlay;
})(typeof window !== 'undefined' ? window : globalThis);
