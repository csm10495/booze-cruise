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
            this._pushToTalk = false;
            // In PTT mode, track whether the user has already released so
            // we can stop the engine as soon as it becomes ready (handles
            // the case where the user lets go before the mic is hot).
            this._releaseRequested = false;
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
                    <div class="voice-hint" id="voice-hint">Say something like<br><strong>"Coke for Matt and Gina"</strong><br><span class="voice-subhint">Pause when finished, or tap Done</span></div>
                    <div class="voice-actions" id="voice-actions">
                        <button type="button" class="btn btn-outline" id="voice-cancel">Cancel</button>
                        <button type="button" class="btn" id="voice-stop">Done</button>
                    </div>
                </div>
            `;
            document.body.appendChild(el);

            el.querySelector('#voice-cancel').addEventListener('click', () => this._cancel());
            el.querySelector('#voice-stop').addEventListener('click', () => this._stop());
            el.addEventListener('click', (e) => {
                // Tapping the dim background only cancels in tap-to-talk mode
                // — in PTT mode the overlay is dismissed by releasing the
                // physical button, so a stray background tap would be confusing.
                if (e.target === el && !this._pushToTalk) this._cancel();
            });

            return el;
        }

        async show(callbacks, options) {
            this._callbacks = callbacks || {};
            this._finalReceived = false;
            this._cancelled = false;
            this._releaseRequested = false;
            this._pushToTalk = !!(options && options.pushToTalk);

            // Ensure async manager init (Vosk cache probe) has completed
            // before we decide which engine to use.
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
            const hintEl = el.querySelector('#voice-hint');
            const actionsEl = el.querySelector('#voice-actions');
            transcriptEl.textContent = '';
            statusEl.textContent = 'Initializing…';
            el.classList.add('voice-initializing');

            // Build the example phrase. Caller can pass examplePhrase to
            // pin a real cruise drink/person; otherwise fall back to a
            // generic placeholder.
            const exampleRaw = (options && options.examplePhrase) || 'Coke for Matt and Gina';
            const example = String(exampleRaw).replace(/[&<>"']/g, (c) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));

            // PTT visual customization: hint says "Release the button to
            // submit", action buttons are hidden.
            if (this._pushToTalk) {
                el.classList.add('voice-ptt');
                if (hintEl) hintEl.innerHTML =
                    'Say something like<br><strong>"' + example + '"</strong><br>' +
                    '<span class="voice-subhint">Release the button to submit</span>';
                if (actionsEl) actionsEl.style.display = 'none';
            } else {
                el.classList.remove('voice-ptt');
                if (hintEl) hintEl.innerHTML =
                    'Say something like<br><strong>"' + example + '"</strong><br>' +
                    '<span class="voice-subhint">Pause when finished, or tap Done</span>';
                if (actionsEl) actionsEl.style.display = '';
            }

            this.engine = engine;

            engine.onAudioStart && engine.onAudioStart(() => {
                if (this._cancelled) return;
                statusEl.textContent = 'Listening…';
                el.classList.remove('voice-initializing');
                el.classList.add('voice-listening');
                // If the user already released while we were warming up,
                // honor that now.
                if (this._releaseRequested) this._stop();
            });

            engine.onPartialResult((text) => {
                if (this._cancelled) return;
                transcriptEl.textContent = text;
            });
            engine.onFinalResult((text, alternatives) => {
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
                if (this._cancelled) return;
                if (!this._finalReceived) {
                    this._hide();
                    this._callbacks.onCancel && this._callbacks.onCancel();
                }
            });

            engine.start({ disableAutoStop: this._pushToTalk });
        }

        // Public API for push-to-talk: caller invokes this on button release.
        release() {
            if (!this._pushToTalk) return;
            this._releaseRequested = true;
            // If audio hasn't started yet, the audiostart handler will pick
            // up the request and call _stop() when ready. Otherwise stop now.
            if (this.engine) this._stop();
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
            // Mark cancelled BEFORE aborting so any racing callbacks bail out.
            this._cancelled = true;
            this._finalReceived = true;
            // abort() (vs stop()) tears down the engine immediately and
            // discards any in-flight transcript. Without this the recognizer
            // could keep "listening" briefly after the user hit Cancel as
            // it gracefully drained.
            if (this.engine) {
                if (typeof this.engine.abort === 'function') this.engine.abort();
                else this.engine.stop();
            }
            this._hide();
            this._callbacks && this._callbacks.onCancel && this._callbacks.onCancel();
        }

        _hide() {
            const el = document.getElementById(OVERLAY_ID);
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('voice-initializing', 'voice-listening', 'voice-ptt');
            }
            this.engine = null;
        }
    }

    global.VoiceOverlay = VoiceOverlay;
})(typeof window !== 'undefined' ? window : globalThis);
