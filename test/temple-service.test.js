import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../server/defaults.js';
import { TempleService } from '../server/temple-service.js';

function makeStore(customState = {}) {
  let state = { ...defaultState(), ...customState };
  return {
    getState: () => structuredClone(state),
    async mutate(mutator) {
      await mutator(state);
      return structuredClone(state);
    },
    async close() {}
  };
}

function makeIo() {
  return { events: [], emit(name, payload) { this.events.push({ name, payload }); } };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('like định danh chỉ tạo một nhân vật, like ẩn danh chỉ cộng tổng', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  await temple.handleLike({ type: 'like', count: 2, viewer: { id: 'a-1', username: 'minh', nickname: 'Minh' } });
  await temple.handleLike({ type: 'like', count: 3, viewer: { id: 'a-1', username: 'minh', nickname: 'Minh' } });
  await temple.handleLike({ type: 'like', count: 4 });
  assert.equal(temple.presences.size, 1);
  assert.equal(temple.data.metrics.totalLikes, 9);
  assert.equal(temple.data.metrics.anonymousLikes, 4);
  temple.destroy();
});

test('tăng sức chứa tối đa lên 36 nhân vật và cấp đủ 36 slot bồ đoàn', async () => {
  const io = makeIo();
  const temple = new TempleService({ store: makeStore(), io });
  await temple.updateSettings({ maxCharacters: 36 });
  assert.equal(temple.activeLimit(), 36);

  for (let i = 0; i < 36; i++) {
    const res = await temple.handleLike({ type: 'like', viewer: { id: `pt_${i}`, username: `user_${i}` } });
    assert.equal(res.created, true);
    assert.equal(res.capacityReached, false);
  }
  assert.equal(temple.presences.size, 36);

  // Người thứ 37 gửi like -> cộng tim nhưng không tạo thêm nhân vật
  const res37 = await temple.handleLike({ type: 'like', viewer: { id: 'pt_37', username: 'user_37' } });
  assert.equal(res37.created, false);
  assert.equal(res37.capacityReached, true);
  assert.equal(temple.presences.size, 36);

  temple.destroy();
});

test('phát hiện người xem lướt khỏi live (leave event) hoặc ngưng hoạt động sau autoLeaveSeconds', async () => {
  const io = makeIo();
  const temple = new TempleService({ store: makeStore(), io });

  // 1. Người xem 1 gửi tim để vào chùa
  await temple.handleLike({ type: 'like', viewer: { id: 'user_swipe', username: 'UserSwipe' } });
  assert.equal(temple.presences.size, 1);
  assert.equal(temple.presences.get('user_swipe').state, 'entering');

  // Gửi sự kiện rời live (lướt đi)
  const leaveRes = await temple.handleEvent({ type: 'leave', viewer: { id: 'user_swipe' } });
  assert.equal(leaveRes.left, true);
  assert.equal(temple.presences.get('user_swipe').state, 'exiting');

  // 2. Người xem 2 vào chùa và tự động out sau autoLeaveSeconds
  await temple.updateSettings({ autoLeaveSeconds: 60 });
  await temple.handleLike({ type: 'like', viewer: { id: 'user_idle', username: 'UserIdle' } });
  assert.equal(temple.presences.get('user_idle').state, 'entering');

  // Chưa quá 60s -> chưa out
  temple.presences.get('user_idle').lastActiveAt = new Date(Date.now() - 30 * 1000).toISOString();
  temple.sweepInactive();
  assert.notEqual(temple.presences.get('user_idle').state, 'exiting');

  // Quá 60s -> tự động out
  temple.presences.get('user_idle').lastActiveAt = new Date(Date.now() - 65 * 1000).toISOString();
  temple.sweepInactive();
  assert.equal(temple.presences.get('user_idle').state, 'exiting');

  temple.destroy();
});

