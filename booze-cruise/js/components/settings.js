// Settings Component - Handles app settings, data management, and cruise management
class SettingsComponent {
    constructor(storage, themeManager) {
        this.storage = storage;
        this.themeManager = themeManager;
        this.deferredPrompt = null;
        this.setupPWAInstallHandler();
    }

    async render() {
        const container = document.getElementById('settings-content');

        try {
            const cruises = await this.storage.getAllCruises();
            const currentCruise = window.app?.getCurrentCruise();

            container.innerHTML = this.createSettingsHTML(cruises, currentCruise);
            this.setupEventListeners();
            this.updateAppVersionDisplay();
        } catch (error) {
            console.error('Error rendering settings page:', error);
            container.innerHTML = '<div class="message error">Error loading settings: ' + error.message + '</div>';
        }
    }

    async updateAppVersionDisplay() {
        const appVersionElement = document.getElementById('app-version');
        if (appVersionElement) {
            appVersionElement.textContent = await this.getAppVersion();
        }
    }

    createSettingsHTML(cruises, currentCruise) {
        return `
            <div class="settings-container">
                <!-- Cruise Management Section -->
                <div class="settings-section card">
                    <h3>🚢 Cruise Management</h3>
                    <div class="current-cruise-display">
                        <strong>Current Cruise:</strong> ${currentCruise?.name || 'None selected'}
                        ${currentCruise?.coverPhoto ?
                            `<img src="${currentCruise.coverPhoto}" class="cruise-cover-thumb" alt="Cruise cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                             <span class="cruise-cover-fallback" style="display:none;">🚢</span>` :
                            ''
                        }
                    </div>

                    <div class="cruise-list">
                        ${cruises.length === 0 ?
                            '<p class="text-muted">No cruises created yet.</p>' :
                            cruises.map(cruise => this.createCruiseItem(cruise, currentCruise)).join('')
                        }
                    </div>

                    <div class="cruise-actions">
                        <button class="btn" id="add-cruise-btn">Add New Cruise</button>
                    </div>
                </div>

                <!-- People Management Section -->
                <div class="settings-section card">
                    <h3>👥 People Management</h3>
                    <div id="people-management-content">
                        ${currentCruise ?
                            '<p>Loading people...</p>' :
                            '<p class="text-muted">Select a cruise to manage people.</p>'
                        }
                    </div>
                </div>

                <!-- Drinks Management Section -->
                <div class="settings-section card">
                    <h3>🍹 Drinks Management</h3>
                    <div id="drinks-management-content">
                        ${currentCruise ?
                            '<p>Loading drinks...</p>' :
                            '<p class="text-muted">Select a cruise to manage drinks.</p>'
                        }
                    </div>
                </div>

