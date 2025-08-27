class DressingCore {
  constructor() {
    this.db = null
    this.dbName = 'DressingGameDB'
    this.version = 2 // **重要：版本號必須增加！** 這樣 onupgradeneeded 才會觸發
  }

  async init() {
    if (this.db) return;
    try {
      this.db = await this.openDB()
      console.log('✅ IndexedDB 初始化完成')
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
        console.log(`🔄 IndexedDB 升級至版本 ${this.version}...`)
        const db = event.target.result
        const transaction = event.target.transaction;

        // **升級 Items 表**
        if (db.objectStoreNames.contains('items')) {
          db.deleteObjectStore('items');
        }
        const itemStore = db.createObjectStore('items', { keyPath: 'id' }) // 主鍵改為 id
        itemStore.createIndex('category', 'category', { unique: false })
        itemStore.createIndex('packId', 'packId', { unique: false })
        console.log('✅ objectStore "items" 已更新');
        
        // **升級 Outfits 表**
        // Outfits 原本就是 autoIncrement，但我們改成手動管理ID以保持一致
        if (db.objectStoreNames.contains('outfits')) {
            db.deleteObjectStore('outfits');
        }
        const outfitStore = db.createObjectStore('outfits', { keyPath: 'id' })
        outfitStore.createIndex('createdAt', 'createdAt', { unique: false })
        console.log('✅ objectStore "outfits" 已更新');

        // **升級 Packs 表**
        if (db.objectStoreNames.contains('packs')) {
            db.deleteObjectStore('packs');
        }
        const packStore = db.createObjectStore('packs', { keyPath: 'id' }) // 主鍵改為 id
        packStore.createIndex('importedAt', 'importedAt', { unique: false })
        console.log('✅ objectStore "packs" 已更新');
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
      const request = store.put({ ...data, updatedAt: new Date().toISOString() }); // 使用 put 進行新增或更新
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

  // --- 刪除圖包的特殊邏輯 ---
  async deletePackAndItems(packId) {
    await this.deleteData('packs', packId);

    const allItems = await this.getAllData('items');
    const itemsToDelete = allItems.filter(item => item.packId === packId);
    
    const transaction = this.db.transaction('items', 'readwrite');
    const itemStore = transaction.objectStore('items');
    for (const item of itemsToDelete) {
      itemStore.delete(item.id);
    }
    
    console.log(`🗑️ 已刪除圖包 "${packId}" 及其 ${itemsToDelete.length} 個物件`);
    return true;
  }
  
  async clearAllData() { /* ... 此函式保持不變 ... */ }
}

export default new DressingCore();