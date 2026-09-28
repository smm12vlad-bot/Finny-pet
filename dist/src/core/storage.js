import { normalizeState } from './state.js';

const STORAGE_KEY = 'finny-pet-state-v1';
const BACKUP_KEY = 'finny-pet-state-v1-backup';

export class GameStorage {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  load() {
    for (const key of [STORAGE_KEY, BACKUP_KEY]) {
      try {
        const value = this.storage?.getItem(key);
        if (value) return normalizeState(JSON.parse(value));
      } catch {
        // Поврежденное сохранение не должно блокировать запуск.
      }
    }
    return normalizeState(null);
  }

  save(state) {
    try {
      const previous = this.storage?.getItem(STORAGE_KEY);
      if (previous) this.storage?.setItem(BACKUP_KEY, previous);
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      this.storage?.removeItem(STORAGE_KEY);
      this.storage?.removeItem(BACKUP_KEY);
      return true;
    } catch {
      return false;
    }
  }
}

export class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}
