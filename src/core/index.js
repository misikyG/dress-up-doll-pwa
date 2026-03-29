class DressingCore {
  constructor() {
    this.db = null;
    this.dbName = 'DressingGameDB';
    this.version = 5;
  }

  async init() {
    if (this.db) return;
    this.db = await this._openDB();
  }

  _openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror = () => reject(new Error('IndexedDB 開啟失敗'));
      request.onsuccess = (e) => resolve(e.target.result);
      request.onupgradeneeded = (e) => this._setupStores(e.target.result);
    });
  }

  _setupStores(db) {
    const storeConfigs = [
      { name: 'items', indexes: [['category', false], ['packId', false]] },
      { name: 'outfits', indexes: [['createdAt', false]] },
      { name: 'packs', indexes: [['importedAt', false]] },
      { name: 'theme', indexes: [] },
      { name: 'settings', indexes: [] }
    ];
    storeConfigs.forEach(({ name, indexes }) => {
      if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
      const store = db.createObjectStore(name, { keyPath: 'id' });
      indexes.forEach(([indexName, unique]) => store.createIndex(indexName, indexName, { unique }));
    });
  }

  _getStore(storeName, mode = 'readonly') {
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  _wrapRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveData(storeName, data) {
    const store = this._getStore(storeName, 'readwrite');
    return this._wrapRequest(store.put({ ...data, updatedAt: new Date().toISOString() }));
  }

  async getAllData(storeName) {
    return this._wrapRequest(this._getStore(storeName).getAll());
  }

  async deleteData(storeName, id) {
    return this._wrapRequest(this._getStore(storeName, 'readwrite').delete(id));
  }

  async getData(storeName, id) {
    return this._wrapRequest(this._getStore(storeName).get(id));
  }

  async setData(storeName, id, data) {
    return this.saveData(storeName, { ...data, id });
  }

  async deletePackAndItems(packId) {
    await this.deleteData('packs', packId);
    const items = await this.getAllData('items');
    const tx = this.db.transaction('items', 'readwrite');
    const store = tx.objectStore('items');
    items.filter(i => i.packId === packId).forEach(i => store.delete(i.id));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllKeys(storeName) {
    return this._wrapRequest(this._getStore(storeName).getAllKeys());
  }

  async getAllItemsLightweight() {
    const store = this._getStore('items');
    return new Promise((resolve, reject) => {
      const items = [];
      const request = store.openCursor();
      request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const { imageData, variantImages, ...lightweight } = cursor.value;
          items.push(lightweight);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData() {
    const stores = ['items', 'outfits', 'packs'];
    const tx = this.db.transaction(stores, 'readwrite');
    stores.forEach(name => tx.objectStore(name).clear());
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
}

export default new DressingCore();