test('Chế độ Treo Live 24/7: cập nhật cấu hình liveProtection và kích hoạt giữ nhịp định kỳ khi phòng vắng', async () => {
  const io = makeIo();
  const temple = new TempleService({ store: makeStore(), io });

  // Kiểm tra cấu hình mặc định
  assert.equal(temple.data.settings.liveProtection.enabled, true);
  assert.equal(temple.data.settings.liveProtection.autoWorshipperEnabled, true);
  assert.equal(temple.data.settings.liveProtection.ambientSpeechEnabled, true);

  // Cập nhật cấu hình
  await temple.updateSettings({
    liveProtection: {
      enabled: true,
      intervalMinutes: 1,
      speechIntervalMinutes: 2
    }
  });
  assert.equal(temple.data.settings.liveProtection.intervalMinutes, 1);
  assert.equal(temple.data.settings.liveProtection.speechIntervalMinutes, 2);

  // Giả lập thời gian im ắng quá ngưỡng interval
  temple.lastWorshipperJoinAt = Date.now() - 120000;
  temple.lastActivityAt = Date.now() - 120000;
  temple.lastSpeechAt = Date.now() - 180000;

  assert.equal(temple.presences.size, 0);
  await temple.checkLiveProtection();

  // Đã tự động tạo 1 Phật tử ảo vào lễ Phật
  assert.equal(temple.presences.size, 1);
  const worshipper = [...temple.presences.values()][0];
  assert.ok(worshipper.id.startsWith('ambient_'));
  assert.equal(worshipper.state, 'entering');

  // Đã tự động phát biểu lời chúc an lạc
  const speechEvent = io.events.find(e => e.name === 'speech:announce' && e.payload?.type === 'ambient_blessing');
  assert.ok(speechEvent);
  assert.ok(speechEvent.payload.text.length > 10);

  // Đã cộng thêm tim để giữ nhịp mốc chuông
  assert.ok((temple.data.metrics.totalLikes || 0) > 0);

  temple.destroy();
});

test('Chế độ Treo Live 24/7: triggerLiveProtectionNow tạo ngay Phật tử, tim và lời chúc AI', async () => {
  const io = makeIo();
  const temple = new TempleService({ store: makeStore(), io });

  const result = await temple.triggerLiveProtectionNow();
  assert.ok(result.worshipper);
  assert.ok(result.likesAdded >= 8);
  assert.ok(result.speech);
  assert.equal(result.speech.type, 'ambient_blessing');

  assert.equal(temple.presences.size, 1);
  assert.ok(temple.data.metrics.totalLikes >= 8);

  temple.destroy();
});

test('quà có eventId trùng không được cộng hoặc xếp hàng lại', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  const event = { type: 'gift', eventId: 'gift-unique', giftId: 'lion', viewer: { id: 'giver-1', username: 'an' } };
  const first = await temple.handleGift(event);
  const duplicate = await temple.handleGift(event);
  assert.equal(first.queued, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(temple.data.metrics.totalGifts, 1);
  assert.equal(temple.currentGift?.gift.name, 'Sư Tử');
  temple.finishGift(first.id);
  temple.destroy();
});

test('rời chùa chuyển sang exiting trước khi giải phóng slot', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  await temple.handleLike({ type: 'like', viewer: { id: 'a-1', username: 'minh' } });
  assert.equal(temple.leavePresence('a-1', 'admin'), true);
  assert.equal(temple.presences.get('a-1').state, 'exiting');
  assert.equal(temple.presences.size, 1);
  temple.removePresence('a-1');
  assert.equal(temple.presences.size, 0);
  temple.destroy();
});

test('sức chứa tối đa: khi đạt maxCharacters không tạo thêm người mới nhưng vẫn cộng lượt tim', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  for (let i = 0; i < 18; i++) {
    const res = await temple.handleLike({ type: 'like', count: 1, viewer: { id: `u-${i}`, username: `user${i}` } });
    assert.equal(res.created, true);
  }
  assert.equal(temple.presences.size, 18);
  const overflow = await temple.handleLike({ type: 'like', count: 2, viewer: { id: 'u-19', username: 'user19' } });
  assert.equal(overflow.capacityReached, true);
  assert.equal(overflow.created, false);
  assert.equal(temple.presences.size, 18);
  assert.equal(temple.data.metrics.totalLikes, 20);
  temple.destroy();
});

