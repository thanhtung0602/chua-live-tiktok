import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveProvider } from '../server/live-provider.js';

test('LiveProvider: kết nối, ngắt kết nối và snapshot trạng thái', () => {
  const events = [];
  const statuses = [];
  const provider = new LiveProvider({
    name: 'Mock simulator',
    onEvent: (e) => events.push(e),
    onStatus: (s) => statuses.push(s)
  });

  assert.equal(provider.snapshot().status, 'disconnected');

  // Connect mock simulator
  const connected = provider.connect('my-channel');
  assert.equal(connected.status, 'simulated');
  assert.equal(connected.channel, 'my-channel');
  assert.equal(statuses.length, 1);

  // Disconnect
  const disconnected = provider.disconnect();
  assert.equal(disconnected.status, 'disconnected');
  assert.equal(statuses.length, 2);
});

test('LiveProvider: connect với webhook provider chuyển sang awaiting-webhook', () => {
  const provider = new LiveProvider({
    name: 'Authorized TikTok API',
    onEvent: () => {},
    onStatus: () => {}
  });

  const connected = provider.connect('tiktok-channel');
  assert.equal(connected.status, 'awaiting-webhook');
});

test('LiveProvider: setMode chuyển đổi linh hoạt giữa simulator, webhook và live', () => {
  const provider = new LiveProvider({
    name: 'tiktok-connector',
    onEvent: () => {},
    onStatus: () => {}
  });

  const sim = provider.setMode('simulator');
  assert.equal(sim.status, 'simulated');
  assert.equal(sim.mode, 'simulator');

  const hook = provider.setMode('webhook', '@camsisi0');
  assert.equal(hook.status, 'awaiting-webhook');
  assert.equal(hook.mode, 'webhook');
  assert.equal(hook.channel, '@camsisi0');
});

test('LiveProvider: ingest sự kiện hợp lệ và từ chối sự kiện không hợp lệ', async () => {
  const events = [];
  const provider = new LiveProvider({
    name: 'Mock simulator',
    onEvent: (e) => {
      events.push(e);
      return { processed: true };
    }
  });

  // Valid event types: like, gift, comment
  const rLike = await provider.ingest({ type: 'like', count: 5 });
  assert.equal(rLike.processed, true);
  assert.equal(events.length, 1);

  const rGift = await provider.ingest({ type: 'gift', giftId: 'lion' });
  assert.equal(rGift.processed, true);
  assert.equal(events.length, 2);

  const rComment = await provider.ingest({ type: 'comment', text: '!roi' });
  assert.equal(rComment.processed, true);
  assert.equal(events.length, 3);

  const rLeave = await provider.ingest({ type: 'leave', viewer: { id: 'u1', username: 'user1' } });
  assert.equal(rLeave.processed, true);
  assert.equal(events.length, 4);
  assert.equal(events[3].type, 'leave');

  const rFollow = await provider.ingest({ type: 'follow', viewer: { id: 'u2', username: 'user2' } });
  assert.equal(rFollow.processed, true);
  assert.equal(events.length, 5);
  assert.equal(events[4].type, 'follow');

  // Invalid event
  await assert.rejects(async () => {
    await provider.ingest({ type: 'unknown_type' });
  }, /Sự kiện LIVE không hợp lệ/);

  await assert.rejects(async () => {
    await provider.ingest(null);
  }, /Sự kiện LIVE không hợp lệ/);
});
