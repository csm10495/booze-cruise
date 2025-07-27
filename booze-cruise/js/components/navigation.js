// Navigation Manager - Handles bottom navigation
class NavigationManager {
    constructor() {
        this.navItems = null;
        this.currentPage = 'add-drink-page';
    }

    init() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.setupEventListeners();
        // Do not navigate here; app.js will handle initial navigation and highlight
    }

    setupEventListeners() {
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = item.getAttribute('data-page');
                this.navigateToPage(targetPage);
            });
        });
    }

    async navigateToPage(pageId) {
        try {
            // Update active nav item
            this.navItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-page') === pageId) {
                    item.classList.add('active');
                }
            });

            // Persist active tab only if setting is enabled
            if (localStorage.getItem('rememberPageOnRefresh') !== 'false') {
                localStorage.setItem('activeTab', pageId);
            }

            // Load the page content
            if (window.app && window.app.isInitialized()) {
                await window.app.loadPage(pageId);
                this.currentPage = pageId;
            } else {
                // If app isn't fully initialized yet, try direct page switching
                console.log('App not yet initialized, attempting direct navigation');
                this.switchPageDirectly(pageId);
                this.currentPage = pageId;
            }
        } catch (error) {
            console.error('Navigation error:', error);
            window.showToast('Navigation error: ' + error.message, 'error');
        }
    }

    getCurrentPage() {
        return this.currentPage;
    }

    setActivePage(pageId) {
        this.currentPage = pageId;
        this.navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            }
        });
    }

    switchPageDirectly(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Show selected page
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');

            // Try to render content if components are available
            try {
                switch (pageId) {
                    case 'add-drink-page':
                        if (window.addDrinkComponent) {
                            window.addDrinkComponent.render();
                        }
                        break;
                    case 'analytics-page':
                        if (window.analyticsComponent) {
                            window.analyticsComponent.render();
                        }
                        break;
                    case 'settings-page':
                        if (window.settingsComponent) {
                            window.settingsComponent.render();
                        }
                        break;
                }
            } catch (error) {
                console.log('Could not render component content yet:', error);
            }
        }
    }
}

window.NavigationManager = NavigationManager;