import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonStore } from '../server/store.js';

test('JsonStore khởi tạo tệp mới với defaultState khi chưa có tệp', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'temple-store-test-'));
  const filePath = path.join(tempDir, 'state.json');

  try {
    const store = new JsonStore(filePath);
    const state = await store.init();

    assert.ok(state);
    assert.equal(state.settings.maxCharacters, 18);
    assert.equal(Array.isArray(state.gifts), true);
    assert.equal(state.gifts.length >= 5, true);
    assert.equal(state.metrics.totalLikes, 0);

    // Kiểm tra mutate
    await store.mutate((s) => {
      s.settings.maxCharacters = 20;
      s.metrics.totalLikes = 42;
    });

    const updated = store.getState();
    assert.equal(updated.settings.maxCharacters, 20);
    assert.equal(updated.metrics.totalLikes, 42);

    // Khởi tạo lại store từ tệp đã lưu để kiểm tra persistence
    const reloadedStore = new JsonStore(filePath);
    const reloadedState = await reloadedStore.init();
    assert.equal(reloadedState.settings.maxCharacters, 20);
    assert.equal(reloadedState.metrics.totalLikes, 42);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