                <!-- Theme Settings Section -->
                <div class="settings-section card">
                    <h3>🎨 Theme Settings</h3>
                    <div class="theme-selector">
                        <label>Choose Theme:</label>
                        <div class="theme-options">
                            ${this.themeManager.getAvailableThemes().map(theme => `
                                <div class="theme-option ${this.themeManager.getCurrentTheme() === theme.key ? 'active' : ''}"
                                     data-theme="${theme.key}">
                                    <div class="theme-preview-container">
                                        <div id="theme-preview-${theme.key}"></div>
                                    </div>
                                    <span>${theme.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Data Management Section -->
                <div class="settings-section card">
                    <h3>💾 Data Management</h3>
                    <div class="data-actions">
                        <div class="action-item">
                            <div class="action-info">
                                <strong>Export Data</strong>
                                <p>Download all your cruise data as a JSON file</p>
                            </div>
                            <button class="btn btn-outline" id="export-data-btn">Export</button>
                        </div>

                        <div class="action-item">
                            <div class="action-info">
                                <strong>Import Data</strong>
                                <p>Upload a previously exported JSON file</p>
                            </div>
                            <div class="import-controls">
                                <input type="file" id="import-file-input" accept=".json" style="display: none;">
                                <button class="btn btn-outline" id="import-data-btn">Import</button>
                            </div>
                        </div>

                        <div class="action-item danger">
                            <div class="action-info">
                                <strong>Clear All Data</strong>
                                <p>⚠️ This will permanently delete all your data</p>
                            </div>
                            <button class="btn btn-danger" id="clear-data-btn">Clear All</button>
                        </div>
                    </div>
                </div>

                <!-- PWA Settings Section -->
                <div class="settings-section card">
                    <h3>📱 App Settings</h3>
                    <div class="app-actions">
                        <div class="action-item">
                            <div class="action-info">
                                <strong>Remember Page Cross Refresh</strong>
                                <p>When enabled, the app will remember the last page you were on after reload.</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="remember-page-refresh" ${localStorage.getItem('rememberPageOnRefresh') !== 'false' ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <div class="action-item">
                            <div class="action-info">
                                <strong>Install App</strong>
                                <p>Install this app on your device for easier access</p>
                            </div>
                            <button class="btn" id="install-pwa-btn" ${this.deferredPrompt ? '' : 'disabled'}>
                                ${this.deferredPrompt ? 'Install App' : 'Already Installed'}
                            </button>
                        </div>

                        <div class="action-item">
                            <div class="action-info">
                                <strong>Update Now</strong>
                                <p>Force a fresh download of the app. Requires internet.</p>
                            </div>
                            <button class="btn" id="update-now-btn">Update</button>
                        </div>

                        <div class="action-item app-version-box">
                            <div class="action-info">
                                <strong>App Version</strong>
                                <p>Booze Cruise <span id="app-version">Loading...</span></p>
                            </div>
                            <a href="https://github.com/csm10495" target="_blank" rel="noopener noreferrer">
                                <img src="https://gravatar.com/avatar/2189940f741720249a7a446327c4670c9f8f8c7e99487f0b4be42f805b865136?s=80" alt="Author Avatar" class="gravatar-icon" onerror="this.src='/booze-cruise/gravatar.png'">
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Voice Input Section -->
                <div class="settings-section card">
                    <h3>🎤 Voice Input</h3>
                    <div class="app-actions">
                        <div class="action-item">
                            <div class="action-info">
                                <strong>Status</strong>
                                <p id="voice-status-line">Checking…</p>
                            </div>
                        </div>
                        <div class="action-item">
                            <div class="action-info">
                                <strong>Offline voice recognition</strong>
                                <p>Downloads a small English model (~40 MB) so voice works without internet. One-time download, cached on this device.</p>
                                <div id="voice-download-progress" class="voice-download-progress" style="display: none;">
                                    <div class="voice-progress-bar"><div class="voice-progress-fill" style="width: 0%"></div></div>
                                    <div class="voice-progress-text">0%</div>
                                </div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="voice-offline-toggle">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Cruise Modal -->
                <div id="cruise-modal" class="modal" style="display: none;">
                    <div class="modal-content">
                        <span class="close" id="close-cruise-modal">&times;</span>
                        <h3 id="cruise-modal-title">Add New Cruise</h3>
                        <form id="cruise-form">
                            <div class="form-group">
                                <label for="cruise-name">Cruise Name *</label>
                                <input type="text" id="cruise-name" required>
                            </div>
                            <div class="form-group">
                                <label for="cruise-start-date">Start Date</label>
                                <input type="date" id="cruise-start-date">
                            </div>
                            <div class="form-group">
                                <label for="cruise-end-date">End Date</label>
                                <input type="date" id="cruise-end-date">
                            </div>
                            <div class="form-group">
                                <label>Cover Photo (Optional)</label>
                                <div class="image-upload-container">
                                    <div class="image-preview" id="cruise-cover-preview">🚢</div>
                                    <label for="cruise-cover-input" class="image-upload-label">Choose Photo</label>
                                    <input type="file" accept="image/*;capture=camera" id="cruise-cover-input" class="image-upload-input">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="cruise-default"> Set as default cruise
                                </label>
                            </div>
                            <div class="form-group">
                                <button type="submit" class="btn">Save Cruise</button>
                                <button type="button" class="btn btn-outline" id="cancel-cruise">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    createCruiseItem(cruise, currentCruise) {
        const isDefault = cruise.isDefault;
        const isCurrent = currentCruise?.id === cruise.id;

        return `
            <div class="cruise-item ${isCurrent ? 'current' : ''}" data-cruise-id="${cruise.id}">
                <div class="cruise-info">
                    ${cruise.coverPhoto ?
                        `<img src="${cruise.coverPhoto}" class="cruise-thumb" alt="${cruise.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                         <div class="cruise-thumb-placeholder" style="display:none;">🚢</div>` :
                        '<div class="cruise-thumb-placeholder">🚢</div>'
                    }
                    <div class="cruise-details">
                        <div class="cruise-name">
                            ${cruise.name}
                            ${isDefault ? '<span class="default-badge">Default</span>' : ''}
                            ${isCurrent ? '<span class="current-badge">Current</span>' : ''}
                        </div>
                        <div class="cruise-dates">
                            ${cruise.startDate ? new Date(cruise.startDate).toLocaleDateString() : ''} -
                            ${cruise.endDate ? new Date(cruise.endDate).toLocaleDateString() : ''}
                        </div>
                    </div>
                </div>
                <div class="cruise-actions">
                    ${!isCurrent ? `<button class="btn btn-outline btn-sm" onclick="window.settingsComponent.switchToCruise('${cruise.id}')">Switch</button>` : ''}
                    <button class="btn btn-outline btn-sm" onclick="window.settingsComponent.editCruise('${cruise.id}')">Edit</button>
                    ${!isDefault ? `<button class="btn btn-danger btn-sm" onclick="window.settingsComponent.deleteCruise('${cruise.id}')">Delete</button>` : ''}
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Remember Page Cross Refresh setting
        const rememberPageCheckbox = document.getElementById('remember-page-refresh');
        if (rememberPageCheckbox) {
            rememberPageCheckbox.addEventListener('change', (e) => {
                localStorage.setItem('rememberPageOnRefresh', e.target.checked ? 'true' : 'false');
            });
        }
        // Cruise management
        const addCruiseBtn = document.getElementById('add-cruise-btn');
        if (addCruiseBtn) {
            addCruiseBtn.addEventListener('click', () => this.showCruiseModal());
        }

        // Theme selection
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                this.themeManager.setTheme(theme);
                this.updateThemeSelection();
            });
        });

        // Data management
        const exportBtn = document.getElementById('export-data-btn');
        const importBtn = document.getElementById('import-data-btn');
        const clearBtn = document.getElementById('clear-data-btn');
        const importInput = document.getElementById('import-file-input');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        if (importBtn) {
            importBtn.addEventListener('click', () => importInput.click());
        }

        if (importInput) {
            importInput.addEventListener('change', (e) => this.importData(e));
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAllData());
        }

        // PWA install
        const installBtn = document.getElementById('install-pwa-btn');
        if (installBtn && this.deferredPrompt) {
            installBtn.addEventListener('click', () => this.installPWA());
        }

        // Update Now — clears the SW caches (preserves Vosk voice cache)
        // and reloads to fetch fresh app assets.
        const updateBtn = document.getElementById('update-now-btn');
        if (updateBtn) {
            const refreshUpdateButton = () => {
                const onLine = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
                updateBtn.disabled = !onLine;
                updateBtn.textContent = onLine ? 'Update' : 'Offline';
            };
            refreshUpdateButton();
            if (!this._updateOnlineListenerAttached) {
                window.addEventListener('online', refreshUpdateButton);
                window.addEventListener('offline', refreshUpdateButton);
                this._updateOnlineListenerAttached = true;
            }
            updateBtn.addEventListener('click', () => this.runUpdateNow());
        }

        // Voice input — wire toggle + initial status refresh
        this.setupVoiceInputControls();

        // Modal controls
        this.setupModalEventListeners();

        // Load people and drinks management
        this.loadPeopleManagement();
        this.loadDrinksManagement();

        // Setup theme previews
        this.setupThemePreviews();
    }

    setupPWAInstallHandler() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
        });
    }

    async installPWA() {
        if (!this.deferredPrompt) {
            window.showToast('App is already installed or cannot be installed', 'info');
            return;
        }

        const result = await this.deferredPrompt.prompt();
        if (result.outcome === 'accepted') {
            window.showToast('App installed successfully!', 'success');
            this.deferredPrompt = null;
            const installBtn = document.getElementById('install-pwa-btn');
            if (installBtn) {
                installBtn.disabled = true;
                installBtn.textContent = 'Already Installed';
            }
        } else {
            window.showToast('App installation cancelled.', 'info');
        }
    }

    setupModalEventListeners() {
        const cruiseModal = document.getElementById('cruise-modal');
        const closeCruiseModal = document.getElementById('close-cruise-modal');
        const cancelCruise = document.getElementById('cancel-cruise');
        const cruiseForm = document.getElementById('cruise-form');

        if (closeCruiseModal) {
            closeCruiseModal.addEventListener('click', () => this.hideCruiseModal());
        }
        if (cancelCruise) {
            cancelCruise.addEventListener('click', () => this.hideCruiseModal());
        }
        if (cruiseForm) {
            cruiseForm.addEventListener('submit', (e) => this.handleCruiseForm(e));
        }

        if (cruiseModal) {
            cruiseModal.addEventListener('click', (e) => {
                if (e.target === cruiseModal) {
                    this.hideCruiseModal();
                }
            });
        }

        // Photo upload for cruise cover
        const photoManager = new PhotoManager();
        photoManager.setupPhotoUpload('cruise-cover-input', 'cruise-cover-preview', (photoData) => {
            // Validate the photo data before storing
            if (photoData && (photoData.thumbnail || photoData.fullSize)) {
                this.cruiseCoverPhoto = photoData.thumbnail || photoData.fullSize;
            } else if (typeof photoData === 'string' && photoData.startsWith('data:image/')) {
                this.cruiseCoverPhoto = photoData;
            } else {
                console.warn('Invalid photo data received:', photoData);
                window.showToast('Invalid image data. Please try uploading again.', 'error');
                this.cruiseCoverPhoto = null;
            }
        });
    }

    setupThemePreviews() {
        this.themeManager.getAvailableThemes().forEach(theme => {
            const previewContainer = document.getElementById(`theme-preview-${theme.key}`);
            if (previewContainer) {
                // Clear existing previews first to avoid duplicates
                previewContainer.innerHTML = '';

                const preview = this.themeManager.getThemePreview(theme.key);
                if (preview) {
                    previewContainer.appendChild(preview);
                }
            }
        });
    }

    updateThemeSelection() {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === this.themeManager.getCurrentTheme()) {
                option.classList.add('active');
            }
        });
    }


    async loadPeopleManagement() {
        const container = document.getElementById('people-management-content');
        const currentCruise = window.app?.getCurrentCruise();

        if (!currentCruise) {
            container.innerHTML = '<p class="text-muted">Select a cruise to manage people.</p>';
            return;
        }

        try {
            const people = await this.storage.getPeopleForCruise(currentCruise.id);

            let html = '<div class="management-list">';

            if (people.length === 0) {
                html += '<p class="text-muted">No people added to this cruise yet.</p>';
            } else {
                people.forEach(person => {
                    html += `
                        <div class="management-item">
                            <div class="item-info">
                                ${person.photo ?
                                    (person.photo.startsWith('data:') ?
                                        `<img src="${person.photo}" class="management-photo" alt="${person.name}">` :
                                        `<div class="management-photo-emoji">${person.photo}</div>`) :
                                    '<div class="management-photo-placeholder">👤</div>'
                                }
                                <span>${person.name}</span>
                            </div>
                            <div class="item-actions">
                                <button class="btn btn-outline btn-sm" onclick="window.settingsComponent.editPerson('${person.id}')">Edit</button>
                                <button class="btn btn-danger btn-sm" onclick="window.settingsComponent.deletePerson('${person.id}')">Delete</button>
                            </div>
                        </div>
                    `;
                });
            }

            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading people management:', error);
            container.innerHTML = '<div class="message error">Error loading people</div>';
        }
    }

    async loadDrinksManagement() {
        const container = document.getElementById('drinks-management-content');
        const currentCruise = window.app?.getCurrentCruise();

        if (!currentCruise) {
            container.innerHTML = '<p class="text-muted">Select a cruise to manage drinks.</p>';
            return;
        }

        try {
            const drinks = await this.storage.getDrinksForCruise(currentCruise.id);

            let html = '<div class="management-list">';

            if (drinks.length === 0) {
                html += '<p class="text-muted">No drinks added to this cruise yet.</p>';
            } else {
                drinks.forEach(drink => {
                    html += `
                        <div class="management-item">
                            <div class="item-info">
                                ${drink.photo ?
                                    (drink.photo.startsWith('data:') ?
                                        `<img src="${drink.photo}" class="management-photo" alt="${drink.name}">` :
                                        `<div class="management-photo-emoji">${drink.photo}</div>`) :
                                    '<div class="management-photo-placeholder">🍹</div>'
                                }
                                <div class="item-details">
                                    <span class="item-name">${drink.name}</span>
                                </div>
                            </div>
                            <div class="item-actions">
                                <button class="btn btn-outline btn-sm" onclick="window.settingsComponent.editDrink('${drink.id}')">Edit</button>
                                <button class="btn btn-danger btn-sm" onclick="window.settingsComponent.deleteDrink('${drink.id}')">Delete</button>
                            </div>
                        </div>
                    `;
                });
            }

            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading drinks management:', error);
            container.innerHTML = '<div class="message error">Error loading drinks</div>';
        }
    }

    showCruiseModal(cruise = null) {
        const modal = document.getElementById('cruise-modal');
        const title = document.getElementById('cruise-modal-title');

        if (cruise) {
            title.textContent = 'Edit Cruise';
            document.getElementById('cruise-name').value = cruise.name;
            document.getElementById('cruise-start-date').value = cruise.startDate || '';
            document.getElementById('cruise-end-date').value = cruise.endDate || '';
            document.getElementById('cruise-default').checked = cruise.isDefault;

            if (cruise.coverPhoto) {
                const preview = document.getElementById('cruise-cover-preview');
                preview.innerHTML = `<img src="${cruise.coverPhoto}" alt="Cover" onerror="this.style.display='none'; this.parentElement.innerHTML='🚢 (Image Error)';">`;
                this.cruiseCoverPhoto = cruise.coverPhoto;
            }
        } else {
            title.textContent = 'Add New Cruise';
            document.getElementById('cruise-form').reset();
            document.getElementById('cruise-cover-preview').innerHTML = '🚢';
            this.cruiseCoverPhoto = null;
        }

        this.editingCruise = cruise;
        modal.style.display = 'flex';
        document.getElementById('cruise-name').focus();
    }

    hideCruiseModal() {
        const modal = document.getElementById('cruise-modal');
        modal.style.display = 'none';
        this.editingCruise = null;
        this.cruiseCoverPhoto = null;
    }

    async handleCruiseForm(e) {
        e.preventDefault();

        try {
            const name = document.getElementById('cruise-name').value.trim();
            const startDate = document.getElementById('cruise-start-date').value;
            const endDate = document.getElementById('cruise-end-date').value;
            const isDefault = document.getElementById('cruise-default').checked;

            if (!name) {
                window.showToast('Please enter a cruise name', 'error');
                return;
            }

            const cruise = {
                id: this.editingCruise?.id || this.generateId(),
                name: name,
                startDate: startDate || null,
                endDate: endDate || null,
                coverPhoto: this.cruiseCoverPhoto || null,
                isDefault: isDefault
            };

            // If setting as default, unset other defaults
            if (isDefault) {
                const allCruises = await this.storage.getAllCruises();
                for (const existingCruise of allCruises) {
                    if (existingCruise.isDefault && existingCruise.id !== cruise.id) {
                        existingCruise.isDefault = false;
                        await this.storage.saveCruise(existingCruise);
                    }
                }
            }

            await this.storage.saveCruise(cruise);
            this.hideCruiseModal();

            window.showToast(this.editingCruise ? 'Cruise updated!' : 'Cruise created!', 'success');

            // Refresh the page
            await this.render();

            // Switch to new cruise if it's the first one or set as default
            if (isDefault || !window.app?.getCurrentCruise()) {
                await window.app?.switchCruise(cruise.id);
            }
        } catch (error) {
            console.error('Error saving cruise:', error);
            window.showToast('Error saving cruise: ' + error.message, 'error');
        }
    }

    async exportData() {
        try {
            // Get all cruise data from storage
            const cruiseData = await this.storage.exportData();

            // Get all app settings
            const appSettings = {
                theme: this.themeManager.exportTheme(),
                currentCruise: window.app?.getCurrentCruise()?.id || null,
                version: '1.0',
                exportDate: new Date().toISOString()
            };

            // Combine everything into complete export
            const completeData = {
                ...cruiseData,
                appSettings: appSettings
            };

            const blob = new Blob([JSON.stringify(completeData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `cruise-drink-tracker-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            window.showToast('All data and settings exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            window.showToast('Error exporting data: ' + error.message, 'error');
        }
    }

    async importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (confirm('This will replace all existing data and settings. Are you sure?')) {
                // Import cruise data
                const cruiseData = { ...data };
                delete cruiseData.appSettings; // Remove app settings from cruise data
                await this.storage.importData(cruiseData);

                // Import app settings if they exist
                if (data.appSettings) {
                    // Restore theme
                    if (data.appSettings.theme) {
                        this.themeManager.importTheme(data.appSettings.theme);
                    }

                    // Restore current cruise selection
                    if (data.appSettings.currentCruise) {
                        // Set the current cruise after app reload
                        localStorage.setItem('cruise-drink-tracker-pending-cruise', data.appSettings.currentCruise);
                    }
                }

                window.showToast('All data and settings imported successfully!', 'success');

                // Reload the app
                window.location.reload();
            }
        } catch (error) {
            console.error('Import error:', error);
            window.showToast('Error importing data: ' + error.message, 'error');
        }

        // Reset file input
        e.target.value = '';
    }

    async clearAllData() {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
            if (confirm('This will permanently delete all cruises, people, drinks, and records. Continue?')) {
                try {
                    await this.storage.clearAllData();
                    window.showToast('All data cleared successfully!', 'success');

                    // Reload the app
                    window.location.reload();
                } catch (error) {
                    console.error('Clear data error:', error);
                    window.showToast('Error clearing data: ' + error.message, 'error');
                }
            }
        }
    }

    // Helper methods for cruise actions (called from HTML onclick)
    async switchToCruise(cruiseId) {
        await window.app?.switchCruise(cruiseId);
        await this.render();
    }

    async editCruise(cruiseId) {
        try {
            const cruise = await this.storage.getCruise(cruiseId);
            this.showCruiseModal(cruise);
        } catch (error) {
            console.error('Error loading cruise for edit:', error);
            window.showToast('Error loading cruise', 'error');
        }
    }

    async deleteCruise(cruiseId) {
        if (confirm('Delete this cruise and all associated data? This cannot be undone!')) {
            try {
                await this.storage.deleteCruise(cruiseId);
                window.showToast('Cruise deleted successfully!', 'success');
                await this.render();

                // If deleted cruise was current, switch to another
                const remainingCruises = await this.storage.getAllCruises();
                if (remainingCruises.length > 0) {
                    const defaultCruise = remainingCruises.find(c => c.isDefault) || remainingCruises[0];
                    await window.app?.switchCruise(defaultCruise.id);
                }
            } catch (error) {
                console.error('Error deleting cruise:', error);
                window.showToast('Error deleting cruise: ' + error.message, 'error');
            }
        }
    }

    // Person management methods
    async editPerson(personId) {
        try {
            const person = await this.storage.getPerson(personId);
            this.showPersonModal(person);
        } catch (error) {
            console.error('Error loading person for edit:', error);
            window.showToast('Error loading person', 'error');
        }
    }

    async deletePerson(personId) {
        if (confirm('Delete this person and all their drink records? This cannot be undone!')) {
            try {
                // First delete all drink records for this person
                const records = await this.storage.getDrinkRecordsForPerson(personId);
                for (const record of records) {
                    await this.storage.deleteDrinkRecord(record.id);
                }

                // Then delete the person
                await this.storage.deletePerson(personId);
                window.showToast('Person deleted successfully!', 'success');
                await this.render();
            } catch (error) {
                console.error('Error deleting person:', error);
                window.showToast('Error deleting person: ' + error.message, 'error');
            }
        }
    }

    // Drink management methods
    async editDrink(drinkId) {
        try {
            const drink = await this.storage.getDrink(drinkId);
            this.showDrinkModal(drink);
        } catch (error) {
            console.error('Error loading drink for edit:', error);
            window.showToast('Error loading drink', 'error');
        }
    }

    async deleteDrink(drinkId) {
        try {
            // Check if drink has any records (has been consumed)
            const records = await this.storage.getDrinkRecordsForDrink(drinkId);

            if (records.length > 0) {
                window.showToast('Recorded drink types can\'t be deleted', 'error');
                return;
            }

            // If no records exist, proceed with deletion
            if (confirm('Delete this drink? This cannot be undone!')) {
                await this.storage.deleteDrink(drinkId);
                window.showToast('Drink deleted successfully!', 'success');
                await this.render();
            }
        } catch (error) {
            console.error('Error deleting drink:', error);
            window.showToast('Error deleting drink: ' + error.message, 'error');
        }
    }

    // Person modal methods
    showPersonModal(person = null) {
        // Create modal dynamically since it doesn't exist in HTML
        this.createPersonModal();

        const modal = document.getElementById('person-edit-modal');
        const title = document.getElementById('person-modal-title');

        // Always reset form fields and JS state before populating so a
        // subsequent edit can't inherit name/photo/emoji from a previous
        // edit session within the same page load.
        document.getElementById('edit-person-form').reset();
        document.getElementById('edit-person-photo-preview').innerHTML = '📷';
        this.editPersonPhoto = null;
        this.editPersonPhotoFull = null;
        this.editPersonEmoji = null;

        if (person) {
            title.textContent = 'Edit Person';
            const nameInput = document.getElementById('edit-person-name');
            if (nameInput) nameInput.value = person.name;

            if (person.photo) {
                const preview = document.getElementById('edit-person-photo-preview');
                if (person.photo.startsWith('data:')) {
                    preview.innerHTML = `<img src="${person.photo}" alt="${person.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                } else {
                    preview.innerHTML = `<span style="font-size: 32px;">${person.photo}</span>`;
                }
                this.editPersonPhoto = person.photo;
                this.editPersonPhotoFull = person.photoFull;
            }
        } else {
            title.textContent = 'Add New Person';
        }

        this.editingPerson = person;
        modal.style.display = 'flex';
        document.getElementById('edit-person-name').focus();
    }

    createPersonModal() {
        if (document.getElementById('person-edit-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'person-edit-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="person-modal-title">Edit Person</h3>
                    <span class="modal-close" onclick="window.settingsComponent.hidePersonModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="edit-person-form" onsubmit="window.settingsComponent.handlePersonForm(event)">
                        <div class="form-group">
                            <label for="edit-person-name">Name</label>
                            <input type="text" id="edit-person-name" name="name" required>
                        </div>

                        <div class="form-group">
                            <label>Photo</label>
                            <div class="image-upload-container">
                                <div class="image-preview" id="edit-person-photo-preview">📷</div>
                                <label for="edit-person-photo-input" class="image-upload-label">Choose Photo</label>
                                <input type="file" accept="image/*;capture=camera" id="edit-person-photo-input" class="image-upload-input">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Or Choose Emoji</label>
                            <div class="emoji-options" id="edit-person-emoji-options">
                                <span class="emoji-option" data-emoji="👤">👤</span>
                                <span class="emoji-option" data-emoji="👨">👨</span>
                                <span class="emoji-option" data-emoji="👩">👩</span>
                                <span class="emoji-option" data-emoji="🧑">🧑</span>
                                <span class="emoji-option" data-emoji="👦">👦</span>
                                <span class="emoji-option" data-emoji="👧">👧</span>
                                <span class="emoji-option" data-emoji="🙂">🙂</span>
                                <span class="emoji-option" data-emoji="😊">😊</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Or Enter Custom Emoji</label>
                            <div class="custom-emoji-container">
                                <input type="text" id="edit-person-custom-emoji" placeholder="Enter any emoji or text">
                                <button type="button" id="edit-person-use-custom" class="btn btn-outline btn-sm">Use Custom</button>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn btn-outline" onclick="window.settingsComponent.hidePersonModal()">Cancel</button>
                            <button type="submit" class="btn">Save Person</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupPersonModalHandlers();
    }

    setupPersonModalHandlers() {
        // Photo upload
        if (!window.settingsPhotoManager) {
            window.settingsPhotoManager = new PhotoManager();
        }
        window.settingsPhotoManager.setupPhotoUpload('edit-person-photo-input', 'edit-person-photo-preview', (photoData) => {
            this.editPersonPhoto = photoData.thumbnail;
            this.editPersonPhotoFull = photoData.fullSize;
            this.editPersonEmoji = null;
        });

        // Emoji selection
        document.getElementById('edit-person-emoji-options').addEventListener('click', (e) => {
            if (e.target.classList.contains('emoji-option')) {
                this.editPersonEmoji = e.target.dataset.emoji;
                this.editPersonPhoto = null;
                this.editPersonPhotoFull = null;

                const preview = document.getElementById('edit-person-photo-preview');
                preview.innerHTML = `<span style="font-size: 32px;">${this.editPersonEmoji}</span>`;

                // Clear photo input
                document.getElementById('edit-person-photo-input').value = '';
            }
        });

        // Custom emoji functionality
        const personCustomInput = document.getElementById('edit-person-custom-emoji');
        const useCustomBtn = document.getElementById('edit-person-use-custom');
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

        if (useCustomBtn) {
            useCustomBtn.addEventListener('click', () => {
                let customEmoji = personCustomInput.value.trim();
                let grapheme = customEmoji;
                if (window.Intl && Intl.Segmenter) {
                    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
                    const graphemes = Array.from(segmenter.segment(customEmoji), seg => seg.segment);
                    grapheme = graphemes[0] || '';
                } else {
                    grapheme = [...customEmoji][0] || '';
                }
                if (grapheme) {
                    this.editPersonEmoji = grapheme;
                    this.editPersonPhoto = null;
                    this.editPersonPhotoFull = null;

                    const preview = document.getElementById('edit-person-photo-preview');
                    preview.innerHTML = `<span style="font-size: 32px;">${grapheme}</span>`;

                    // Clear inputs
                    personCustomInput.value = '';
                    document.getElementById('edit-person-photo-input').value = '';
                }
            });
        }

        if (personCustomInput) {
            personCustomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const customEmoji = personCustomInput.value.trim();
                    if (customEmoji) {
                        this.editPersonEmoji = customEmoji;
                        this.editPersonPhoto = null;
                        this.editPersonPhotoFull = null;

                        const preview = document.getElementById('edit-person-photo-preview');
                        preview.innerHTML = `<span style="font-size: 32px;">${customEmoji}</span>`;

                        // Clear inputs
                        personCustomInput.value = '';
                        document.getElementById('edit-person-photo-input').value = '';
                    }
                }
            });
        }
    }

    hidePersonModal() {
        const modal = document.getElementById('person-edit-modal');
        if (modal) {
            modal.style.display = 'none';
            this.editingPerson = null;
            this.editPersonPhoto = null;
            this.editPersonPhotoFull = null;
            this.editPersonEmoji = null;
        }
    }

    async handlePersonForm(e) {
        e.preventDefault();

        try {
            const name = document.getElementById('edit-person-name').value.trim();
            if (!name) {
                window.showToast('Please enter a name', 'error');
                return;
            }

            const person = {
                id: this.editingPerson?.id || this.generateId(),
                name: name,
                photo: this.editPersonPhoto || this.editPersonEmoji || this.editingPerson?.photo || null,
                photoFull: this.editPersonPhotoFull || this.editingPerson?.photoFull || null,
                cruiseId: window.app.getCurrentCruise().id
            };

            await this.storage.savePerson(person);
            this.hidePersonModal();
            window.showToast(this.editingPerson ? 'Person updated!' : 'Person created!', 'success');
            await this.render();
        } catch (error) {
            console.error('Error saving person:', error);
            window.showToast('Error saving person: ' + error.message, 'error');
        }
    }

    // Drink modal methods
    showDrinkModal(drink = null) {
        // Create modal dynamically since it doesn't exist in HTML
        this.createDrinkModal();

        const modal = document.getElementById('drink-edit-modal');
        const title = document.getElementById('drink-modal-title');

        // Always reset form fields and JS state before populating so a
        // subsequent edit can't inherit name/photo/emoji from a previous
        // edit session within the same page load.
        document.getElementById('edit-drink-form').reset();
        document.getElementById('edit-drink-photo-preview').innerHTML = '🍹';
        this.editDrinkPhoto = null;
        this.editDrinkPhotoFull = null;
        this.editDrinkEmoji = null;

        if (drink) {
            title.textContent = 'Edit Drink';
            const nameInput = document.getElementById('edit-drink-name');
            if (nameInput) nameInput.value = drink.name;

            if (drink.photo) {
                const preview = document.getElementById('edit-drink-photo-preview');
                if (drink.photo.startsWith('data:')) {
                    preview.innerHTML = `<img src="${drink.photo}" alt="${drink.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
                } else {
                    preview.innerHTML = `<span style="font-size: 32px;">${drink.photo}</span>`;
                }
                this.editDrinkPhoto = drink.photo;
                this.editDrinkPhotoFull = drink.photoFull;
            }
        } else {
            title.textContent = 'Add New Drink';
        }

        this.editingDrink = drink;
        modal.style.display = 'flex';
        document.getElementById('edit-drink-name').focus();
    }

    createDrinkModal() {
        if (document.getElementById('drink-edit-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'drink-edit-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="drink-modal-title">Edit Drink</h3>
                    <span class="modal-close" onclick="window.settingsComponent.hideDrinkModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="edit-drink-form" onsubmit="window.settingsComponent.handleDrinkForm(event)">
                        <div class="form-group">
                            <label for="edit-drink-name">Drink Name</label>
                            <input type="text" id="edit-drink-name" name="name" required>
                        </div>

                        <div class="form-group">
                            <label>Photo</label>
                            <div class="image-upload-container">
                                <div class="image-preview" id="edit-drink-photo-preview">🍹</div>
                                <label for="edit-drink-photo-input" class="image-upload-label">Choose Photo</label>
                                <input type="file" accept="image/*;capture=camera" id="edit-drink-photo-input" class="image-upload-input">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Or Choose Emoji</label>
                            <div class="emoji-options" id="edit-drink-emoji-options">
                                <span class="emoji-option" data-emoji="🍹">🍹</span>
                                <span class="emoji-option" data-emoji="🍸">🍸</span>
                                <span class="emoji-option" data-emoji="🍺">🍺</span>
                                <span class="emoji-option" data-emoji="🍻">🍻</span>
                                <span class="emoji-option" data-emoji="🥂">🥂</span>
                                <span class="emoji-option" data-emoji="🍷">🍷</span>
                                <span class="emoji-option" data-emoji="🥃">🥃</span>
                                <span class="emoji-option" data-emoji="☕">☕</span>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Or Enter Custom Emoji</label>
                            <div class="custom-emoji-container">
                                <input type="text" id="edit-drink-custom-emoji" placeholder="Enter any emoji or text">
                                <button type="button" id="edit-drink-use-custom" class="btn btn-outline btn-sm">Use Custom</button>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn btn-outline" onclick="window.settingsComponent.hideDrinkModal()">Cancel</button>
                            <button type="submit" class="btn">Save Drink</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupDrinkModalHandlers();
    }

    setupDrinkModalHandlers() {
        // Photo upload
        if (!window.settingsPhotoManager) {
            window.settingsPhotoManager = new PhotoManager();
        }
        window.settingsPhotoManager.setupPhotoUpload('edit-drink-photo-input', 'edit-drink-photo-preview', (photoData) => {
            this.editDrinkPhoto = photoData.thumbnail;
            this.editDrinkPhotoFull = photoData.fullSize;
            this.editDrinkEmoji = null;
        });

        // Emoji selection
        document.getElementById('edit-drink-emoji-options').addEventListener('click', (e) => {
            if (e.target.classList.contains('emoji-option')) {
                this.editDrinkEmoji = e.target.dataset.emoji;
                this.editDrinkPhoto = null;
                this.editDrinkPhotoFull = null;

                const preview = document.getElementById('edit-drink-photo-preview');
                preview.innerHTML = `<span style="font-size: 32px;">${this.editDrinkEmoji}</span>`;

                // Clear photo input
                document.getElementById('edit-drink-photo-input').value = '';
            }
        });

        // Custom emoji functionality
        const drinkCustomInput = document.getElementById('edit-drink-custom-emoji');
        const useCustomBtn = document.getElementById('edit-drink-use-custom');
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

        if (useCustomBtn) {
            useCustomBtn.addEventListener('click', () => {
                let customEmoji = drinkCustomInput.value.trim();
                let grapheme = customEmoji;
                if (window.Intl && Intl.Segmenter) {
                    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
                    const graphemes = Array.from(segmenter.segment(customEmoji), seg => seg.segment);
                    grapheme = graphemes[0] || '';
                } else {
                    grapheme = [...customEmoji][0] || '';
                }
                if (grapheme) {
                    this.editDrinkEmoji = grapheme;
                    this.editDrinkPhoto = null;
                    this.editDrinkPhotoFull = null;

                    const preview = document.getElementById('edit-drink-photo-preview');
                    preview.innerHTML = `<span style="font-size: 32px;">${grapheme}</span>`;

                    // Clear inputs
                    drinkCustomInput.value = '';
                    document.getElementById('edit-drink-photo-input').value = '';
                }
            });
        }

        if (drinkCustomInput) {
            drinkCustomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const customEmoji = drinkCustomInput.value.trim();
                    if (customEmoji) {
                        this.editDrinkEmoji = customEmoji;
                        this.editDrinkPhoto = null;
                        this.editDrinkPhotoFull = null;

                        const preview = document.getElementById('edit-drink-photo-preview');
                        preview.innerHTML = `<span style="font-size: 32px;">${customEmoji}</span>`;

                        // Clear inputs
                        drinkCustomInput.value = '';
                        document.getElementById('edit-drink-photo-input').value = '';
                    }
                }
            });
        }
    }

    hideDrinkModal() {
        const modal = document.getElementById('drink-edit-modal');
        if (modal) {
            modal.style.display = 'none';
            this.editingDrink = null;
            this.editDrinkPhoto = null;
            this.editDrinkPhotoFull = null;
            this.editDrinkEmoji = null;
        }
    }

    async handleDrinkForm(e) {
        e.preventDefault();

        try {
            const name = document.getElementById('edit-drink-name').value.trim();
            if (!name) {
                window.showToast('Please enter a drink name', 'error');
                return;
            }

            // Check for duplicate names (case-insensitive, trimmed, collapsed spaces)
            const currentCruise = window.app.getCurrentCruise();
            const existingDrinks = await this.storage.getDrinksForCruise(currentCruise.id);
            const normalizedName = name.toLowerCase().replace(/\s+/g, ' ');

            const isDuplicate = existingDrinks.some(drink => {
                // If editing, exclude the current drink from duplicate check
                if (this.editingDrink && drink.id === this.editingDrink.id) {
                    return false;
                }
                const existingNormalized = drink.name.toLowerCase().trim().replace(/\s+/g, ' ');
                return existingNormalized === normalizedName;
            });

            if (isDuplicate) {
                window.showToast('A drink with this name already exists in this cruise', 'error');
                // Re-enable submit button
                const submitBtn = document.querySelector('#edit-drink-form button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save Drink';
                }
                return;
            }

            const drink = {
                id: this.editingDrink?.id || this.generateId(),
                name: name,
                photo: this.editDrinkPhoto || this.editDrinkEmoji || this.editingDrink?.photo || null,
                photoFull: this.editDrinkPhotoFull || this.editingDrink?.photoFull || null,
                cruiseId: window.app.getCurrentCruise().id
            };

            await this.storage.saveDrink(drink);
            this.hideDrinkModal();
            window.showToast(this.editingDrink ? 'Drink updated!' : 'Drink created!', 'success');
            await this.render();
        } catch (error) {
            console.error('Error saving drink:', error);
            window.showToast('Error saving drink: ' + error.message, 'error');
        }
    }

    generateId() {
        return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }

    async getAppVersion() {
        try {
            const commitHashResponse = await fetch('commit_hash.txt');
            const buildDateResponse = await fetch('build_date.txt');

            if (commitHashResponse.ok && buildDateResponse.ok) {
                const fullCommitHash = (await commitHashResponse.text()).trim();
                const buildDate = (await buildDateResponse.text()).trim();

                // Validate we actually got a commit hash and not, e.g., the
                // index.html shell served as a fallback when offline. A real
                // git hash is hex and <= 40 chars; anything else is treated
                // as "dev" so we never render arbitrary HTML in the version
                // box (which previously caused a nested copy of the app to
                // appear there).
                const looksLikeHash = /^[0-9a-f]{7,40}$/i.test(fullCommitHash);
                if (!looksLikeHash) {
                    return 'dev';
                }

                const shortCommitHash = fullCommitHash.substring(0, 8);
                const repoUrl = `https://github.com/csm10495/booze-cruise/commit/${fullCommitHash}`;
                // buildDate is rendered as text via textContent below to be
                // safe even if a future fallback slips through.
                const safeBuildDate = buildDate.replace(/[<>&"']/g, '');
                return `<a href="${repoUrl}" target="_blank" rel="noopener noreferrer">${shortCommitHash}</a> @ ${safeBuildDate} UTC`;
            } else {
                return 'dev';
            }
        } catch (error) {
            console.warn('Could not read version files, assuming dev environment:', error);
            return 'dev';
        }
    }

    async updateAppVersionDisplay() {
        const appVersionElement = document.getElementById('app-version');
        if (appVersionElement) {
            appVersionElement.innerHTML = await this.getAppVersion();
        }
    }

    // --- Update Now -------------------------------------------------------

    async runUpdateNow() {
        const btn = document.getElementById('update-now-btn');
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            window.showToast('No internet — connect and try again.', 'error', 4000);
            return;
        }
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Updating…';
        }

        try {
            // 1. Ask the active SW to drop its app caches (preserves the
            //    voice cache so the ~40 MB Vosk model isn't re-downloaded).
            await this._clearAppCacheViaSw();

            // 2. Tell the SW registration to look for a fresh sw.js. Our
            //    install handler skipWaiting()'s, so a newer SW will take
            //    over by the time the page reloads.
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration && registration.update) await registration.update();
                } catch (e) { /* non-fatal */ }
            }

            // 3. Reload from the server, bypassing the HTTP cache to make
            //    sure we don't get a stale bootstrap page.
            window.location.reload();
        } catch (e) {
            console.error('Update Now failed:', e);
            window.showToast('Update failed: ' + (e.message || e), 'error', 5000);
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Update';
            }
        }
    }

    _clearAppCacheViaSw() {
        return new Promise((resolve) => {
            if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
                // No SW controlling the page — nothing to clear via message.
                // Fall back to clearing caches directly from the page.
                if ('caches' in window) {
                    caches.keys().then((names) => Promise.all(
                        names
                            .filter((n) => n !== 'cruise-voice-v1')
                            .map((n) => caches.delete(n))
                    )).then(() => resolve()).catch(() => resolve());
                } else {
                    resolve();
                }
                return;
            }
            // Set up a one-shot reply listener with a timeout so we never
            // hang on a SW that doesn't reply.
            const channel = new MessageChannel();
            const timeout = setTimeout(() => resolve(), 4000);
            channel.port1.onmessage = (event) => {
                clearTimeout(timeout);
                resolve();
            };
            try {
                navigator.serviceWorker.controller.postMessage(
                    { type: 'CLEAR_APP_CACHE' },
                    [channel.port2]
                );
            } catch (e) {
                clearTimeout(timeout);
                resolve();
            }
        });
    }

    // --- Voice Input controls ---------------------------------------------

    setupVoiceInputControls() {
        const toggle = document.getElementById('voice-offline-toggle');
        if (!toggle) return;

        this._refreshVoiceStatus();

        // Reflect persisted state on the toggle.
        const enabledFlag = window.VoskInstaller
            ? localStorage.getItem(window.VoskInstaller.localStorageKey) === 'true'
            : false;
        toggle.checked = enabledFlag;

        toggle.addEventListener('change', (e) => this._onVoiceToggleChange(e));

        // Keep status live if the user goes online/offline while on this page.
        if (!this._voiceOnlineListenerAttached) {
            window.addEventListener('online', () => this._refreshVoiceStatus());
            window.addEventListener('offline', () => this._refreshVoiceStatus());
            this._voiceOnlineListenerAttached = true;
        }
    }

    async _refreshVoiceStatus() {
        const statusEl = document.getElementById('voice-status-line');
        if (!statusEl) return;

        const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        const onLine = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
        const installed = window.VoskInstaller ? await window.VoskInstaller.isInstalled() : false;

        let line;
        if (installed) {
            line = '✅ Offline voice is ready — works without internet.';
        } else if (supported && onLine) {
            line = '🌐 Online voice is available via the browser (requires internet).';
        } else if (supported && !onLine) {
            line = '⚠️ You are offline. Enable offline voice below to use voice without internet.';
        } else {
            line = '❌ Voice input is not supported in this browser.';
        }
        statusEl.textContent = line;
    }

    async _onVoiceToggleChange(event) {
        const toggle = event.target;
        const turningOn = toggle.checked;

        if (!window.VoskInstaller) {
            window.showToast('Voice components missing — try reloading.', 'error');
            toggle.checked = false;
            return;
        }

        if (turningOn) {
            // Make sure the user knows about the download size before we
            // start eating bandwidth.
            const confirmed = confirm(
                'Download the offline voice model? About 40 MB will be downloaded once and stored on this device.'
            );
            if (!confirmed) {
                toggle.checked = false;
                return;
            }

            const progressBox = document.getElementById('voice-download-progress');
            const fill = progressBox && progressBox.querySelector('.voice-progress-fill');
            const text = progressBox && progressBox.querySelector('.voice-progress-text');
            if (progressBox) progressBox.style.display = 'block';
            toggle.disabled = true;

            try {
                await window.VoskInstaller.install({
                    onProgress: (frac) => {
                        const pct = Math.max(0, Math.min(100, Math.round(frac * 100)));
                        if (fill) fill.style.width = pct + '%';
                        if (text) text.textContent = pct + '%';
                    }
                });
                window.showToast('Offline voice ready! Try the 🎤 button on Add Drink.', 'success', 4000);
            } catch (e) {
                console.error('Vosk install failed:', e);
                window.showToast('Download failed: ' + (e.message || 'unknown error'), 'error', 5000);
                toggle.checked = false;
                try { await window.VoskInstaller.uninstall(); } catch (cleanupErr) { /* ignore */ }
            } finally {
                toggle.disabled = false;
                if (progressBox) progressBox.style.display = 'none';
                if (fill) fill.style.width = '0%';
                if (text) text.textContent = '0%';
                this._refreshVoiceStatus();
            }
        } else {
            const confirmed = confirm('Remove the offline voice model (~40 MB) from this device?');
            if (!confirmed) {
                toggle.checked = true;
                return;
            }
            try {
                await window.VoskInstaller.uninstall();
                window.showToast('Offline voice removed.', 'info');
            } catch (e) {
                console.error('Vosk uninstall failed:', e);
                window.showToast('Could not remove offline voice: ' + e.message, 'error');
            } finally {
                this._refreshVoiceStatus();
            }
        }
    }
}

window.SettingsComponent = SettingsComponent;