// Add Drink Component - Handles adding new drinks for people
class AddDrinkComponent {
    constructor(storage) {
        this.storage = storage;
        this.photoManager = new PhotoManager();
        this.selectedPeople = []; // Changed to array for multi-selection
        this.multiSelectMode = false; // Track if in multi-select mode
        this.selectedDrink = null;
        this.drinkPhoto = null;
        this.drinkPhotoFull = null;
        this.customDateTime = null;
    }

    async render() {
        const container = document.getElementById('add-drink-content');
        const currentCruise = window.app?.getCurrentCruise();

        if (!currentCruise) {
            container.innerHTML = '<div class="message error">No cruise selected. Please go to Settings to create a cruise.</div>';
            return;
        }

        try {
            const people = await this.storage.getPeopleForCruise(currentCruise.id);
            const drinks = await this.storage.getDrinksForCruise(currentCruise.id);

            container.innerHTML = await this.createAddDrinkHTML(currentCruise, people, drinks);
            this.setupEventListeners();
        } catch (error) {
            console.error('Error rendering add drink page:', error);
            container.innerHTML = '<div class="message error">Error loading data: ' + error.message + '</div>';
        }
    }

    async createAddDrinkHTML(cruise, people, drinks) {
        const drinkCounts = await this.calculateDrinkCounts(people);

        return `
            <div class="add-drink-container progressive-cards">
                ${this._voiceButtonHTML(people, drinks)}
                <div class="cards-container">
                    <!-- Step 1: Select Person(s) (Always visible) -->
                    <div class="progress-card ${this.selectedPeople.length > 0 ? 'completed' : 'active'}" id="card-person">
                        <div class="card-header">
                            <h3>👤 Select Person${this.selectedPeople.length > 1 ? 's' : ''}</h3>
                            ${this.selectedPeople.length > 0 ?
                                `<div class="selected-indicator">✓ ${this.selectedPeople.length} selected${this.multiSelectMode ? ' (Multi-select mode)' : ''}</div>` :
                                `<div class="help-text">Tap to select, long press for multi-select</div>`
                            }
                        </div>
                        <div class="card-content">
                            <div class="people-grid">
                                ${people.length === 0 ?
                                    '<div class="empty-state">No people added yet.</div>' :
                                    people.map(person => this.createPersonCard(person, drinkCounts[person.id] || 0)).join('')
                                }
                                <div class="add-person-card" id="add-person-btn">
                                    <div class="add-icon">➕</div>
                                    <div>Add Person</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Step 2: Select Drink (Visible after person selected) -->
                    ${this.selectedPeople.length > 0 ? `
                    <div class="progress-card ${this.selectedDrink ? 'completed' : 'active'}" id="card-drink">
                        <div class="card-header">
                            <h3>🍹 Select Drink</h3>
                            ${this.selectedDrink ? `<div class="selected-indicator">✓ ${this.selectedDrink.name}</div>` : ''}
                        </div>
                        <div class="card-content">
                            ${this.createDrinkSelectionHTML(drinks)}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Step 3: Add Photo (Visible after drink selected) -->
                    ${this.selectedDrink ? `
                    <div class="progress-card active" id="card-photo">
                        <div class="card-header">
                            <h3>📷 Add Photo (Optional)</h3>
                            ${this.drinkPhoto ? `<div class="selected-indicator">✓ Photo Added</div>` : ''}
                        </div>
                        <div class="card-content">
                            ${this.createPhotoSectionHTML()}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Step 4: Submit (Visible after drink selected) -->
                    ${this.selectedDrink ? `
                    <div class="progress-card active submit-card" id="card-submit">
                        <div class="card-header">
                            <h3>🚀 Ready to Submit</h3>
                        </div>
                        <div class="card-content">
                            ${this.createSubmitSectionHTML()}
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- Add Person Modal -->
                <div id="add-person-modal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <span class="close" id="close-person-modal">&times;</span>
                        <h3>Add New Person</h3>
                        <form id="add-person-form">
                            <div class="form-group">
                                <label for="person-name">Name *</label>
                                <input type="text" id="person-name" required>
                            </div>
                            <div class="form-group">
                                <label>Photo or Emoji</label>
                                <div class="image-upload-container">
                                    <div class="image-preview" id="person-photo-preview">📷</div>
                                    <label for="person-photo-input" class="image-upload-label">Choose Photo</label>
                                    <input type="file" accept="image/*;capture=camera" id="person-photo-input" class="image-upload-input">
                                </div>
                                <div class="emoji-selector">
                                    <label>Or choose an emoji:</label>
                                    <div class="emoji-options" id="person-emoji-options">
                                        <span class="emoji-option" data-emoji="👤">👤</span>
                                        <span class="emoji-option" data-emoji="👨">👨</span>
                                        <span class="emoji-option" data-emoji="👩">👩</span>
                                        <span class="emoji-option" data-emoji="👦">👦</span>
                                        <span class="emoji-option" data-emoji="👧">👧</span>
                                        <span class="emoji-option" data-emoji="👴">👴</span>
                                        <span class="emoji-option" data-emoji="👵">👵</span>
                                        <span class="emoji-option" data-emoji="🧑">🧑</span>
                                        <span class="emoji-option" data-emoji="👶">👶</span>
                                    </div>
                                    <div class="custom-emoji-input">
                                        <label for="person-custom-emoji">Or type any emoji:</label>
                                        <div class="emoji-input-container">
                                            <input type="text" id="person-custom-emoji" placeholder="Type or paste emoji here">
                                            <button type="button" class="btn btn-outline btn-sm" id="person-use-custom">Use</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="btn">Add Person</button>
                                <button type="button" class="btn btn-outline" id="cancel-person">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Add Drink Modal -->
                <div id="add-drink-modal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <span class="close" id="close-drink-modal">&times;</span>
                        <h3>Add New Drink</h3>
                        <form id="add-drink-form">
                            <div class="form-group">
                                <label for="drink-name">Drink Name *</label>
                                <input type="text" id="drink-name" required>
                            </div>
                            <div class="form-group">
                                <label>Photo or Emoji</label>
                                <div class="image-upload-container">
                                    <div class="image-preview" id="drink-photo-preview">🍹</div>
                                    <label for="drink-photo-input" class="image-upload-label">Choose Photo</label>
                                    <input type="file" accept="image/*;capture=camera" id="drink-photo-input" class="image-upload-input">
                                </div>
                                <div class="emoji-selector">
                                    <label>Or choose an emoji:</label>
                                    <div class="emoji-options" id="drink-emoji-options">
                                        <span class="emoji-option" data-emoji="🍹">🍹</span>
                                        <span class="emoji-option" data-emoji="🍺">🍺</span>
                                        <span class="emoji-option" data-emoji="🍻">🍻</span>
                                        <span class="emoji-option" data-emoji="🍷">🍷</span>
                                        <span class="emoji-option" data-emoji="🥂">🥂</span>
                                        <span class="emoji-option" data-emoji="🍸">🍸</span>
                                        <span class="emoji-option" data-emoji="🍾">🍾</span>
                                        <span class="emoji-option" data-emoji="🧃">🧃</span>
                                        <span class="emoji-option" data-emoji="🥤">🥤</span>
                                        <span class="emoji-option" data-emoji="☕">☕</span>
                                        <span class="emoji-option" data-emoji="🍵">🍵</span>
                                        <span class="emoji-option" data-emoji="🥛">🥛</span>
                                    </div>
                                    <div class="custom-emoji-input">
                                        <label for="drink-custom-emoji">Or type any emoji:</label>
                                        <div class="emoji-input-container">
                                            <input type="text" id="drink-custom-emoji" placeholder="Type or paste emoji here">
                                            <button type="button" class="btn btn-outline btn-sm" id="drink-use-custom">Use</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="btn">Add Drink</button>
                                <button type="button" class="btn btn-outline" id="cancel-drink">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>

            </div>
        `;
    }

    createPersonCard(person, drinkCount) {
        const isSelected = this.selectedPeople.some(p => p.id === person.id);
        return `
            <div class="person-card ${isSelected ? 'selected' : ''} ${this.multiSelectMode ? 'multi-select-mode' : ''}" data-person-id="${person.id}">
                <div class="person-photo">
                    ${person.photo ?
                        (person.photo.startsWith('data:') ?
                            `<img src="${person.photo}" alt="${person.name}">` :
                            `<span class="emoji-display">${person.photo}</span>`) :
                        '👤'
                    }
                </div>
                <div class="person-info">
                    <div class="person-name">${person.name}</div>
                    <div class="drink-count">${drinkCount} drinks</div>
                </div>
                ${isSelected ? '<div class="selection-indicator">✓</div>' : ''}
            </div>
        `;
    }

    // Voice input button — visible whenever the engine is *potentially*
    // available (i.e., the browser supports it). When the user taps it we
    // check actual availability and fall back to a clear error toast.
    _voiceButtonHTML(people, drinks) {
        const supported = typeof window.VoiceManager === 'function' &&
            (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (!supported) return '';
        // We stash the people/drinks lists already loaded by render() so the
        // voice handler doesn't have to hit storage again.
        this._voiceCtx = { people, drinks };
        return `
            <div class="voice-bar">
                <button type="button" class="btn btn-voice" id="voice-input-btn" aria-label="Hold to talk">
                    <span class="voice-btn-icon" aria-hidden="true">🎤</span>
                    <span class="voice-btn-label">Hold to Talk</span>
                </button>
                <span class="voice-bar-hint">Hold the button, say "Coke for Matt and Gina", release</span>
            </div>
        `;
    }

    _startVoicePress() {
        if (this._voiceActive) return;
        if (!window.VoiceManager || !window.VoiceOverlay || !window.VoiceParser) {
            window.showToast('Voice input is not available.', 'error');
            return;
        }
        if (!this._voiceManager) this._voiceManager = new window.VoiceManager();
        if (!this._voiceOverlay) this._voiceOverlay = new window.VoiceOverlay(this._voiceManager);

        this._voiceActive = true;
        this._voiceOverlay.show({
            onResult: (transcript, alternatives) => {
                this._voiceActive = false;
                this._applyVoiceTranscript(transcript, alternatives);
            },
            onError: (err) => {
                this._voiceActive = false;
                window.showToast(err.message || 'Voice input failed.', 'error', 4000);
            },
            onCancel: () => {
                this._voiceActive = false;
            }
        }, { pushToTalk: true });
    }

    _endVoicePress() {
        if (!this._voiceActive) return;
        if (this._voiceOverlay) this._voiceOverlay.release();
    }

    _cancelVoicePress() {
        if (!this._voiceActive) return;
        if (this._voiceOverlay && this._voiceOverlay._cancel) this._voiceOverlay._cancel();
        this._voiceActive = false;
    }

    async _applyVoiceTranscript(transcript, alternatives) {
        try {
            const ctx = this._voiceCtx || {};
            // Refresh from storage in case people/drinks were added after the
            // page was rendered (e.g., user added a drink mid-session).
            const cruise = window.app?.getCurrentCruise();
            const people = cruise ? await this.storage.getPeopleForCruise(cruise.id) : (ctx.people || []);
            const drinks = cruise ? await this.storage.getDrinksForCruise(cruise.id) : (ctx.drinks || []);

            // Try every alternative the engine returned (ordered most-likely
            // first) and use the first one that parses cleanly. This
            // dramatically improves the apparent recognition quality when
            // the engine's top guess mishears a drink/person name but a
            // lower-ranked alternative gets it right.
            const candidates = (alternatives && alternatives.length)
                ? alternatives
                : [transcript];

            let result = null;
            let firstFailure = null;
            for (const cand of candidates) {
                const r = window.VoiceParser.parseVoiceCommand(cand, { people, drinks });
                if (r.ok) { result = r; break; }
                if (!firstFailure) firstFailure = { transcript: cand, result: r };
            }

            if (!result) {
                const heard = (firstFailure && firstFailure.transcript) || transcript;
                const reason = (firstFailure && firstFailure.result && firstFailure.result.error) || "Couldn't parse that.";
                window.showToast(`Heard "${heard}" — ${reason}`, 'error', 6000);
                return;
            }

            this.selectedPeople = result.people;
            this.multiSelectMode = result.people.length > 1;
            this.selectedDrink = result.drink;
            this.drinkPhoto = null;
            this.drinkPhotoFull = null;
            await this.render();

            // Scroll to the submit card so it's obvious what to do next.
            const submitCard = document.getElementById('card-submit');
            if (submitCard && submitCard.scrollIntoView) {
                submitCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            const names = result.people.map(p => p.name).join(', ');
            window.showToast(`${result.drink.name} for ${names} — review and submit.`, 'success', 4000);
        } catch (error) {
            console.error('Voice transcript handling failed:', error);
            window.showToast('Voice input failed: ' + error.message, 'error');
        }
    }

    createDrinkSelectionHTML(drinks) {
        let html = '';

        // Always show recent drinks (from all people on this cruise)
        html += '<div class="recent-drinks">';
        html += '<h4>Recent Drinks</h4>';
        html += '<div id="recent-drinks-list">Loading...</div>';
        html += '</div>';

        // Quick Find section
        html += '<div class="quick-find">';
        html += '<h4>Quick Find</h4>';
        html += '<input type="text" id="quick-find-input" placeholder="🔍 Tap to search drinks..." class="quick-find-input">';
        html += '<div id="quick-find-results"></div>';
        html += '</div>';

        html += '<div class="all-drinks">';
        html += '<h4>All Drinks</h4>';
        html += '<div class="drinks-grid" id="drinks-grid">';

        if (drinks.length === 0) {
            html += '<div class="empty-state">No drinks added yet.</div>';
        } else {
            // Sort drinks by name
            const sortedDrinks = drinks.sort((a, b) => a.name.localeCompare(b.name));
            // Show first 5 drinks initially
            let initialDrinks = sortedDrinks.slice(0, 5);

            // Ensure the currently selected drink is always visible — without
            // this, auto-selecting a freshly-added drink whose name sorts past
            // position 5 would leave the selection invisible in the grid.
            if (this.selectedDrink && !initialDrinks.some(d => d.id === this.selectedDrink.id)) {
                const selected = sortedDrinks.find(d => d.id === this.selectedDrink.id);
                if (selected) initialDrinks = [...initialDrinks, selected];
            }

            initialDrinks.forEach(drink => {
                html += this.createDrinkCard(drink);
            });

            // Add Show All button if there are more than 5 drinks
            if (sortedDrinks.length > initialDrinks.length) {
                html += `<div class="show-all-container">
                    <button class="btn btn-outline" id="show-all-drinks">Show All (${sortedDrinks.length - initialDrinks.length} more)</button>
                </div>`;
            }
        }

        html += `
            <div class="add-drink-card" id="add-drink-btn">
                <div class="add-icon">➕</div>
                <div>Add Drink</div>
            </div>
        `;
        html += '</div></div>';

        return html;
    }

    createDrinkCard(drink) {
        return `
            <div class="drink-card ${this.selectedDrink?.id === drink.id ? 'selected' : ''}" data-drink-id="${drink.id}">
                <div class="drink-photo">
                    ${drink.photo ?
                        (drink.photo.startsWith('data:') ?
                            `<img src="${drink.photo}" alt="${drink.name}">` :
                            `<span class="emoji-display">${drink.photo}</span>`) :
                        '🍹'
                    }
                </div>
                <div class="drink-info">
                    <div class="drink-name">${drink.name}</div>
                </div>
            </div>
        `;
    }

    createPhotoSectionHTML() {
        return `
            <div class="photo-upload-section">
                <p>Add a photo of this specific drink order:</p>
                <div class="image-upload-container">
                    <div class="image-preview" id="record-photo-preview">📷</div>
                    <label for="record-photo-input" class="image-upload-label">Choose Photo</label>
                    <input type="file" accept="image/*;capture=camera" id="record-photo-input" class="image-upload-input">
                </div>
            </div>
        `;
    }

    createSubmitSectionHTML() {
        return `
            <div class="submit-section">
                <div class="order-summary">
                    <h4>Order Summary</h4>
                    <div class="summary-item person-summary">
                        <span class="summary-label">Person${this.selectedPeople.length > 1 ? 's' : ''}:</span>
                        <div class="summary-people">
                            ${this.selectedPeople.map(person => `
                                <div class="summary-person">
                                    <span class="summary-name">${person.name}</span>
                                    <span class="summary-icon">
                                        ${person.photo ?
                                            (person.photo.startsWith('data:') ?
                                                `<img src="${person.photo}" class="summary-photo" alt="${person.name}">` :
                                                `<span class="summary-emoji">${person.photo}</span>`) :
                                            `<span class="summary-emoji">👤</span>`
                                        }
                                    </span>
                                </div>
                            `).join('')}
                            ${this.selectedPeople.length > 1 ? `<div class="summary-count">${this.selectedPeople.length} people selected</div>` : ''}
                        </div>
                    </div>
                    <div class="summary-item drink-summary">
                        <span class="summary-label">Drink:</span>
                        <span class="summary-name">${this.selectedDrink?.name}</span>
                        <span class="summary-icon">
                            ${this.selectedDrink?.photo ?
                                (this.selectedDrink.photo.startsWith('data:') ?
                                    `<img src="${this.selectedDrink.photo}" class="summary-photo" alt="${this.selectedDrink.name}">` :
                                    `<span class="summary-emoji">${this.selectedDrink.photo}</span>`) :
                                `<span class="summary-emoji">🍹</span>`
                            }
                        </span>
                    </div>
                    <div class="summary-item">
                        <strong>Time:</strong>
                        <span class="custom-time" id="custom-time-display" style="cursor: pointer; text-decoration: underline;">
                            ${this.customDateTime ? this.customDateTime.toLocaleString() : new Date().toLocaleString()}
                        </span>
                    </div>
                    ${this.drinkPhoto ? '<div class="summary-item"><strong>Photo:</strong> ✅ Added</div>' : ''}
                </div>
                <button class="btn btn-primary" id="submit-drink-record">🍹 Add Drink Record</button>
            </div>
        `;
    }

    async calculateDrinkCounts(people) {
        const counts = {};

        for (const person of people) {
            const records = await this.storage.getDrinkRecordsForPerson(person.id);
            counts[person.id] = records.length;
        }

        return counts;
    }

    setupEventListeners() {
        // Person selection with long press support
        document.querySelectorAll('.person-card').forEach(card => {
            let longPressTimer;
            let isLongPress = false;

            // Simple click handler first - works for most cases
            card.addEventListener('click', () => {
                if (!isLongPress) {
                    this.selectPerson(card.dataset.personId, false);
                }
            });

            // Long press detection for multi-select
            card.addEventListener('mousedown', () => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                    this.selectPerson(card.dataset.personId, true);
                }, 500);
            });

            card.addEventListener('mouseup', () => {
                clearTimeout(longPressTimer);
                // Reset flag after a delay to allow click handler to check it
                setTimeout(() => { isLongPress = false; }, 100);
            });

            card.addEventListener('mouseleave', () => {
                clearTimeout(longPressTimer);
            });

            // Touch events for mobile
            card.addEventListener('touchstart', (e) => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                    this.selectPerson(card.dataset.personId, true);
                }, 500);
            });

            card.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
                setTimeout(() => { isLongPress = false; }, 100);
            });

            card.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            });
        });

        // Drink selection
        document.querySelectorAll('.drink-card').forEach(card => {
            card.addEventListener('click', () => this.selectDrink(card.dataset.drinkId));
        });

        // Add person/drink buttons
        const addPersonBtn = document.getElementById('add-person-btn') || document.getElementById('add-first-person');
        if (addPersonBtn) {
            addPersonBtn.addEventListener('click', () => this.showAddPersonModal());
        }

        const addDrinkBtn = document.getElementById('add-drink-btn') || document.getElementById('add-first-drink');
        if (addDrinkBtn) {
            addDrinkBtn.addEventListener('click', () => this.showAddDrinkModal());
        }

        // Voice input button — push-to-talk: press starts listening,
        // release submits the heard transcript. Pointer capture keeps the
        // release event on the button even if the user's finger slides off.
        const voiceBtn = document.getElementById('voice-input-btn');
        if (voiceBtn) {
            voiceBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                // Capture so subsequent pointer events fire on this element
                // regardless of finger/cursor position.
                try { voiceBtn.setPointerCapture(e.pointerId); } catch (_) {}
                voiceBtn.classList.add('pressed');
                this._startVoicePress();
            });
            const release = (e) => {
                if (!voiceBtn.classList.contains('pressed')) return;
                voiceBtn.classList.remove('pressed');
                try { voiceBtn.releasePointerCapture(e.pointerId); } catch (_) {}
                this._endVoicePress();
            };
            voiceBtn.addEventListener('pointerup', release);
            voiceBtn.addEventListener('pointercancel', release);
            // Keyboard accessibility: holding Space/Enter while focused
            // works as press-and-hold.
            voiceBtn.addEventListener('keydown', (e) => {
                if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault();
                    voiceBtn.classList.add('pressed');
                    this._startVoicePress();
                }
            });
            voiceBtn.addEventListener('keyup', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    if (voiceBtn.classList.contains('pressed')) {
                        voiceBtn.classList.remove('pressed');
                        this._endVoicePress();
                    }
                }
            });
            // If focus leaves while pressed, treat as release so we don't
            // strand an open mic.
            voiceBtn.addEventListener('blur', () => {
                if (voiceBtn.classList.contains('pressed')) {
                    voiceBtn.classList.remove('pressed');
                    this._endVoicePress();
                }
            });
        }

        // Modal controls
        this.setupModalEventListeners();

        // Photo upload
        this.setupPhotoUpload();

        // Submit button
        const submitBtn = document.getElementById('submit-drink-record');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitDrinkRecord());
        }

        // Setup custom time picker with event delegation
        this.setupCustomTimePickerDelegation();

        // Always load recent drinks (from all people on this cruise)
        this.loadRecentDrinks();

        // Quick Find functionality
        const quickFindInput = document.getElementById('quick-find-input');

        if (quickFindInput) {
            // Clear placeholder text when focused
            quickFindInput.addEventListener('focus', () => {
                if (quickFindInput.placeholder === '🔍 Tap to search drinks...') {
                    quickFindInput.placeholder = '';
                }
            });

            // Restore placeholder if empty and not focused
            quickFindInput.addEventListener('blur', () => {
                if (quickFindInput.value === '') {
                    quickFindInput.placeholder = '🔍 Tap to search drinks...';
                    document.getElementById('quick-find-results').innerHTML = '';
                }
            });

            // Handle input changes
            quickFindInput.addEventListener('input', (e) => {
                this.handleQuickFind(e.target.value);
            });
        }

        // Show All functionality
        const showAllBtn = document.getElementById('show-all-drinks');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => this.showAllDrinks());
        }
    }

    async selectPerson(personId, isLongPress = false) {
        try {
            if (isLongPress) {
                // Long press always enters multi-select mode
                this.multiSelectMode = true;
                await this.togglePersonSelection(personId);
            } else if (this.multiSelectMode) {
                // In multi-select mode, any tap toggles selection
                await this.togglePersonSelection(personId);
            } else {
                // Single select mode - normal behavior
                const person = await this.storage.getPerson(personId);
                this.selectedPeople = [person];
                this.multiSelectMode = false;
                this.selectedDrink = null;
                this.drinkPhoto = null;
                this.drinkPhotoFull = null;

                // Update person card to completed state
                this.updatePersonCards();
                this.updatePersonCardState();

                // Update submit section if drink is already selected
                if (this.selectedDrink) {
                    this.updateSubmitSection();
                }

                // Add drink selection card smoothly
                await this.showDrinkCard();
            }

        } catch (error) {
            console.error('Error selecting person:', error);
            window.showToast('Error selecting person: ' + error.message, 'error');
        }
    }

    updatePersonCards() {
        console.log('updatePersonCards called, selectedPeople:', this.selectedPeople.map(p => p.name));
        // Update all person cards to reflect current selection
        document.querySelectorAll('.person-card').forEach(card => {
            const personId = card.dataset.personId;
            const isSelected = this.selectedPeople.some(p => p.id === personId);

            console.log(`Card ${personId}: isSelected=${isSelected}`);

            // Update selected class
            if (isSelected) {
                card.classList.add('selected');
                console.log('Added selected class to card', personId);
            } else {
                card.classList.remove('selected');
            }

            // Update multi-select mode class
            if (this.multiSelectMode) {
                card.classList.add('multi-select-mode');
            } else {
                card.classList.remove('multi-select-mode');
            }

            // Handle checkboxes for multi-select mode
            let checkbox = card.querySelector('.person-checkbox');
            if (this.multiSelectMode) {
                if (!checkbox) {
                    checkbox = document.createElement('div');
                    checkbox.className = 'person-checkbox';
                    checkbox.dataset.personId = personId;

                    // Add click handler for checkbox
                    checkbox.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent card click from also firing
                        this.togglePersonSelection(personId);
                    });

                    card.appendChild(checkbox);
                }

                // Update checkbox state
                if (isSelected) {
                    checkbox.classList.add('checked');
                } else {
                    checkbox.classList.remove('checked');
                }
            } else if (checkbox) {
                checkbox.remove();
            }

            // Remove old selection indicator (replaced by checkboxes)
            const indicator = card.querySelector('.selection-indicator');
            if (indicator) {
                indicator.remove();
            }
        });

        // Update the card header
        const cardHeader = document.querySelector('#card-person .card-header');
        if (cardHeader) {
            const headerTitle = cardHeader.querySelector('h3');
            const selectedIndicator = cardHeader.querySelector('.selected-indicator, .help-text');

            if (headerTitle) {
                headerTitle.textContent = `👤 Select Person${this.selectedPeople.length > 1 ? 's' : ''}`;
            }

            if (selectedIndicator) {
                if (this.selectedPeople.length > 0) {
                    selectedIndicator.className = 'selected-indicator';
                    selectedIndicator.textContent = `✓ ${this.selectedPeople.length} selected${this.multiSelectMode ? ' (Multi-select mode)' : ''}`;
                } else {
                    selectedIndicator.className = 'help-text';
                    selectedIndicator.textContent = 'Tap to select, long press for multi-select';
                }
            }
        }
    }

    async togglePersonSelection(personId) {
        try {
            const person = await this.storage.getPerson(personId);
            const existingIndex = this.selectedPeople.findIndex(p => p.id === personId);

            if (existingIndex >= 0) {
                // Remove person from selection
                this.selectedPeople.splice(existingIndex, 1);
            } else {
                // Add person to selection
                this.selectedPeople.push(person);
            }

            // If no people selected, exit multi-select mode
            if (this.selectedPeople.length === 0) {
                this.multiSelectMode = false;
            }

            // Update visual display
            this.updatePersonCards();
            this.updatePersonCardState();

            // Update submit section if drink is already selected
            if (this.selectedDrink) {
                this.updateSubmitSection();
            }

            // Show drink card if at least one person selected
            if (this.selectedPeople.length > 0) {
                await this.showDrinkCard();
            }

        } catch (error) {
            console.error('Error toggling person selection:', error);
            window.showToast('Error selecting person: ' + error.message, 'error');
        }
    }

    async selectDrink(drinkId) {
        try {
            this.selectedDrink = await this.storage.getDrink(drinkId);
            this.drinkPhoto = null;

            // Update drink card to completed state
            this.updateDrinkCard();

            // Add photo and submit cards smoothly
            await this.showPhotoAndSubmitCards();

        } catch (error) {
            console.error('Error selecting drink:', error);
            window.showToast('Error selecting drink: ' + error.message, 'error');
        }
    }

    async loadRecentDrinks() {
        try {
            const currentCruise = window.app?.getCurrentCruise();
            if (!currentCruise) return;

            const records = await this.storage.getDrinkRecordsForCruise(currentCruise.id);
            const recentRecords = records
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10); // Get more records to ensure we have enough unique drinks

            const drinkIds = [...new Set(recentRecords.map(r => r.drinkId))].slice(0, 3); // Limit to 3 unique drinks
            const drinks = await Promise.all(drinkIds.map(id => this.storage.getDrink(id)));

            const recentDrinksList = document.getElementById('recent-drinks-list');
            if (recentDrinksList) {
                if (drinks.length === 0) {
                    recentDrinksList.innerHTML = '<p class="text-muted">No recent drinks</p>';
                } else {
                    recentDrinksList.innerHTML = drinks.map(drink =>
                        `<div class="recent-drink-item ${this.selectedDrink?.id === drink.id ? 'selected' : ''}" data-drink-id="${drink.id}">
                            <div class="recent-drink-icon">
                                ${drink.photo ?
                                    (drink.photo.startsWith('data:') ?
                                        `<img src="${drink.photo}" alt="${drink.name}">` :
                                        `<span class="emoji-display">${drink.photo}</span>`) :
                                    '🍹'
                                }
                            </div>
                            <div class="recent-drink-name">${drink.name}</div>
                        </div>`
                    ).join('');

                    // Add click handlers for recent drinks
                    recentDrinksList.querySelectorAll('.recent-drink-item').forEach(item => {
                        item.addEventListener('click', () => this.selectDrink(item.dataset.drinkId));
                    });
                }
            }
        } catch (error) {
            console.error('Error loading recent drinks:', error);
        }
    }

    updateStepStates() {
        // Update card states for the progressive card system
        const cards = ['card-person', 'card-drink', 'card-photo', 'card-submit'];

        cards.forEach((cardId, index) => {
            const card = document.getElementById(cardId);
            if (!card) return;

            card.classList.remove('active', 'completed');

            if (index === 0) {
                // Person card
                card.classList.add(this.selectedPerson ? 'completed' : 'active');
            } else if (index === 1) {
                // Drink card
                card.classList.add(this.selectedDrink ? 'completed' : 'active');
            } else if (index === 2) {
                // Photo card (always active when visible)
                card.classList.add('active');
            } else if (index === 3) {
                // Submit card (always active when visible)
                card.classList.add('active');
            }
        });
    }

    setupModalEventListeners() {
        // Add person modal
        const addPersonModal = document.getElementById('add-person-modal');
        const closePersonModal = document.getElementById('close-person-modal');
        const cancelPerson = document.getElementById('cancel-person');
        const addPersonForm = document.getElementById('add-person-form');

        if (closePersonModal) {
            closePersonModal.addEventListener('click', () => this.hideAddPersonModal());
        }
        if (cancelPerson) {
            cancelPerson.addEventListener('click', () => this.hideAddPersonModal());
        }
        if (addPersonForm) {
            addPersonForm.addEventListener('submit', (e) => this.handleAddPerson(e));
        }

        // Add drink modal
        const addDrinkModal = document.getElementById('add-drink-modal');
        const closeDrinkModal = document.getElementById('close-drink-modal');
        const cancelDrink = document.getElementById('cancel-drink');
        const addDrinkForm = document.getElementById('add-drink-form');

        if (closeDrinkModal) {
            closeDrinkModal.addEventListener('click', () => this.hideAddDrinkModal());
        }
        if (cancelDrink) {
            cancelDrink.addEventListener('click', () => this.hideAddDrinkModal());
        }
        if (addDrinkForm) {
            addDrinkForm.addEventListener('submit', (e) => this.handleAddDrink(e));
        }

        // Close modals when clicking outside
        [addPersonModal, addDrinkModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                    }
                });
            }
        });
    }

    setupPhotoUpload() {
        // Person photo upload
        this.photoManager.setupPhotoUpload('person-photo-input', 'person-photo-preview', (photoData) => {
            this.personPhoto = photoData.thumbnail; // Store thumbnail for display
            this.personPhotoFull = photoData.fullSize; // Store full-size for modal
            this.personEmoji = null; // Clear emoji when photo is selected
            this.clearEmojiSelection('person-emoji-options');
        });

        // Drink photo upload
        this.photoManager.setupPhotoUpload('drink-photo-input', 'drink-photo-preview', (photoData) => {
            this.drinkPhotoForNew = photoData.thumbnail; // Store thumbnail for display
            this.drinkPhotoForNewFull = photoData.fullSize; // Store full-size for modal
            this.drinkEmoji = null; // Clear emoji when photo is selected
            this.clearEmojiSelection('drink-emoji-options');
        });

        // Record photo upload
        this.photoManager.setupPhotoUpload('record-photo-input', 'record-photo-preview', (photoData) => {
            this.drinkPhoto = photoData.thumbnail; // Store thumbnail for display
            this.drinkPhotoFull = photoData.fullSize; // Store full-size for modal
            this.updateSubmitSection();
        });

        // Setup emoji selectors
        this.setupEmojiSelectors();
    }

    setupEmojiSelectors() {
        // Person emoji selector
        const personEmojiOptions = document.getElementById('person-emoji-options');
        if (personEmojiOptions) {
            personEmojiOptions.addEventListener('click', (e) => {
                if (e.target.classList.contains('emoji-option')) {
                    this.selectPersonEmoji(e.target.dataset.emoji, personEmojiOptions);
                }
            });
        }

        // Drink emoji selector
        const drinkEmojiOptions = document.getElementById('drink-emoji-options');
        if (drinkEmojiOptions) {
            drinkEmojiOptions.addEventListener('click', (e) => {
                if (e.target.classList.contains('emoji-option')) {
                    this.selectDrinkEmoji(e.target.dataset.emoji, drinkEmojiOptions);
                }
            });
        }

        // Custom emoji inputs
        this.setupCustomEmojiInputs();
    }

    setupCustomEmojiInputs() {
        // Person custom emoji
        const personCustomInput = document.getElementById('person-custom-emoji');
        const personUseCustomBtn = document.getElementById('person-use-custom');
        if (personCustomInput) {
            personCustomInput.addEventListener('input', (e) => {
                let val = e.target.value;
                let grapheme = val;
                if (window.Intl && Intl.Segmenter) {
                    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
                    const graphemes = Array.from(segmenter.segment(val), seg => seg.segment);
                    grapheme = graphemes[0] || '';
                } else {
                    grapheme = [...val][0] || '';
                }
                if (val !== grapheme) {
                    e.target.value = grapheme;
                }
            });
        }

        if (personUseCustomBtn) {
            personUseCustomBtn.addEventListener('click', () => {
                const customEmoji = personCustomInput.value.trim();
                if (customEmoji) {
                    console.log('Custom emoji raw:', customEmoji, 'length:', customEmoji.length);
                    let grapheme = customEmoji;
                    if (window.Intl && Intl.Segmenter) {
                        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
                        const graphemes = Array.from(segmenter.segment(customEmoji), seg => seg.segment);
                        grapheme = graphemes[0];
                        console.log('Grapheme clusters:', graphemes);
                    } else {
                        grapheme = [...customEmoji][0];
                        console.log('Intl.Segmenter not available, using spread:', grapheme);
                    }
                    this.selectPersonEmoji(grapheme, document.getElementById('person-emoji-options'));
                    personCustomInput.value = '';

                    if (customEmoji.length > 1) {
                        window.showToast('Only single glyph allowed - used first grapheme', 'info');
                    }
                }
            });
        }

        if (personCustomInput) {
            personCustomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const customEmoji = personCustomInput.value.trim();
                    if (customEmoji) {
                        console.log('Custom emoji raw:', customEmoji, 'length:', customEmoji.length);
                        let grapheme = customEmoji;
                        if (window.Intl && Intl.Segmenter) {
                            const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
                            const graphemes = Array.from(segmenter.segment(customEmoji), seg => seg.segment);
                            grapheme = graphemes[0];
                            console.log('Grapheme clusters:', graphemes);
                        } else {
                            grapheme = [...customEmoji][0];
                            console.log('Intl.Segmenter not available, using spread:', grapheme);
                        }
                        this.selectPersonEmoji(grapheme, document.getElementById('person-emoji-options'));
                        personCustomInput.value = '';

                        if (customEmoji.length > 1) {
                            window.showToast('Only single glyph allowed - used first grapheme', 'info');
                        }
                    }
                }
            });
        }

        // Drink custom emoji
        const drinkCustomInput = document.getElementById('drink-custom-emoji');
        const drinkUseCustomBtn = document.getElementById('drink-use-custom');
        if (drinkCustomInput) {
            drinkCustomInput.addEventListener('input', (e) => {
                let val = e.target.value;
                let grapheme = val;
                if (window.Intl && Intl.Segmenter) {
                    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
                    const graphemes = Array.from(segmenter.segment(val), seg => seg.segment);
                    grapheme = graphemes[0] || '';
                } else {
                    grapheme = [...val][0] || '';
                }
                if (val !== grapheme) {
                    e.target.value = grapheme;
                }
            });
        }

        if (drinkUseCustomBtn) {
            drinkUseCustomBtn.addEventListener('click', () => {
                const customEmoji = drinkCustomInput.value.trim();
                if (customEmoji) {
                    console.log('Custom emoji raw:', customEmoji, 'length:', customEmoji.length);
                    let grapheme = customEmoji;
                    if (window.Intl && Intl.Segmenter) {
                        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
                        const graphemes = Array.from(segmenter.segment(customEmoji), seg => seg.segment);
                        grapheme = graphemes[0];
                        console.log('Grapheme clusters:', graphemes);
                    } else {
                        grapheme = [...customEmoji][0];
                        console.log('Intl.Segmenter not available, using spread:', grapheme);
                    }
                    this.selectDrinkEmoji(grapheme, document.getElementById('drink-emoji-options'));
                    drinkCustomInput.value = '';

                    if (customEmoji.length > 1) {
                        window.showToast('Only single glyph allowed - used first grapheme', 'info');
                    }
                }
            });
        }

        if (drinkCustomInput) {
            drinkCustomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const customEmoji = drinkCustomInput.value.trim();
                    if (customEmoji) {
                        console.log('Custom emoji raw:', customEmoji, 'length:', customEmoji.length);
                        let grapheme = customEmoji;
                        if (window.Intl && Intl.Segmenter) {
                            const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
                            const graphemes = Array.from(segmenter.segment(customEmoji), seg => seg.segment);
                            grapheme = graphemes[0];
                            console.log('Grapheme clusters:', graphemes);
                        } else {
                            grapheme = [...customEmoji][0];
                            console.log('Intl.Segmenter not available, using spread:', grapheme);
                        }
                        this.selectDrinkEmoji(grapheme, document.getElementById('drink-emoji-options'));
                        drinkCustomInput.value = '';

                        if (customEmoji.length > 1) {
                            window.showToast('Only single glyph allowed - used first grapheme', 'info');
                        }
                    }
                }
            });
        }
    }

    selectPersonEmoji(emoji, container) {
        this.personEmoji = emoji;
        this.personPhoto = null; // Clear photo when emoji is selected

        // Update preview
        const preview = document.getElementById('person-photo-preview');
        if (preview) {
            preview.innerHTML = emoji;
            preview.style.fontSize = '32px';
        }

        // Update selection UI
        this.updateEmojiSelection(container, emoji);

        // Clear photo input
        const photoInput = document.getElementById('person-photo-input');
        if (photoInput) {
            photoInput.value = '';
        }
    }

    selectDrinkEmoji(emoji, container) {
        this.drinkEmoji = emoji;
        this.drinkPhotoForNew = null; // Clear photo when emoji is selected

        // Update preview
        const preview = document.getElementById('drink-photo-preview');
        if (preview) {
            preview.innerHTML = emoji;
            preview.style.fontSize = '32px';
        }

        // Update selection UI
        this.updateEmojiSelection(container, emoji);

        // Clear photo input
        const photoInput = document.getElementById('drink-photo-input');
        if (photoInput) {
            photoInput.value = '';
        }
    }

    updateEmojiSelection(container, selectedEmoji) {
        // Clear all selections
        container.querySelectorAll('.emoji-option').forEach(option => {
            option.classList.remove('selected');
        });

        // Mark selected emoji
        const selectedOption = container.querySelector(`[data-emoji="${selectedEmoji}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }

    clearEmojiSelection(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.querySelectorAll('.emoji-option').forEach(option => {
                option.classList.remove('selected');
            });
        }
    }

    updateSubmitSection() {
        const submitSection = document.getElementById('submit-section');
        if (submitSection && this.selectedDrink) {
            submitSection.innerHTML = this.createSubmitSectionHTML();
            const submitBtn = document.getElementById('submit-drink-record');
            if (submitBtn) {
                submitBtn.addEventListener('click', () => this.submitDrinkRecord());
            }
        }
    }

    showAddPersonModal() {
        const modal = document.getElementById('add-person-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('person-name').focus();
        }
    }

    hideAddPersonModal() {
        const modal = document.getElementById('add-person-modal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('add-person-form').reset();
            document.getElementById('person-photo-preview').innerHTML = '📷';
            this.personPhoto = null;
        }
    }

    showAddDrinkModal() {
        const modal = document.getElementById('add-drink-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('drink-name').focus();
        }
    }

    hideAddDrinkModal() {
        const modal = document.getElementById('add-drink-modal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('add-drink-form').reset();
            document.getElementById('drink-photo-preview').innerHTML = '🍹';
            this.drinkPhotoForNew = null;
        }
    }

    async handleAddPerson(e) {
        e.preventDefault();

        // Prevent multiple submissions
        if (this.submittingPerson) {
            return;
        }
        this.submittingPerson = true;

        try {
            const name = document.getElementById('person-name').value.trim();
            if (!name) {
                window.showToast('Please enter a name', 'error');
                this.submittingPerson = false;
                return;
            }

            // Disable submit button
            const submitBtn = document.querySelector('#add-person-form button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Adding...';
            }

            const person = {
                id: this.generateId(),
                name: name,
                photo: this.personPhoto || this.personEmoji || null,
                photoFull: this.personPhotoFull || null,
                cruiseId: window.app.getCurrentCruise().id
            };

            await this.storage.savePerson(person);
            this.hideAddPersonModal();
            window.showToast('Person added successfully!', 'success');

            // Refresh the page
            await this.render();
        } catch (error) {
            console.error('Error adding person:', error);
            window.showToast('Error adding person: ' + error.message, 'error');
        } finally {
            this.submittingPerson = false;
        }
    }

    async handleAddDrink(e) {
        e.preventDefault();

        // Prevent multiple submissions
        if (this.submittingDrink) {
            return;
        }
        this.submittingDrink = true;

        try {
            const name = document.getElementById('drink-name').value.trim();

            if (!name) {
                window.showToast('Please enter a drink name', 'error');
                this.submittingDrink = false;
                return;
            }

            // Check for duplicate names (case-insensitive, trimmed, collapsed spaces)
            const currentCruise = window.app.getCurrentCruise();
            const existingDrinks = await this.storage.getDrinksForCruise(currentCruise.id);
            const normalizedName = name.toLowerCase().replace(/\s+/g, ' ');

            const isDuplicate = existingDrinks.some(drink => {
                const existingNormalized = drink.name.toLowerCase().trim().replace(/\s+/g, ' ');
                return existingNormalized === normalizedName;
            });

            if (isDuplicate) {
                window.showToast('A drink with this name already exists in this cruise', 'error');
                this.submittingDrink = false;
                // Re-enable submit button
                const submitBtn = document.querySelector('#add-drink-form button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Add Drink';
                }
                return;
            }

            // Disable submit button
            const submitBtn = document.querySelector('#add-drink-form button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Adding...';
            }

            const drink = {
                id: this.generateId(),
                name: name,
                photo: this.drinkPhotoForNew || this.drinkEmoji || null,
                photoFull: this.drinkPhotoForNewFull || null,
                cruiseId: window.app.getCurrentCruise().id
            };

            await this.storage.saveDrink(drink);
            this.hideAddDrinkModal();
            window.showToast('Drink added successfully!', 'success');

            // Auto-select the newly created drink for the current person(s).
            // Set state BEFORE render so the new drink is shown as selected
            // and the photo/submit cards are revealed in a single pass.
            this.selectedDrink = drink;
            this.drinkPhoto = null;
            this.drinkPhotoFull = null;
            await this.render();
        } catch (error) {
            console.error('Error adding drink:', error);
            window.showToast('Error adding drink: ' + error.message, 'error');
        } finally {
            this.submittingDrink = false;
        }
    }

    async submitDrinkRecord() {
        if (this.selectedPeople.length === 0 || !this.selectedDrink) {
            window.showToast('Please select both person(s) and a drink', 'error');
            return;
        }

        // Prevent multiple submissions
        if (this.submitting) {
            return;
        }
        this.submitting = true;

        try {
            // Disable submit button
            const submitBtn = document.getElementById('submit-drink-record');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Recording...';
            }

            const recordTime = this.customDateTime || new Date();
            const records = [];

            // Create a record for each selected person
            for (const person of this.selectedPeople) {
                const record = {
                    id: this.generateId(),
                    personId: person.id,
                    drinkId: this.selectedDrink.id,
                    cruiseId: window.app.getCurrentCruise().id,
                    timestamp: recordTime.toISOString(),
                    date: recordTime.toISOString().split('T')[0],
                    photo: this.drinkPhoto || null,
                    photoFull: this.drinkPhotoFull || null
                };
                records.push(record);
            }

            // Save all records
            for (const record of records) {
                await this.storage.saveDrinkRecord(record);
            }

            const personNames = this.selectedPeople.map(p => p.name).join(', ');
            const message = this.selectedPeople.length === 1
                ? `Drink recorded for ${personNames}!`
                : `Drink recorded for ${this.selectedPeople.length} people: ${personNames}!`;

            window.showToast(message, 'success');

            // Reset selections
            this.selectedPeople = [];
            this.multiSelectMode = false;
            this.selectedDrink = null;
            this.drinkPhoto = null;
            this.drinkPhotoFull = null;
            this.customDateTime = null;

            // Refresh the page
            await this.render();
        } catch (error) {
            console.error('Error submitting drink record:', error);
            window.showToast('Error recording drink: ' + error.message, 'error');
        } finally {
            this.submitting = false;
        }
    }

    async handleQuickFind(searchTerm) {
        const resultsContainer = document.getElementById('quick-find-results');
        if (!resultsContainer) return;

        if (!searchTerm.trim()) {
            resultsContainer.innerHTML = '';
            return;
        }

        try {
            const currentCruise = window.app?.getCurrentCruise();
            if (!currentCruise) return;

            // Get ALL drinks for this cruise (not just ordered ones)
            const allDrinks = await this.storage.getDrinksForCruise(currentCruise.id);

            // Filter drinks based on search term
            const filteredDrinks = allDrinks.filter(drink =>
                drink && drink.name.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (filteredDrinks.length === 0) {
                resultsContainer.innerHTML = '<p class="text-muted">No matching drinks found</p>';
                return;
            }

            // Create search results
            resultsContainer.innerHTML = filteredDrinks.map(drink =>
                `<div class="quick-find-result ${this.selectedDrink?.id === drink.id ? 'selected' : ''}" data-drink-id="${drink.id}">
                    <div class="recent-drink-icon">
                        ${drink.photo ?
                            (drink.photo.startsWith('data:') ?
                                `<img src="${drink.photo}" alt="${drink.name}">` :
                                `<span class="emoji-display">${drink.photo}</span>`) :
                            '🍹'
                        }
                    </div>
                    <div class="recent-drink-name">${drink.name}</div>
                </div>`
            ).join('');

            // Add click handlers for search results
            resultsContainer.querySelectorAll('.quick-find-result').forEach(item => {
                item.addEventListener('click', () => {
                    this.selectDrink(item.dataset.drinkId);
                    // Clear search after selection
                    const quickFindInput = document.getElementById('quick-find-input');
                    if (quickFindInput) {
                        quickFindInput.value = '';
                        quickFindInput.placeholder = '🔍 Tap to search drinks...';
                        quickFindInput.blur();
                    }
                    resultsContainer.innerHTML = '';
                });
            });
        } catch (error) {
            console.error('Error in quick find:', error);
            resultsContainer.innerHTML = '<p class="text-muted">Error searching drinks</p>';
        }
    }

    async showAllDrinks() {
        try {
            const currentCruise = window.app?.getCurrentCruise();
            if (!currentCruise) return;

            const drinks = await this.storage.getDrinksForCruise(currentCruise.id);
            const sortedDrinks = drinks.sort((a, b) => a.name.localeCompare(b.name));

            const drinksGrid = document.getElementById('drinks-grid');
            if (!drinksGrid) return;

            // Clear existing content
            drinksGrid.innerHTML = '';

            // Show all drinks
            sortedDrinks.forEach(drink => {
                drinksGrid.innerHTML += this.createDrinkCard(drink);
            });

            // Add the "Add Drink" button
            drinksGrid.innerHTML += `
                <div class="add-drink-card" id="add-drink-btn">
                    <div class="add-icon">➕</div>
                    <div>Add Drink</div>
                </div>
            `;

            // Re-attach event listeners for drink cards
            drinksGrid.querySelectorAll('.drink-card').forEach(card => {
                card.addEventListener('click', () => this.selectDrink(card.dataset.drinkId));
            });

            // Re-attach event listener for add drink button
            const addDrinkBtn = document.getElementById('add-drink-btn');
            if (addDrinkBtn) {
                addDrinkBtn.addEventListener('click', () => this.showAddDrinkModal());
            }
        } catch (error) {
            console.error('Error showing all drinks:', error);
        }
    }

    generateId() {
        return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }

    setupCustomTimePickerDelegation() {
        // Remove existing event listeners to avoid duplicates
        const container = document.getElementById('add-drink-content');

        if (container) {
            // Create and append a persistent hidden datetime picker if it doesn't exist
            let picker = document.getElementById('persistent-datetime-picker');
            if (!picker) {
                picker = document.createElement('input');
                picker.type = 'datetime-local';
                picker.id = 'persistent-datetime-picker';
                picker.style.display = 'none';
                picker.style.position = 'absolute';
                picker.style.left = '-9999px';
                document.body.appendChild(picker); // Append to body instead of container

                // Listen for changes to the persistent picker
                picker.addEventListener('change', (e) => {
                    if (e.target.value) {
                        this.customDateTime = new Date(e.target.value);
                        this.updateSubmitSection();
                    }
                });
            }

            // Remove existing click listener if any
            container.removeEventListener('click', this.timeClickHandler);

            // Create new click handler
            this.timeClickHandler = (e) => {
                if (e.target && e.target.id === 'custom-time-display') {
                    console.log('Time display clicked'); // Debug log
                    const picker = document.getElementById('persistent-datetime-picker');
                    if (picker) {
                        // Set current value in the picker
                        const currentTime = this.customDateTime || new Date();
                        const isoString = currentTime.toISOString().slice(0, 16);
                        picker.value = isoString;

                        console.log('Opening picker with value:', isoString); // Debug log
                        // Show the native picker
                        try {
                            picker.showPicker();
                        } catch (error) {
                            console.error('Error opening picker:', error);
                            // Fallback: focus the input
                            picker.focus();
                        }
                    }
                }
            };

            // Add the event listener with delegation
            container.addEventListener('click', this.timeClickHandler);
        }
    }

    updatePersonCardState() {
        const personCard = document.getElementById('card-person');
        if (personCard) {
            // Update to completed state when people are selected
            if (this.selectedPeople.length > 0) {
                personCard.classList.remove('active');
                personCard.classList.add('completed');
            } else {
                personCard.classList.remove('completed');
                personCard.classList.add('active');
            }
        }
    }

    async showDrinkCard() {
        const cardsContainer = document.querySelector('.cards-container');
        if (!cardsContainer || document.getElementById('card-drink')) return;

        try {
            const drinks = await this.storage.getDrinksForCruise(window.app.getCurrentCruise().id);

            // Create drink card
            const drinkCardHTML = `
                <div class="progress-card active" id="card-drink" style="opacity: 0; transform: translateY(30px);">
                    <div class="card-header">
                        <h3>🍹 Select Drink</h3>
                    </div>
                    <div class="card-content">
                        ${this.createDrinkSelectionHTML(drinks)}
                    </div>
                </div>
            `;

            // Insert after person card
            const personCard = document.getElementById('card-person');
            personCard.insertAdjacentHTML('afterend', drinkCardHTML);

            // Animate in
            const drinkCard = document.getElementById('card-drink');
            setTimeout(() => {
                drinkCard.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                drinkCard.style.opacity = '1';
                drinkCard.style.transform = 'translateY(0)';
            }, 50);

            // Reattach event listeners for the new content
            this.setupEventListeners();
            this.loadRecentDrinks();
        } catch (error) {
            console.error('Error showing drink card:', error);
        }
    }

    updateDrinkCard() {
        const drinkCard = document.getElementById('card-drink');
        if (drinkCard && this.selectedDrink) {
            // Update to completed state
            drinkCard.classList.remove('active');
            drinkCard.classList.add('completed');

            // Update header to show selection
            const header = drinkCard.querySelector('.card-header');
            if (header) {
                header.innerHTML = `
                    <h3>🍹 Select Drink</h3>
                    <div class="selected-indicator">✓ ${this.selectedDrink.name}</div>
                `;
            }

            // Update selected drink in the grid
            document.querySelectorAll('.drink-card').forEach(card => {
                card.classList.remove('selected');
                if (card.dataset.drinkId === this.selectedDrink.id) {
                    card.classList.add('selected');
                }
            });
        }
    }

    async showPhotoAndSubmitCards() {
        const cardsContainer = document.querySelector('.cards-container');
        if (!cardsContainer) return;

        // Remove existing photo and submit cards if they exist
        const existingPhoto = document.getElementById('card-photo');
        const existingSubmit = document.getElementById('card-submit');
        if (existingPhoto) existingPhoto.remove();
        if (existingSubmit) existingSubmit.remove();

        // Create photo and submit cards
        const photoSubmitHTML = `
            <div class="progress-card active" id="card-photo" style="opacity: 0; transform: translateY(30px);">
                <div class="card-header">
                    <h3>📷 Add Photo (Optional)</h3>
                    ${this.drinkPhoto ? `<div class="selected-indicator">✓ Photo Added</div>` : ''}
                </div>
                <div class="card-content">
                    ${this.createPhotoSectionHTML()}
                </div>
            </div>
            <div class="progress-card active submit-card" id="card-submit" style="opacity: 0; transform: translateY(30px);">
                <div class="card-header">
                    <h3>🚀 Ready to Submit</h3>
                </div>
                <div class="card-content">
                    ${this.createSubmitSectionHTML()}
                </div>
            </div>
        `;

        // Insert after drink card
        const drinkCard = document.getElementById('card-drink');
        drinkCard.insertAdjacentHTML('afterend', photoSubmitHTML);

        // Animate in with staggered timing
        const photoCard = document.getElementById('card-photo');
        const submitCard = document.getElementById('card-submit');

        setTimeout(() => {
            photoCard.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            photoCard.style.opacity = '1';
            photoCard.style.transform = 'translateY(0)';
        }, 100);

        setTimeout(() => {
            submitCard.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            submitCard.style.opacity = '1';
            submitCard.style.transform = 'translateY(0)';
        }, 200);

        // Reattach event listeners
        this.setupEventListeners();
    }

    updateSubmitSection() {
        // Update the submit section when time changes
        const submitCard = document.getElementById('card-submit');
        if (submitCard && this.selectedDrink) {
            const cardContent = submitCard.querySelector('.card-content');
            if (cardContent) {
                cardContent.innerHTML = this.createSubmitSectionHTML();

                // Reattach event listeners for the updated content
                this.setupCustomTimePickerDelegation();

                // Reattach submit button event listener
                const submitBtn = document.getElementById('submit-drink-record');
                if (submitBtn) {
                    submitBtn.addEventListener('click', () => this.submitDrinkRecord());
                }
            }
        }
    }

}

window.AddDrinkComponent = AddDrinkComponent;