// Storage Manager - Handles IndexedDB with localStorage fallback
class StorageManager {
    constructor() {
        this.dbName = 'CruiseDrinkTracker';
        this.dbVersion = 1;
        this.db = null;
        this.useIndexedDB = true;
        this.stores = ['cruises', 'people', 'drinks', 'drinkRecords'];
    }

    async init() {
        try {
            // Try to initialize IndexedDB
            await this.initIndexedDB();
            console.log('Using IndexedDB for storage');
        } catch (error) {
            console.warn('IndexedDB not available, falling back to localStorage:', error);
            this.useIndexedDB = false;
            this.initLocalStorage();
        }
    }

    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB not supported'));
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create cruises store
                if (!db.objectStoreNames.contains('cruises')) {
                    const cruiseStore = db.createObjectStore('cruises', { keyPath: 'id' });
                    cruiseStore.createIndex('isDefault', 'isDefault', { unique: false });
                }

                // Create people store
                if (!db.objectStoreNames.contains('people')) {
                    const peopleStore = db.createObjectStore('people', { keyPath: 'id' });
                    peopleStore.createIndex('cruiseId', 'cruiseId', { unique: false });
                }

                // Create drinks store
                if (!db.objectStoreNames.contains('drinks')) {
                    const drinkStore = db.createObjectStore('drinks', { keyPath: 'id' });
                    drinkStore.createIndex('cruiseId', 'cruiseId', { unique: false });
                }

