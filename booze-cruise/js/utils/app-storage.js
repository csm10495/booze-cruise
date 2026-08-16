// This app is served from a subpath of an origin that hosts several other PWAs
// (e.g. https://csm10495.github.io/<app>/). localStorage — like CacheStorage in
// sw.js — is shared by the whole origin and ignores the path, so generic keys
// such as "activeTab" or "drinks" are read and overwritten by sibling apps.
// Every key this app writes is therefore namespaced with the subpath it is
// served from, and the app only ever touches keys carrying that namespace.
(function (global) {
    'use strict';

    // Mirrors APP_SCOPE_KEY in sw.js — keep the two in sync if the naming
    // scheme changes.
    const APP_SCOPE_KEY = new URL('./', document.baseURI).pathname
        .replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'root';
    const KEY_PREFIX = `${APP_SCOPE_KEY}:`;

    // Logical name -> key used by versions of this app that predate the
    // namespace. They are moved under the namespace once, on the first load
    // after updating, so no settings or offline data are lost. Values written
    // by a sibling app under the same generic names are indistinguishable from
    // ours, but this app has been overwriting them all along — moving them out
    // of the shared namespace ends the conflict in both directions.
    const LEGACY_KEYS = {
        activeTab: 'activeTab',
        rememberPageOnRefresh: 'rememberPageOnRefresh',
        selectedCruiseId: 'selectedCruiseId',
        'voice-offline-enabled': 'voice-offline-enabled',
        theme: 'cruise-drink-tracker-theme',
        'pending-cruise': 'cruise-drink-tracker-pending-cruise',
        cruises: 'cruises',
        people: 'people',
        drinks: 'drinks',
        drinkRecords: 'drinkRecords'
    };
    const MIGRATION_KEY = 'storage-namespaced';

    function scopedKey(name) {
        return `${KEY_PREFIX}${name}`;
    }

    function migrateLegacyKeys() {
        try {
            if (localStorage.getItem(scopedKey(MIGRATION_KEY)) === 'true') return;

            Object.keys(LEGACY_KEYS).forEach((name) => {
                const legacyKey = LEGACY_KEYS[name];
                const legacyValue = localStorage.getItem(legacyKey);
                if (legacyValue === null) return;

                // Anything already written under the namespace wins — it is
                // newer than the pre-namespace value by definition.
                if (localStorage.getItem(scopedKey(name)) === null) {
                    localStorage.setItem(scopedKey(name), legacyValue);
                }
                localStorage.removeItem(legacyKey);
            });

            localStorage.setItem(scopedKey(MIGRATION_KEY), 'true');
        } catch (error) {
            // Private browsing, a full quota, or storage being blocked entirely:
            // the app still works, it just starts from defaults.
            console.warn('Could not migrate pre-namespace storage keys:', error);
        }
    }

    const AppStorage = {
        // Exposed for tests/debugging and so callers can build a key without
        // hardcoding the separator.
        prefix: KEY_PREFIX,
        key: scopedKey,
        getItem(name) {
            return localStorage.getItem(scopedKey(name));
        },
        setItem(name, value) {
            localStorage.setItem(scopedKey(name), value);
        },
        removeItem(name) {
            localStorage.removeItem(scopedKey(name));
        }
    };

    migrateLegacyKeys();

    global.AppStorage = AppStorage;
})(window);
