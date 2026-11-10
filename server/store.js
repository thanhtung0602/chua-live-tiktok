import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeState } from './defaults.js';

const clone = (value) => structuredClone(value);

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.state = normalizeState(JSON.parse(await readFile(this.filePath, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[store] Không đọc được state cũ, tạo state mới:', error.message);
      const defaultSeedPath = path.join(path.dirname(this.filePath), 'state.default.json');
      try {
        this.state = normalizeState(JSON.parse(await readFile(defaultSeedPath, 'utf8')));
      } catch {
        this.state = normalizeState();
      }
      await this.#write();
    }
    return this.getState();
  }

  getState() {
    return clone(this.state);
  }

  async mutate(mutator) {
    const job = this.writeQueue.then(async () => {
      const next = normalizeState(this.state);
      await mutator(next);
      next.meta.updatedAt = new Date().toISOString();
      this.state = next;
      await this.#write();
      return this.getState();
    });
    this.writeQueue = job.catch(() => undefined);
    return job;
  }

  async #write() {
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(this.state, null, 2), 'utf8');
    await rename(temporary, this.filePath);
  }

  async close() {}
}

export async function createStore({ dataPath, sqlConfig }) {
  if (sqlConfig?.server) {
    const { SqlStore } = await import('./sql-store.js');
    const store = new SqlStore(sqlConfig);
    await store.init();
    return store;
  }
  const store = new JsonStore(dataPath);
  await store.init();
  return store;
}