                // Create drink records store
                if (!db.objectStoreNames.contains('drinkRecords')) {
                    const recordStore = db.createObjectStore('drinkRecords', { keyPath: 'id' });
                    recordStore.createIndex('personId', 'personId', { unique: false });
                    recordStore.createIndex('drinkId', 'drinkId', { unique: false });
                    recordStore.createIndex('cruiseId', 'cruiseId', { unique: false });
                    recordStore.createIndex('date', 'date', { unique: false });
                }
            };
        });
    }

    initLocalStorage() {
        // Initialize localStorage structure if not exists
        this.stores.forEach(store => {
            if (!localStorage.getItem(store)) {
                localStorage.setItem(store, JSON.stringify([]));
            }
        });
    }

    // Generic CRUD operations
    async save(storeName, data) {
        if (this.useIndexedDB) {
            return this.saveToIndexedDB(storeName, data);
        } else {
            return this.saveToLocalStorage(storeName, data);
        }
    }

    async get(storeName, id) {
        if (this.useIndexedDB) {
            return this.getFromIndexedDB(storeName, id);
        } else {
            return this.getFromLocalStorage(storeName, id);
        }
    }

    async getAll(storeName) {
        if (this.useIndexedDB) {
            return this.getAllFromIndexedDB(storeName);
        } else {
            return this.getAllFromLocalStorage(storeName);
        }
    }

    async delete(storeName, id) {
        if (this.useIndexedDB) {
            return this.deleteFromIndexedDB(storeName, id);
        } else {
            return this.deleteFromLocalStorage(storeName, id);
        }
    }

    async getByIndex(storeName, indexName, value) {
        if (this.useIndexedDB) {
            return this.getByIndexFromIndexedDB(storeName, indexName, value);
        } else {
            return this.getByIndexFromLocalStorage(storeName, indexName, value);
        }
    }

    // IndexedDB operations
    async saveToIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    async getFromIndexedDB(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllFromIndexedDB(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFromIndexedDB(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndexFromIndexedDB(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // localStorage operations
    saveToLocalStorage(storeName, data) {
        const items = this.getAllFromLocalStorage(storeName);
        const existingIndex = items.findIndex(item => item.id === data.id);

        if (existingIndex >= 0) {
            items[existingIndex] = data;
        } else {
            items.push(data);
        }

        localStorage.setItem(storeName, JSON.stringify(items));
        return Promise.resolve(data);
    }

    getFromLocalStorage(storeName, id) {
        const items = this.getAllFromLocalStorage(storeName);
        return Promise.resolve(items.find(item => item.id === id));
    }

    getAllFromLocalStorage(storeName) {
        try {
            return JSON.parse(localStorage.getItem(storeName) || '[]');
        } catch (error) {
            console.error('Error parsing localStorage data:', error);
            return [];
        }
    }

    deleteFromLocalStorage(storeName, id) {
        const items = this.getAllFromLocalStorage(storeName);
        const filteredItems = items.filter(item => item.id !== id);
        localStorage.setItem(storeName, JSON.stringify(filteredItems));
        return Promise.resolve();
    }

    getByIndexFromLocalStorage(storeName, indexName, value) {
        const items = this.getAllFromLocalStorage(storeName);
        return Promise.resolve(items.filter(item => item[indexName] === value));
    }

    // Specific entity methods
    async saveCruise(cruise) {
        return this.save('cruises', cruise);
    }

    async getCruise(id) {
        return this.get('cruises', id);
    }

    async getAllCruises() {
        return this.getAll('cruises');
    }

    async deleteCruise(id) {
        // Also delete associated data
        const people = await this.getByIndex('people', 'cruiseId', id);
        const drinks = await this.getByIndex('drinks', 'cruiseId', id);
        const records = await this.getByIndex('drinkRecords', 'cruiseId', id);

        // Delete all associated records
        await Promise.all([
            ...people.map(p => this.delete('people', p.id)),
            ...drinks.map(d => this.delete('drinks', d.id)),
            ...records.map(r => this.delete('drinkRecords', r.id))
        ]);

        return this.delete('cruises', id);
    }

    async savePerson(person) {
        return this.save('people', person);
    }

    async getPerson(id) {
        return this.get('people', id);
    }

    async getPeopleForCruise(cruiseId) {
        return this.getByIndex('people', 'cruiseId', cruiseId);
    }

    async deletePerson(id) {
        // Delete associated drink records
        const records = await this.getByIndex('drinkRecords', 'personId', id);
        await Promise.all(records.map(r => this.delete('drinkRecords', r.id)));
        return this.delete('people', id);
    }

    async saveDrink(drink) {
        return this.save('drinks', drink);
    }

    async getDrink(id) {
        return this.get('drinks', id);
    }

    async getDrinksForCruise(cruiseId) {
        return this.getByIndex('drinks', 'cruiseId', cruiseId);
    }

    async deleteDrink(id) {
        return this.delete('drinks', id);
    }

    async saveDrinkRecord(record) {
        return this.save('drinkRecords', record);
    }

    async getDrinkRecord(id) {
        return this.get('drinkRecords', id);
    }

    async getDrinkRecordsForCruise(cruiseId) {
        return this.getByIndex('drinkRecords', 'cruiseId', cruiseId);
    }

    async getDrinkRecordsForPerson(personId) {
        return this.getByIndex('drinkRecords', 'personId', personId);
    }

    async getDrinkRecordsForDate(date) {
        return this.getByIndex('drinkRecords', 'date', date);
    }

    async getDrinkRecordsForDrink(drinkId) {
        return this.getByIndex('drinkRecords', 'drinkId', drinkId);
    }

    async deleteDrinkRecord(id) {
        return this.delete('drinkRecords', id);
    }

    // Data export/import
    async exportData() {
        const data = {
            version: 1,
            exportDate: new Date().toISOString(),
            cruises: await this.getAllCruises(),
            people: await this.getAll('people'),
            drinks: await this.getAll('drinks'),
            drinkRecords: await this.getAll('drinkRecords')
        };
        return data;
    }

    async importData(data) {
        if (!data.version || data.version !== 1) {
            throw new Error('Unsupported data format version');
        }

        // Clear existing data
        await this.clearAllData();

        // Import new data
        if (data.cruises) {
            for (const cruise of data.cruises) {
                await this.saveCruise(cruise);
            }
        }

        if (data.people) {
            for (const person of data.people) {
                await this.savePerson(person);
            }
        }

        if (data.drinks) {
            for (const drink of data.drinks) {
                await this.saveDrink(drink);
            }
        }

        if (data.drinkRecords) {
            for (const record of data.drinkRecords) {
                await this.saveDrinkRecord(record);
            }
        }
    }

    async clearAllData() {
        if (this.useIndexedDB) {
            for (const storeName of this.stores) {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                await new Promise((resolve, reject) => {
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
        } else {
            this.stores.forEach(store => {
                localStorage.setItem(store, JSON.stringify([]));
            });
        }
    }

    // Analytics helper methods
    async getAnalyticsData(cruiseId, startDate, endDate) {
        const records = await this.getDrinkRecordsForCruise(cruiseId);

        // Filter by date range if provided
        const filteredRecords = records.filter(record => {
            if (startDate && record.date < startDate) return false;
            if (endDate && record.date > endDate) return false;
            return true;
        });

        // Get additional data
        const people = await this.getPeopleForCruise(cruiseId);
        const drinks = await this.getDrinksForCruise(cruiseId);

        return {
            records: filteredRecords,
            people: people,
            drinks: drinks
        };
    }
}

window.StorageManager = StorageManager;