test('hàng đợi quà ưu tiên quà priority cao hơn trước và FIFO khi cùng mức', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  // Bắt đầu với 1 quà đang diễn ra để chặn drainQueue tức thời
  await temple.handleGift({ type: 'gift', eventId: 'g-active', giftId: 'rose', viewer: { id: 'u0', username: 'u0' } });
  assert.equal(temple.currentGift?.gift.name, 'Hoa hồng');

  // Gửi 3 quà: Hoa hồng (priority 10), Sư Tử (priority 100), Hoa sen (priority 35)
  await temple.handleGift({ type: 'gift', eventId: 'g-rose-2', giftId: 'rose', viewer: { id: 'u1', username: 'u1' } });
  await temple.handleGift({ type: 'gift', eventId: 'g-lion', giftId: 'lion', viewer: { id: 'u2', username: 'u2' } });
  await temple.handleGift({ type: 'gift', eventId: 'g-lotus', giftId: 'lotus', viewer: { id: 'u3', username: 'u3' } });

  // Kiểm tra thứ tự hàng đợi
  assert.equal(temple.giftQueue.length, 3);
  assert.equal(temple.giftQueue[0].gift.name, 'Sư Tử'); // priority 100
  assert.equal(temple.giftQueue[1].gift.name, 'Hoa sen'); // priority 35
  assert.equal(temple.giftQueue[2].gift.name, 'Hoa hồng'); // priority 10
  temple.destroy();
});

test('người xem tạm thời được nâng cấp thành chính thức khi like và không bị mời rời sau khi quà kết thúc (BUG-02 fix)', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  const giftRes = await temple.handleGift({ type: 'gift', eventId: 'g-temp-like', giftId: 'rose', viewer: { id: 'temp-u', username: 'Temp' } });
  assert.equal(temple.presences.get('temp-u').temporary, true);

  // Người dùng like để chính thức ở lại chùa
  await temple.handleLike({ type: 'like', viewer: { id: 'temp-u', username: 'Temp' } });
  assert.equal(temple.presences.get('temp-u').temporary, false);

  // Hoàn tất quà
  temple.finishGift(giftRes.id);
  await sleep(500);

  // Người dùng vẫn phải ở lại chùa và không bị exiting
  const presence = temple.presences.get('temp-u');
  assert.ok(presence);
  assert.notEqual(presence.state, 'exiting');
  temple.destroy();
});

test('người xem tạm thời gửi nhiều quà liên tiếp không bị mời rời giữa chừng (BUG-03 fix)', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  const g1 = await temple.handleGift({ type: 'gift', eventId: 'g-multi-1', giftId: 'lion', viewer: { id: 'multi-giver', username: 'Multi' } });
  await temple.handleGift({ type: 'gift', eventId: 'g-multi-2', giftId: 'rose', viewer: { id: 'multi-giver', username: 'Multi' } });

  assert.equal(temple.giftQueue.length, 1);
  assert.equal(temple.currentGift.id, g1.id);

  // Kết thúc quà 1
  temple.finishGift(g1.id);
  await sleep(500);

  // Vì quà 2 còn trong hàng đợi, người xem KHÔNG được chuyển sang exiting
  assert.notEqual(temple.presences.get('multi-giver')?.state, 'exiting');
  assert.equal(temple.presences.get('multi-giver')?.state, 'praying');
  temple.destroy();
});

