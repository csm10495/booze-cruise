# Booze Cruise 🍹

A Progressive Web App (PWA) for tracking drinks during your cruise with full offline functionality.

## Features

- ⚡ **Quick Drink Tracking**: Log a drink for one or many people in a few taps
- 🎤 **Voice Quick Add**: Hold the mic and say "Coke for Matt and Gina" — the form is pre-filled, then you submit
  - Works online via the browser's Web Speech API (Chrome / Edge / Safari)
  - Works fully offline via an opt-in [Vosk](https://alphacephei.com/vosk/) model download (~40 MB, one-time, cached on device)
- 📊 **Analytics Dashboard**: Bar charts and tables of drinks per person per day, with photo previews
- 🌐 **Offline Support**: Full functionality without internet — service worker uses a cache-first strategy so loads stay snappy on flaky connections
- 📱 **PWA Features**: Install to your home screen as a native app
- 🚢 **Multiple Cruises**: Add, switch, and set a default cruise from Settings
- 🎨 **Theme Support**: Customizable interface themes
- 📸 **Photo Integration**: Capture and save per-drink, per-person, per-cruise photos
- ♻️ **Import / Export**: One-click JSON export and import of all data
- 🔄 **Update Now**: Force-refresh the app from Settings (preserves the offline voice model)

## Quick Start

1. Visit the app in your browser
2. Click "Install" in Settings to add it to your device (optional but recommended)
3. Add at least one person and one drink in Settings
4. Open **Add Drink**, tap a person, tap a drink, hit Submit — or hold the 🎤 button and dictate

### Voice Quick Add

The example phrase shown next to the mic is built from drinks and people that
actually exist in your current cruise. Push-to-talk: hold, speak, release. The
form is pre-filled with the recognized drink + person(s); you confirm by
tapping Submit.

To use voice input offline, open Settings → Voice Input → enable the
"Offline voice recognition" toggle. This downloads a small English model
(~40 MB) once. The model is stored in a dedicated browser cache that survives
app updates.

## Technical Details

- Pure vanilla JavaScript — no build step
- Local storage + IndexedDB for offline data persistence
- Service worker with cache-first strategy and a separate cache for the
  optional voice model (so app-cache version bumps don't blow away the 40 MB)
- Scoped to its own subpath: the manifest (`id`, `start_url`, `scope`) and the
  service worker registration are limited to the directory the app is served
  from, and the caches it creates are namespaced with that subpath. The worker
  only ever reads and deletes caches it owns, so installing this app can't
  capture navigations for — or wipe the offline caches of — other PWAs hosted
  on the same origin (e.g. other apps on `csm10495.github.io`)
- Modern responsive design with CSS Grid and Flexbox

## Development

To run locally:

```bash
# From the repository root, using Python's built-in HTTP server
python -m http.server 8000
```

Then visit `http://localhost:8000/booze-cruise/` in your browser.

## Project Structure

```
├── booze-cruise/                # Web app
│   ├── css/                     # Stylesheets
│   │   ├── main.css
│   │   ├── themes.css
│   │   └── components.css
│   ├── js/
│   │   ├── app.js               # Main application controller
│   │   ├── storage.js           # Data persistence
│   │   ├── components/          # UI components (add-drink, analytics, settings, navigation)
│   │   └── utils/               # Themes, photos, exporter, voice (parser/engine/UI)
│   ├── lib/
│   │   └── chart.min.js         # Chart.js (bundled)
│   ├── sw.js                    # Service worker
│   ├── manifest.json
│   └── index.html
├── .github/                     # GitHub Pages workflow
├── LICENSE                      # Booze Cruise license (MIT)
├── THIRD_PARTY_LICENSES.md      # Attributions for bundled / runtime-loaded code
└── README.md
```

## License

Booze Cruise is distributed under the **MIT License** — see [LICENSE](LICENSE).

This project also bundles or downloads third-party software at runtime:

- **Chart.js** (MIT) — bundled at `booze-cruise/lib/chart.min.js`
- **vosk-browser** (Apache 2.0) — loaded from a CDN when the user opts in to offline voice
- **Vosk small English model** `vosk-model-small-en-us-0.15` (Apache 2.0) — downloaded when the user opts in to offline voice

Full attributions, license texts, and source URLs are in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).