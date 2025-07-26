// Theme Manager - Handles theme switching and customization
class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.useDeviceTheme = false;
        this.deviceThemeMediaQuery = null;
        this.themes = {
            light: {
                name: 'Light',
                variables: {
                    '--primary-color': '#2196F3',
                    '--secondary-color': '#FFC107',
                    '--background-color': '#f4f7f6',
                    '--text-color': '#333',
                    '--light-text-color': '#666',
                    '--border-color': '#ddd',
                    '--card-background': '#ffffff',
                    '--shadow-color': 'rgba(0, 0, 0, 0.1)'
                }
            },
            dark: {
                name: 'Dark',
                variables: {
                    '--primary-color': '#90CAF9',
                    '--secondary-color': '#FFAB40',
                    '--background-color': '#121212',
                    '--text-color': '#E0E0E0',
                    '--light-text-color': '#B0B0B0',
                    '--border-color': '#333333',
                    '--card-background': '#1E1E1E',
                    '--shadow-color': 'rgba(255, 255, 255, 0.05)'
                }
            },
            ocean: {
                name: 'Ocean',
                variables: {
                    '--primary-color': '#007BFF',
                    '--secondary-color': '#17A2B8',
                    '--background-color': '#E0F2F7',
                    '--text-color': '#2C3E50',
                    '--light-text-color': '#5D6D7E',
                    '--border-color': '#A7D9ED',
                    '--card-background': '#FFFFFF',
                    '--shadow-color': 'rgba(0, 123, 255, 0.1)'
                }
            },
            device: {
                name: 'Use Device Theme',
                variables: {} // Will be populated based on device preference
            }
        };
    }

    init() {
        // Load saved theme
        const savedTheme = localStorage.getItem('cruise-drink-tracker-theme');
        if (savedTheme) {
            try {
                const themeData = JSON.parse(savedTheme);
                if (themeData.type === 'preset') {
                    this.setTheme(themeData.name);
                } else if (themeData.type === 'device') {
                    this.setDeviceTheme();
                }
            } catch (error) {
                console.error('Error loading saved theme:', error);
                this.setTheme('light');
            }
        } else {
            this.setTheme('light');
        }
    }

    setTheme(themeName) {
        if (themeName === 'device') {
            this.setDeviceTheme();
            return;
        }

        if (!this.themes[themeName]) {
            console.error('Theme not found:', themeName);
            return;
        }

        // Disable device theme mode when setting a specific theme
        this.useDeviceTheme = false;

        const theme = this.themes[themeName];
        const root = document.documentElement;

        // Remove existing theme classes
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-ocean', 'theme-device');

        // Add new theme class
        document.body.classList.add(`theme-${themeName}`);

        // Apply CSS variables
        Object.entries(theme.variables).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });

        this.currentTheme = themeName;

        // Save theme preference
        localStorage.setItem('cruise-drink-tracker-theme', JSON.stringify({
            type: 'preset',
            name: themeName
        }));

        // Dispatch theme change event
        this.dispatchThemeChangeEvent(themeName, theme.variables);
    }

    setCustomTheme(variables) {
        // Disable device theme mode when setting a custom theme
        this.useDeviceTheme = false;

        const root = document.documentElement;

        // Remove existing theme classes
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-ocean', 'theme-device');
        document.body.classList.add('theme-custom');

        // Apply custom CSS variables
        Object.entries(variables).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });

        this.currentTheme = 'custom';
        this.customTheme = variables;

        // Update the custom theme in themes object for preview
        this.themes.custom.variables = { ...variables };

        // Save custom theme
        localStorage.setItem('cruise-drink-tracker-theme', JSON.stringify({
            type: 'custom',
            variables: variables
        }));

        // Dispatch theme change event
        this.dispatchThemeChangeEvent('custom', variables);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    getAvailableThemes() {
        return Object.keys(this.themes).map(key => ({
            key,
            name: this.themes[key].name
        }));
    }

    getThemeVariables(themeName) {
        return this.themes[themeName]?.variables || null;
    }

    getCurrentThemeVariables() {
        return this.themes[this.currentTheme]?.variables || {};
    }



    convertToHex(color) {
        // Convert various color formats to hex
        if (color.startsWith('#')) {
            return color;
        }

        if (color.startsWith('rgb')) {
            // Simple rgb to hex conversion
            const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            }
        }

        // Default fallback
        return '#000000';
    }

    dispatchThemeChangeEvent(themeName, variables) {
        const event = new CustomEvent('themeChanged', {
            detail: {
                theme: themeName,
                variables: variables
            }
        });
        document.dispatchEvent(event);
    }

    // Export theme configuration
    exportTheme() {
        return {
            current: this.currentTheme,
            variables: this.getCurrentThemeVariables()
        };
    }

    // Import theme configuration
    importTheme(themeData) {
        if (this.themes[themeData.current]) {
            this.setTheme(themeData.current);
        } else {
            console.warn('Invalid theme data for import');
            this.setTheme('light');
        }
    }

    // Get theme preview
    getThemePreview(themeName) {
        let theme = this.themes[themeName];
        if (!theme) return null;

        // For device theme, use the current system preference
        if (themeName === 'device') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const deviceTheme = prefersDark ? 'dark' : 'light';
            theme = { ...theme, variables: this.themes[deviceTheme].variables };
        }

        // If no variables available, skip preview
        if (!theme.variables || Object.keys(theme.variables).length === 0) {
            return null;
        }

        const preview = document.createElement('div');
        preview.className = 'theme-preview';
        preview.style.cssText = `
            display: flex;
            width: 100%;
            height: 60px;
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid ${theme.variables['--border-color'] || '#ddd'};
            cursor: pointer;
        `;

        // Create color swatches
        const colors = [
            theme.variables['--primary-color'],
            theme.variables['--secondary-color'],
            theme.variables['--background-color'],
            theme.variables['--card-background']
        ];

        colors.forEach(color => {
            if (color) {
                const swatch = document.createElement('div');
                swatch.style.cssText = `
                    flex: 1;
                    background-color: ${color};
                `;
                preview.appendChild(swatch);
            }
        });

        preview.addEventListener('click', () => {
            this.setTheme(themeName);
        });

        return preview;
    }

    // Device theme methods
    setDeviceTheme() {
        this.useDeviceTheme = true;
        this.currentTheme = 'device';

        // Set up media query listener
        if (!this.deviceThemeMediaQuery) {
            this.deviceThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.deviceThemeMediaQuery.addEventListener('change', () => {
                if (this.useDeviceTheme) {
                    this.applyDeviceTheme();
                }
            });
        }

        this.applyDeviceTheme();

        // Save device theme preference
        localStorage.setItem('cruise-drink-tracker-theme', JSON.stringify({
            type: 'device'
        }));
    }

    applyDeviceTheme() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const themeToApply = prefersDark ? 'dark' : 'light';

        const theme = this.themes[themeToApply];
        const root = document.documentElement;

        // Remove existing theme classes
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-ocean');

        // Add device theme class and the actual theme class
        document.body.classList.add('theme-device', `theme-${themeToApply}`);

        // Apply CSS variables
        Object.entries(theme.variables).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });

        // Update device theme variables
        this.themes.device.variables = { ...theme.variables };

        // Dispatch theme change event
        this.dispatchThemeChangeEvent('device', theme.variables);
    }

    isUsingDeviceTheme() {
        return this.useDeviceTheme;
    }

    getDevicePreferredTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

}

window.ThemeManager = ThemeManager;