test('người xem đang exiting gửi quà được hủy hẹn giờ rời và phục hồi trạng thái praying (BUG-04 fix)', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  await temple.handleLike({ type: 'like', viewer: { id: 'exiter', username: 'Exiter' } });
  temple.leavePresence('exiter', 'admin');
  assert.equal(temple.presences.get('exiter').state, 'exiting');
  assert.ok(temple.presences.get('exiter').exitTimer);

  // Gửi quà trong lúc đang exiting
  const giftRes = await temple.handleGift({ type: 'gift', eventId: 'g-exiting', giftId: 'rose', viewer: { id: 'exiter', username: 'Exiter' } });
  assert.equal(giftRes.queued, true);

  // Kiểm tra đã được phục hồi về praying và exitTimer đã bị hủy
  const exiter = temple.presences.get('exiter');
  assert.equal(exiter.state, 'praying');
  assert.equal(exiter.exitTimer, null);

  // Chờ qua mốc 2200ms để chắc chắn không bị xóa
  await sleep(2200);
  assert.ok(temple.presences.get('exiter'));
  temple.destroy();
});

test('bình luận chứa từ khóa rời chùa kích hoạt leavePresence, bình luận thường không kích hoạt', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  await temple.handleLike({ type: 'like', viewer: { id: 'commenter', username: 'Commenter' } });

  // Bình luận chào hỏi bình thường
  const normal = await temple.handleComment({ type: 'comment', text: 'Nam mô A Di Đà Phật!', viewer: { id: 'commenter', username: 'Commenter' } });
  assert.equal(normal.left, false);
  assert.equal(temple.presences.get('commenter').state, 'entering');

  // Bình luận từ khóa rời chùa
  const leave = await temple.handleComment({ type: 'comment', text: 'Con xin !ROI chùa ạ', viewer: { id: 'commenter', username: 'Commenter' } });
  assert.equal(leave.left, true);
  assert.equal(temple.presences.get('commenter').state, 'exiting');
  temple.destroy();
});

test('tự động quét người xem không hoạt động sau autoLeaveMinutes', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  await temple.updateSettings({ autoLeaveMinutes: 10 });
  await temple.handleLike({ type: 'like', viewer: { id: 'sleeper', username: 'Sleeper' } });

  // Giả lập thời gian hoạt động cách đây 15 phút
  temple.presences.get('sleeper').lastActiveAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  temple.sweepInactive();

  assert.equal(temple.presences.get('sleeper').state, 'exiting');
  temple.destroy();
});

test('điều khiển playlist audio: play, pause, next, previous và chế độ lặp bài', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  const t1 = await temple.addTrack({ title: 'Bài kinh 1', filePath: '/uploads/audio/k1.mp3' });
  const t2 = await temple.addTrack({ title: 'Bài kinh 2', filePath: '/uploads/audio/k2.mp3' });

  // Play
  let audio = await temple.audioAction('play');
  assert.equal(audio.status, 'playing');
  assert.equal(audio.currentTrackId, t1.id);

  // Next
  audio = await temple.audioAction('next');
  assert.equal(audio.currentTrackId, t2.id);

  // Previous
  audio = await temple.audioAction('previous');
  assert.equal(audio.currentTrackId, t1.id);

  // Pause
  audio = await temple.audioAction('pause');
  assert.equal(audio.status, 'paused');

  // Repeat track mode on ended
  await temple.updateSettings({ audio: { repeatTrack: true } });
  audio = await temple.audioAction('ended');
  assert.equal(audio.currentTrackId, t1.id);
  temple.destroy();
});

test('cập nhật settings tự động clamp giá trị hợp lệ', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  await temple.updateSettings({ maxCharacters: 999, autoLeaveMinutes: -50, audio: { volume: 5.5 } });

  assert.equal(temple.data.settings.maxCharacters, 36); // MAX_SLOTS = 36
  assert.equal(temple.data.settings.autoLeaveMinutes, 0); // clamp min 0
  assert.equal(temple.data.settings.audio.volume, 1); // clamp max 1
  temple.destroy();
});

