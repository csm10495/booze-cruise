# Booze Cruise 🍹

A Progressive Web App (PWA) for tracking drinks during your cruise with full offline functionality.

## Features

- ⚡ **Quick Drink Tracking**: Easily log your drinks with just a few taps
- 📊 **Analytics Dashboard**: View your drinking patterns and statistics
- 🌐 **Offline Support**: Full functionality even without internet connection
- 📱 **PWA Features**: Install as a native app on any device
- 🎨 **Theme Support**: Customizable interface themes
- 📸 **Photo Integration**: Capture and save drink photos

## Quick Start

1. Visit the app in your browser
2. Click "Install" in the settings to add it to your device (optional)
3. Start tracking your cruise drinks!

## Technical Details

- Built as a Progressive Web App (PWA)
- Pure vanilla JavaScript with no external dependencies (except Chart.js for analytics)
- Local storage for offline data persistence
- Modern responsive design with CSS Grid and Flexbox
- Service Worker for offline functionality

## Development

To run locally:

```bash
# Using Python's built-in HTTP server
python -m http.server 8000

# Or any other static file server
```

Then visit `http://localhost:8000/booze-cruise` in your browser.

## Project Structure

```
├── booze-cruise/        # Contains all website code
│   ├── css/              # Stylesheets
│   │   ├── main.css     # Core styles
│   │   ├── themes.css   # Theme definitions
│   │   └── components.css # Component-specific styles
│   ├── js/
│   │   ├── app.js      # Main application logic
│   │   ├── storage.js  # Data persistence
│   │   ├── components/ # UI components
│   │   └── utils/      # Utility functions
│   └── lib/            # External libraries
│       └── chart.min.js # Chart.js library
├── .github/            # GitHub Actions workflows
├── .gitignore          # Git ignore file
├── LICENSE             # Project license
├── README.md           # This README file
└── initial_prompt.txt  # Initial prompt for the project
```

## License

MIT License - Copyright (c) 2025 Charles Machalow

See [LICENSE](LICENSE) for details.