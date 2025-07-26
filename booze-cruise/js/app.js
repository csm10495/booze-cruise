// Main Application Controller
class DrinkTrackerApp {
    constructor() {
        this.storage = new StorageManager();
        this.navigation = new NavigationManager();
        this.photoManager = new PhotoManager();
        this.themeManager = new ThemeManager();
        this.currentCruise = null;
        this.initialized = false;
    }

    async init() {
        try {
            // Initialize storage
            await this.storage.init();

            // Load default cruise
            await this.loadDefaultCruise();

            // Initialize components
            this.navigation.init();
            this.themeManager.init();


            // Initialize page components
            window.addDrinkComponent = new AddDrinkComponent(this.storage);
            window.analyticsComponent = new AnalyticsComponent(this.storage);
            window.settingsComponent = new SettingsComponent(this.storage, this.themeManager);

            // Load initial page content
            await this.loadPage('add-drink-page');

            // Register service worker
            await this.registerServiceWorker();

            this.initialized = true;
            this.hideLoading();

            console.log('Booze Cruise initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showToast('Failed to initialize app: ' + error.message, 'error');
            this.hideLoading();
        }
    }

    async loadDefaultCruise() {
        try {
            const cruises = await this.storage.getAllCruises();
            if (cruises.length > 0) {
                // Check for pending cruise from import first
                const pendingCruiseId = localStorage.getItem('cruise-drink-tracker-pending-cruise');
                let selectedCruise = null;

                if (pendingCruiseId) {
                    selectedCruise = cruises.find(c => c.id === pendingCruiseId);
                    // Clear the pending cruise setting
                    localStorage.removeItem('cruise-drink-tracker-pending-cruise');
                }

                // If no pending cruise, always start with the default cruise
                if (!selectedCruise) {
                    selectedCruise = cruises.find(c => c.isDefault) || cruises[0];
                }

                this.currentCruise = selectedCruise;
            } else {
                // Create first cruise
                this.currentCruise = await this.createDefaultCruise();
            }

            this.updateCruiseDisplay();
        } catch (error) {
            console.error('Error loading default cruise:', error);
            throw error;
        }
    }

    async createDefaultCruise() {
        const cruise = {
            id: this.generateId(),
            name: 'My First Cruise',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            coverPhoto: null,
            isDefault: true
        };

        await this.storage.saveCruise(cruise);
        return cruise;
    }

    updateCruiseDisplay() {
        const cruiseElement = document.getElementById('current-cruise');
        if (cruiseElement && this.currentCruise) {
            cruiseElement.textContent = this.currentCruise.name;
        }
    }

    async loadPage(pageId) {
        try {
            // Hide all pages
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });

            // Show selected page
            const targetPage = document.getElementById(pageId);
            if (targetPage) {
                targetPage.classList.add('active');

                // Load page content
                switch (pageId) {
                    case 'add-drink-page':
                        await window.addDrinkComponent.render();
                        break;
                    case 'analytics-page':
                        await window.analyticsComponent.render();
                        break;
                    case 'settings-page':
                        await window.settingsComponent.render();
                        break;
                }
            }
        } catch (error) {
            console.error('Error loading page:', error);
            this.showToast('Error loading page: ' + error.message, 'error');
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered successfully:', registration);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    generateId() {
        return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast');
        const messageElement = toast.querySelector('.toast-message');

        if (toast && messageElement) {
            messageElement.textContent = message;
            toast.className = `toast show ${type}`;

            setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        }
    }

    showModal(imageSrc, caption = '') {
        const modal = document.getElementById('photo-modal');
        const modalImage = document.getElementById('modal-image');
        const modalCaption = modal.querySelector('.modal-caption');

        if (modal && modalImage) {
            modalImage.src = imageSrc;
            modalCaption.textContent = caption;
            modal.style.display = 'flex';
        }
    }

    hideModal() {
        const modal = document.getElementById('photo-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async switchCruise(cruiseId) {
        try {
            const cruise = await this.storage.getCruise(cruiseId);
            if (cruise) {
                this.currentCruise = cruise;

                // Save the selected cruise for persistence
                localStorage.setItem('selectedCruiseId', cruise.id);

                this.updateCruiseDisplay();

                // Refresh current page
                const activePage = document.querySelector('.page.active');
                if (activePage) {
                    await this.loadPage(activePage.id);
                }

                this.showToast('Switched to ' + cruise.name);
            }
        } catch (error) {
            console.error('Error switching cruise:', error);
            this.showToast('Error switching cruise: ' + error.message, 'error');
        }
    }

    getCurrentCruise() {
        return this.currentCruise;
    }

    isInitialized() {
        return this.initialized;
    }

}

// Global app instance
let app;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    app = new DrinkTrackerApp();

    // Expose app globally for components to access
    window.app = app;

    // Show loading
    app.showLoading();

    // Initialize app
    await app.init();

    // Set up modal close handlers
    const modal = document.getElementById('photo-modal');
    const closeBtn = modal.querySelector('.close');

    closeBtn.addEventListener('click', () => app.hideModal());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            app.hideModal();
        }
    });

    // Handle URL parameters for shortcuts
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');

    if (action === 'add-drink') {
        app.loadPage('add-drink-page');
    } else if (action === 'analytics') {
        app.loadPage('analytics-page');
    }
});

// Global utility functions
window.showToast = (message, type, duration) => window.app?.showToast(message, type, duration);
window.showModal = (imageSrc, caption) => window.app?.showModal(imageSrc, caption);
window.hideModal = () => window.app?.hideModal();