test('mỗi 1000 tim thỉnh 1 tiếng Đại Hồng Chung', async () => {
  const io = makeIo();
  const temple = new TempleService({ store: makeStore(), io });

  // 999 tim chưa thỉnh chuông
  await temple.handleLike({ type: 'like', count: 999 });
  assert.equal(io.events.find(e => e.name === 'bell:strike'), undefined);

  // Thêm 1 tim = 1000 tim -> thỉnh chuông mốc 1000
  await temple.handleLike({ type: 'like', count: 1 });
  const bell1 = io.events.find(e => e.name === 'bell:strike');
  assert.ok(bell1);
  assert.equal(bell1.payload.milestone, 1000);

  // Thêm 1000 tim nữa = 2000 tim -> thỉnh chuông mốc 2000
  await temple.handleLike({ type: 'like', count: 1000 });
  const bells = io.events.filter(e => e.name === 'bell:strike');
  assert.equal(bells.length, 2);
  assert.equal(bells[1].payload.milestone, 2000);

  temple.destroy();
});

test('Lễ Hồi Hướng: kích hoạt nghi lễ và cập nhật trạng thái', async () => {
  const io = makeIo();
  const temple = new TempleService({ store: makeStore(), io });

  assert.equal(temple.getCeremonyStatus().active, false);
  assert.ok(temple.getCeremonyStatus().remainingSeconds > 0);

  await temple.startCeremony();
  assert.equal(temple.getCeremonyStatus().active, true);
  const startEvent = io.events.find(e => e.name === 'ceremony:start');
  assert.ok(startEvent);
  assert.equal(startEvent.payload.title, 'ĐẠI LỄ HỒI HƯỚNG CÔNG ĐỨC');

  temple.destroy();
});

test('bình luận bất kỳ đưa Phật tử vào phòng chiếm bồ đoàn và kích hoạt lễ Phật', async () => {
  const temple = new TempleService({ store: makeStore(), io: makeIo() });
  const result = await temple.handleComment({
    type: 'comment',
    text: 'A di đà phật con chào thầy',
    viewer: { id: 'new_commenter_99', username: 'phattu_moi', nickname: 'Phật Tử Mới' }
  });

  assert.equal(result.left, false);
  assert.equal(result.created, true);
  assert.ok(temple.presences.has('new_commenter_99'));
  assert.equal(temple.presences.get('new_commenter_99').state, 'entering');
  temple.destroy();
});

test('tính năng gieo quẻ khi bình luận gieo quẻ hoặc xin quẻ phát sự kiện và AI đọc quẻ', async () => {
  const io = makeIo();
  const temple = new TempleService({ store: makeStore(), io });

  // 1. Gieo quẻ bằng bình luận 'con xin gieo quẻ ạ'
  const commentRes = await temple.handleComment({
    type: 'comment',
    text: 'con xin gieo quẻ ạ',
    viewer: { id: 'pt_fortune_1', username: 'ThanhTung', nickname: 'Thanh Tùng' }
  });

  assert.ok(commentRes.fortune);
  assert.equal(commentRes.left, false);
  assert.ok(commentRes.fortune.fortune.number >= 1);
  assert.ok(commentRes.fortune.fortune.title);
  assert.ok(commentRes.fortune.fortune.poem);

  // Kiểm tra event fortune:draw
  const drawEvent = io.events.find((e) => e.name === 'fortune:draw');
  assert.ok(drawEvent);
  assert.equal(drawEvent.payload.viewer.nickname, 'Thanh Tùng');
  assert.equal(drawEvent.payload.fortune.number, commentRes.fortune.fortune.number);

  // Kiểm tra event speech:announce loại fortune
  const speechEvent = io.events.find((e) => e.name === 'speech:announce' && e.payload.type === 'fortune');
  assert.ok(speechEvent);
  assert.ok(speechEvent.payload.text.includes('Thanh Tùng'));
  assert.ok(speechEvent.payload.text.includes('Quẻ số'));
  assert.ok(speechEvent.payload.text.includes('Nam Mô A Di Đà Phật'));

  // 2. Thử biến thể không dấu 'xin que may man'
  const commentRes2 = await temple.handleComment({
    type: 'comment',
    text: 'xin que may man',
    viewer: { id: 'pt_fortune_2', username: 'MinhAn', nickname: 'Minh An' }
  });
  assert.ok(commentRes2.fortune);

  temple.destroy();
});
