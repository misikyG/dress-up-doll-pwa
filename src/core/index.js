// core/index.js
class DressingCore {
  constructor() {
    this.db = null
    this.dbName = 'DressingGameDB'
    this.version = 5
  }

  async init() {
    if (this.db) return;
    try {
      this.db = await this.openDB()
    } catch (error) {
      console.error('❌ IndexedDB 初始化失敗:', error)
      throw error;
    }
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)
      
      request.onerror = (event) => reject(`IndexedDB 錯誤: ${event.target.errorCode}`);
      request.onsuccess = (event) => resolve(event.target.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result

        if (db.objectStoreNames.contains('items')) {
          db.deleteObjectStore('items');
        }
        const itemStore = db.createObjectStore('items', { keyPath: 'id' })
        itemStore.createIndex('category', 'category', { unique: false })
        itemStore.createIndex('packId', 'packId', { unique: false })
        
        if (db.objectStoreNames.contains('outfits')) {
            db.deleteObjectStore('outfits');
        }
        const outfitStore = db.createObjectStore('outfits', { keyPath: 'id' })
        outfitStore.createIndex('createdAt', 'createdAt', { unique: false })

        if (db.objectStoreNames.contains('packs')) {
            db.deleteObjectStore('packs');
        }
        const packStore = db.createObjectStore('packs', { keyPath: 'id' })
        packStore.createIndex('importedAt', 'importedAt', { unique: false })

        if (db.objectStoreNames.contains('theme')) {
            db.deleteObjectStore('theme');
        }
        const themeStore = db.createObjectStore('theme', { keyPath: 'id' })

        // 添加 settings store 用於應用程式狀態緩存
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' })
        }
      }
    })
  }
  
  _createTransaction(storeName, mode = 'readonly') {
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- 通用 CRUD 操作 ---
  async saveData(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = this._createTransaction(storeName, 'readwrite');
      const request = store.put({ ...data, updatedAt: new Date().toISOString() });
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getAllData(storeName) {
    return new Promise((resolve, reject) => {
      const store = this._createTransaction(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async deleteData(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = this._createTransaction(storeName, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getData(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = this._createTransaction(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // setData 別名，用於更明確的語義
  async setData(storeName, id, data) {
    return this.saveData(storeName, { ...data, id });
  }

  // --- 刪除圖包邏輯 ---
  async deletePackAndItems(packId) {
    await this.deleteData('packs', packId);

    const allItems = await this.getAllData('items');
    const itemsToDelete = allItems.filter(item => item.packId === packId);
    
    if (itemsToDelete.length === 0) return true;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('items', 'readwrite');
      const itemStore = transaction.objectStore('items');
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (event) => reject(event.target.error);
      
      for (const item of itemsToDelete) {
        itemStore.delete(item.id);
      }
    });
  }
  
  async clearAllData() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['items', 'outfits', 'packs'], 'readwrite');
      const stores = ['items', 'outfits', 'packs'];
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (event) => reject(event.target.error);
      
      stores.forEach(storeName => {
        transaction.objectStore(storeName).clear();
      });
    });
  }
}

export default new DressingCore();