import { randomUUID } from 'node:crypto';
import { MAX_SLOTS, publicGift } from './defaults.js';
import { speechDirector } from './speech.js';
import { isFortuneRequest, isIncenseRequest, drawRandomFortune, getFortuneSpeech } from './fortune-data.js';

const now = () => new Date().toISOString();
const clamp = (value, low, high) => Math.min(high, Math.max(low, Number(value) || 0));
const clean = (value, max = 256) => String(value ?? '').trim().slice(0, max);
const later = (callback, ms) => {
  const timer = setTimeout(callback, ms);
  timer.unref?.();
  return timer;
};

function asViewer(event) {
  const raw = event?.viewer || event?.sender || {};
  const id = raw.id || raw.userId || raw.viewerId || event?.userId || event?.viewerId || event?.senderId || raw.uniqueId || event?.uniqueId;
  if (!id) return null;
  const username = clean(raw.username || raw.uniqueId || event?.username || event?.uniqueId || `thien_huu_${String(id).slice(-4)}`, 128);
  const nickname = clean(raw.nickname || raw.displayName || event?.nickname || username, 128);
  const avatarUrl = clean(raw.avatarUrl || raw.avatar || event?.avatarUrl, 1024);
  return { id: clean(id, 128), username, nickname, avatarUrl };
}

function asPublicPresence(presence) {
  return {
    id: presence.id,
    username: presence.username,
    nickname: presence.nickname,
    avatarUrl: presence.avatarUrl || '',
    slotIndex: presence.slotIndex,
    state: presence.state,
    temporary: Boolean(presence.temporary),
    instant: Boolean(presence.instant),
    joinedAt: presence.joinedAt,
    lastActiveAt: presence.lastActiveAt
  };
}

function formatThankYou(template, sender, gift) {
  return clean(template || '🙏 Cảm ơn @{username} đã gửi {gift}!', 500)
    .replaceAll('{username}', sender?.username || 'thiện hữu')
    .replaceAll('{nickname}', sender?.nickname || sender?.username || 'thiện hữu')
    .replaceAll('{gift}', gift.name || 'một món quà');
}

export const DEDICATION_PRAYER_TEXT = `Nam mô A Di Đà Phật.
Nam mô A Di Đà Phật.
Nam mô A Di Đà Phật.

Nguyện mười phương chư Phật, chư đại Bồ Tát, chư A La Hán, chư Hiền Thánh Tăng, chư Long Thần Hộ Pháp, đức Dược Sư Lưu Ly Quang Vương Phật, đức Bồ Tát Quán Thế Âm, đức Quan Thánh Đế Quân chứng minh, gia trì và cùng với con hồi hướng công đức, phước báu từ vô lượng kiếp con đã gieo tạo được do niệm Phật, lạy Phật, trì Chú, giúp đỡ, cứu mạng chúng sinh cho đến bây giờ. Xin hồi hướng hết cho oan gia trái chủ, nghiệp chướng trong thân tâm, cho cửu huyền thất tổ bảy đời, chín kiếp nội, ngoại đầy đủ công đức, phước báu siêu sinh về cõi an lành, Tây Phương Tịnh Độ. Và hồi hướng cho con cùng những người thân quen bình an, mạnh khỏe, khai thông trí tuệ, phát tâm bồ đề, ăn chay, niệm Phật, tu hành tinh tấn đắc quả thành Phật. Nguyện hồi hướng cho pháp giới chúng sanh đồng thành Phật đạo.

Nam mô A Di Đà Phật.
Nam mô A Di Đà Phật.
Nam mô A Di Đà Phật.`;

export const DEDICATION_PRAYER_SPOKEN = `Nam mô A Di Đà Phật. Nam mô A Di Đà Phật. Nam mô A Di Đà Phật. Nguyện mười phương chư Phật, chư đại Bồ Tát, chư A La Hán, chư Hiền Thánh Tăng, chư Long Thần Hộ Pháp, đức Dược Sư Lưu Ly Quang Vương Phật, đức Bồ Tát Quán Thế Âm, đức Quan Thánh Đế Quân chứng minh, gia trì và cùng với con hồi hướng công đức, phước báu từ vô lượng kiếp con đã gieo tạo được do niệm Phật, lạy Phật, trì Chú, giúp đỡ, cứu mạng chúng sinh cho đến bây giờ. Xin hồi hướng hết cho oan gia trái chủ, nghiệp chướng trong thân tâm, cho cửu huyền thất tổ bảy đời, chín kiếp nội, ngoại đầy đủ công đức, phước báu siêu sinh về cõi an lành, Tây Phương Tịnh Độ. Và hồi hướng cho con cùng những người thân quen bình an, mạnh khỏe, khai thông trí tuệ, phát tâm bồ đề, ăn chay, niệm Phật, tu hành tinh tấn đắc quả thành Phật. Nguyện hồi hướng cho pháp giới chúng sanh đồng thành Phật đạo. Nam mô A Di Đà Phật. Nam mô A Di Đà Phật. Nam mô A Di Đà Phật.`;

export class TempleService {
  constructor({ store, io }) {
    this.store = store;
    this.io = io;
    this.data = store.getState();
    this.presences = new Map();
    this.giftQueue = [];
    this.currentGift = null;
    this.giftSequence = 0;
    this.processedGiftIds = new Set();
    this.liveStatus = { name: 'Mock simulator', status: 'disconnected', channel: '' };
    this.speechDirector = speechDirector;
    this.sweepTimer = setInterval(() => this.sweepInactive(), 5000);
    this.sweepTimer.unref?.();
    this.recentChats = [];

    // Mốc 1000 tim thỉnh Đại Hồng Chung & Lễ Hồi Hướng mỗi 10 phút
    this.bellMilestone = 1000;
    this.ceremonyIntervalMs = 10 * 60 * 1000; // 10 phút
    this.ceremonyDurationMs = 55000;          // 55 giây khóa lễ hồi hướng toàn thể
    this.nextCeremonyAt = Date.now() + this.ceremonyIntervalMs;
    this.ceremonyActive = false;
    this.ceremonyTimer = setInterval(() => this.checkCeremony(), 1000);
    this.ceremonyTimer.unref?.();

    // Chế độ Treo Live 24/7 Tự Động (Chống thuật toán quét tĩnh của TikTok)
    this.lastActivityAt = Date.now();
    this.lastWorshipperJoinAt = Date.now();
    this.lastSpeechAt = Date.now();
    this.liveProtectionTimer = setInterval(() => { this.checkLiveProtection().catch(() => {}); }, 15000);
    this.liveProtectionTimer.unref?.();
  }

  checkCeremony() {
    if (!this.ceremonyActive && Date.now() >= this.nextCeremonyAt) {
      this.startCeremony();
    }
  }

  getCeremonyStatus() {
    const remainingSeconds = Math.max(0, Math.ceil((this.nextCeremonyAt - Date.now()) / 1000));
    return {
      active: this.ceremonyActive,
      remainingSeconds,
      nextCeremonyAt: this.nextCeremonyAt,
      attendeesCount: this.presences.size
    };
  }

  async startCeremony() {
    if (this.ceremonyActive) return;
    this.ceremonyActive = true;
    const attendees = this.presences.size;

    this.io.emit('ceremony:start', {
      durationMs: this.ceremonyDurationMs,
      attendees,
      title: 'ĐẠI LỄ HỒI HƯỚNG CÔNG ĐỨC',
      chant: DEDICATION_PRAYER_TEXT,
      soundUrl: '/assets/temple_bell.wav'
    });

    this.io.emit('speech:announce', {
      id: randomUUID(),
      type: 'ceremony',
      text: DEDICATION_PRAYER_SPOKEN,
      speaker: 'Đại Lễ Hồi Hướng',
      url: `/api/tts?text=${encodeURIComponent(DEDICATION_PRAYER_SPOKEN)}`,
      createdAt: now()
    });

    later(() => {
      this.ceremonyActive = false;
      this.nextCeremonyAt = Date.now() + this.ceremonyIntervalMs;
      this.io.emit('ceremony:end', {
        nextCeremonyAt: this.nextCeremonyAt
      });
    }, this.ceremonyDurationMs);
  }

  strikeBellMilestone(milestoneLikes) {
    const speech = this.speechDirector ? this.speechDirector.getBellSpeech(milestoneLikes) : null;
    const speechText = speech?.text || `A Di Đà Phật! Đạo tràng đã tích lũy đủ ${Number(milestoneLikes || 1000).toLocaleString('vi-VN')} lượt tim công đức. Đại Hồng Chung ngân vang rền khắp mười phương, nguyện cầu quốc thái dân an, chúng sinh an lạc!`;

    this.io.emit('bell:strike', {
      id: randomUUID(),
      milestone: milestoneLikes,
      cycleProgress: 1000,
      soundUrl: '/assets/temple_bell.wav',
      message: `ĐẠI HỒNG CHUNG NGÂN VANG · MỐC ${Number(milestoneLikes || 1000).toLocaleString('vi-VN')} TIM`,
      speechText,
      createdAt: now()
    });

    this.io.emit('speech:announce', {
      id: randomUUID(),
      type: 'bell_strike',
      text: speechText,
      speaker: 'Đại Hồng Chung',
      url: `/api/tts?text=${encodeURIComponent(speechText)}`,
      createdAt: now()
    });
  }

  snapshot() {
    const totalLikes = this.data.metrics.totalLikes || 0;
    return {
      settings: structuredClone(this.data.settings),
      gifts: this.data.gifts.map(publicGift),
      tracks: structuredClone(this.data.tracks),
      ceremony: this.getCeremonyStatus(),
      metrics: {
        ...this.data.metrics,
        presentCount: this.presences.size,
        queuedGifts: this.giftQueue.length + (this.currentGift ? 1 : 0),
        bellMilestone: 1000,
        bellCycleLikes: totalLikes % 1000,
        bellTotalCycles: Math.floor(totalLikes / 1000)
      },
      presences: [...this.presences.values()].map(asPublicPresence),
      topDonors: (this.data.topDonors || []).slice(0, 10),
      recentChats: this.recentChats.slice(-25),
      live: this.liveStatus
    };
  }

  async changeData(mutator) {
    const next = await this.store.mutate(mutator);
    this.data = next;
    return next;
  }

  emitMetrics() {
    const totalLikes = this.data.metrics.totalLikes || 0;
    this.io.emit('metrics:update', {
      ...this.data.metrics,
      presentCount: this.presences.size,
      queuedGifts: this.giftQueue.length + (this.currentGift ? 1 : 0),
      bellMilestone: 1000,
      bellCycleLikes: totalLikes % 1000,
      bellTotalCycles: Math.floor(totalLikes / 1000)
    });
  }

  emitSettings() {
    this.io.emit('settings:update', structuredClone(this.data.settings));
    this.emitAudio();
  }

  emitAudio() {
    this.io.emit('audio:state', {
      ...this.data.settings.audio,
      tracks: structuredClone(this.data.tracks)
    });
  }

  setLiveStatus(status) {
    this.liveStatus = { ...this.liveStatus, ...status };
    this.io.emit('live:status', this.liveStatus);
  }

  publishSnapshot() {
    this.io.emit('temple:snapshot', this.snapshot());
  }

  activeLimit() {
    return Math.min(MAX_SLOTS, Math.max(1, Math.floor(Number(this.data.settings.maxCharacters) || 18)));
  }

  freeSlot() {
    const occupied = new Set([...this.presences.values()].map((p) => p.slotIndex));
    for (let index = 0; index < this.activeLimit(); index += 1) {
      if (!occupied.has(index)) return index;
    }
    return null;
  }

  upsertPresence(viewer, { temporary = false, instant = false } = {}) {
    const existing = this.presences.get(viewer.id);
    if (existing) {
      Object.assign(existing, viewer, { lastActiveAt: now() });
      if (!temporary) {
        existing.temporary = false;
      }
      if (existing.state === 'exiting') {
        clearTimeout(existing.exitTimer);
        existing.exitTimer = null;
        existing.state = instant ? 'praying' : 'entering';
        existing.instant = instant;
        if (!instant) this.schedulePrayer(existing);
      }
      this.io.emit('temple:presence:upsert', asPublicPresence(existing));
      return existing;
    }

    const slotIndex = this.freeSlot();
    if (slotIndex === null) return null;
    const presence = {
      ...viewer,
      slotIndex,
      state: instant ? 'praying' : 'entering',
      temporary,
      instant,
      joinedAt: now(),
      lastActiveAt: now(),
      enterTimer: null,
      exitTimer: null
    };
    this.presences.set(presence.id, presence);
    this.io.emit('temple:presence:upsert', asPublicPresence(presence));
    if (!temporary && this.data.settings?.aiVoice?.welcomeEnabled !== false) {
      const welcome = this.speechDirector.getWelcomeSpeech(presence);
      this.io.emit('speech:announce', {
        id: randomUUID(),
        type: 'welcome',
        text: welcome.text,
        speaker: presence.nickname || presence.username,
        createdAt: now()
      });
    }
    if (!instant) this.schedulePrayer(presence);
    this.emitMetrics();
    return presence;
  }

  schedulePrayer(presence) {
    clearTimeout(presence.enterTimer);
    presence.enterTimer = later(() => {
      const current = this.presences.get(presence.id);
      if (!current || current.state !== 'entering') return;
      current.state = 'praying';
      current.instant = false;
      this.io.emit('temple:presence:upsert', asPublicPresence(current));
    }, 1650);
  }

  async handleLike(event) {
    const count = clamp(event?.count ?? event?.likeCount ?? 1, 1, 10000);
    const viewer = asViewer(event);
    const prevLikes = this.data.metrics.totalLikes || 0;
    await this.changeData((state) => {
      if (event?.total && Number(event.total) > state.metrics.totalLikes) {
        state.metrics.totalLikes = Number(event.total);
      } else {
        state.metrics.totalLikes += count;
      }
      if (!viewer) state.metrics.anonymousLikes += count;
    });
    const newLikes = this.data.metrics.totalLikes || 0;

    // Phát sự kiện xung tim (like:pulse) để client cập nhật tức thì
    this.io.emit('like:pulse', {
      count,
      totalLikes: newLikes,
      viewer: viewer ? { id: viewer.id, username: viewer.username, nickname: viewer.nickname } : null
    });

    // Kiểm tra mốc 1000 tim thỉnh Đại Hồng Chung
    const prevMilestone = Math.floor(prevLikes / 1000);
    const newMilestone = Math.floor(newLikes / 1000);
    if (newMilestone > prevMilestone) {
      for (let m = prevMilestone + 1; m <= newMilestone; m++) {
        this.strikeBellMilestone(m * 1000);
      }
    }

    if (!viewer) {
      this.emitMetrics();
      return { anonymous: true, created: false };
    }
    const existing = this.presences.get(viewer.id);
    const presence = this.upsertPresence(viewer);
    this.emitMetrics();
    return { anonymous: false, created: !existing && Boolean(presence), capacityReached: !presence };
  }

  async handleFollow(event) {
    const viewer = asViewer(event);
    if (!viewer) return { ignored: true, reason: 'anonymous-follow' };

    const existing = this.presences.get(viewer.id);
    let admitted = null;
    if (existing) {
      existing.lastActiveAt = now();
      admitted = existing;
    } else {
      admitted = this.upsertPresence(viewer);
    }

    // Phát lời cảm ơn và chúc phúc AI trang nghiêm
    const speech = this.speechDirector ? this.speechDirector.getFollowSpeech(viewer) : null;
    if (speech && speech.text) {
      this.io.emit('speech:announce', {
        id: `speech-follow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'follow',
        speaker: viewer.nickname || viewer.username,
        text: speech.text,
        url: `/api/tts?text=${encodeURIComponent(speech.text)}`
      });
    }

    this.io.emit('follower:new', {
      viewer: admitted ? asPublicPresence(admitted) : { id: viewer.id, username: viewer.username, nickname: viewer.nickname },
      speechText: speech?.text || ''
    });

    this.emitMetrics();

    return {
      followed: true,
      viewer,
      presence: admitted ? asPublicPresence(admitted) : null,
      speech
    };
  }

  async handleComment(event) {
    const viewer = asViewer(event);
    const text = clean(event?.text || event?.comment, 500);
    if (!viewer) return { ignored: true, reason: 'anonymous-comment' };
    let presence = this.presences.get(viewer.id);
    if (presence) presence.lastActiveAt = now();

    // 1. Kiểm tra từ khóa rời chùa
    const normalized = text.toLocaleLowerCase('vi-VN').trim();
    const leaves = (this.data.settings.leaveKeywords || []).some((keyword) => {
      const needle = clean(keyword, 80).toLocaleLowerCase('vi-VN');
      return needle && normalized.includes(needle);
    });
    if (leaves && presence) {
      this.leavePresence(viewer.id, 'comment');
      return { left: true };
    }

    // 2. Tự động đưa Phật tử vào phòng hoặc kích hoạt bồ đoàn
    const existing = Boolean(presence);
    if (!presence) {
      presence = this.upsertPresence(viewer);
    }
    this.emitMetrics();

    // 3. Phát sự kiện tin nhắn hiển thị bong bóng chat trên đầu nhân vật
    const chatPayload = {
      id: randomUUID(),
      eventId: clean(event?.eventId || event?.id, 128),
      presenceId: presence?.id || viewer.id,
      viewer: {
        id: viewer.id,
        username: viewer.username || viewer.id,
        nickname: viewer.nickname || viewer.username || 'Thiện hữu',
        avatarUrl: viewer.avatarUrl || ''
      },
      text,
      createdAt: now()
    };
    this.recentChats.push(chatPayload);
    if (this.recentChats.length > 50) this.recentChats.shift();
    this.io.emit('chat:message', chatPayload);

    // 4. Kiểm tra yêu cầu dâng hương (khi bình luận chứa 'dâng hương', 'thắp hương', ...)
    if (isIncenseRequest(text)) {
      const incense = await this.offerIncense(viewer);
      return { incense, left: false };
    }

    // 5. Kiểm tra yêu cầu gieo quẻ xăm (khi bình luận chứa 'gieo quẻ', 'xin quẻ', ...)
    if (isFortuneRequest(text)) {
      const fortune = await this.drawFortune(viewer);
      return { fortune, left: false };
    }

    return {
      left: false,
      created: !existing && Boolean(presence),
      capacityReached: !presence,
      presence: presence ? asPublicPresence(presence) : null
    };
  }

  async offerIncense(viewer) {
    if (!viewer) return null;
    const existing = this.presences.get(viewer.id);
    const presence = existing || this.upsertPresence(viewer, { temporary: false, instant: false });
    if (presence) {
      presence.lastActiveAt = now();
      if (presence.state === 'exiting') {
        clearTimeout(presence.exitTimer);
        presence.exitTimer = null;
        presence.state = 'praying';
        this.io.emit('temple:presence:upsert', asPublicPresence(presence));
      }
    }

    const speakerName = viewer.nickname || viewer.username || 'Thiện hữu';
    const speech = this.speechDirector
      ? this.speechDirector.getIncenseSpeech(viewer)
      : { text: `Nam Mô A Di Đà Phật! Thiện hữu ${speakerName} chí thành dâng nén tâm hương cúng dường mười phương chư Phật.` };

    const payload = {
      id: randomUUID(),
      presenceId: presence?.id || viewer.id,
      viewer: {
        id: viewer.id,
        username: viewer.username || viewer.id,
        nickname: speakerName,
        avatarUrl: viewer.avatarUrl || ''
      },
      text: speech.text,
      createdAt: now()
    };

    // Phát sự kiện nhân vật trong game đứng lên tiến vào giữa gần tượng Phật dâng hương
    this.io.emit('temple:incense', payload);

    // AI đọc to lời chúc dâng hương thanh tịnh
    this.io.emit('speech:announce', {
      id: randomUUID(),
      type: 'incense',
      category: 'incense',
      text: speech.text,
      speaker: speakerName,
      url: `/api/tts?text=${encodeURIComponent(speech.text)}`,
      createdAt: now()
    });

    return payload;
  }

  async drawFortune(viewer) {
    if (!viewer) return null;
    const existing = this.presences.get(viewer.id);
    const presence = existing || this.upsertPresence(viewer, { temporary: false, instant: false });
    if (presence) {
      presence.lastActiveAt = now();
      if (presence.state === 'exiting') {
        clearTimeout(presence.exitTimer);
        presence.exitTimer = null;
        presence.state = 'praying';
        this.io.emit('temple:presence:upsert', asPublicPresence(presence));
      }
    }

    const fortune = drawRandomFortune();
    const fortunePayload = {
      id: randomUUID(),
      viewer: {
        id: viewer.id,
        username: viewer.username || viewer.id,
        nickname: viewer.nickname || viewer.username || 'Thiện hữu',
        avatarUrl: viewer.avatarUrl || ''
      },
      fortune,
      createdAt: now()
    };

    // Phát sự kiện hiển thị thẻ quẻ xăm linh ứng trên màn hình Live
    this.io.emit('fortune:draw', fortunePayload);

    // AI đọc to lời giải quẻ của người xin quẻ
    const speakerName = viewer.nickname || viewer.username || 'Thiện hữu';
    const speechText = getFortuneSpeech(fortune, speakerName);

    this.io.emit('speech:announce', {
      id: randomUUID(),
      type: 'fortune',
      text: speechText,
      speaker: `Quẻ số ${fortune.number} · ${fortune.category}`,
      recipient: speakerName,
      createdAt: now()
    });

    return fortunePayload;
  }

  leavePresence(id, reason = 'admin') {
    const presence = this.presences.get(String(id));
    if (!presence || presence.state === 'exiting') return false;
    clearTimeout(presence.enterTimer);
    presence.state = 'exiting';
    presence.leaveReason = reason;
    this.io.emit('temple:presence:upsert', asPublicPresence(presence));
    presence.exitTimer = later(() => this.removePresence(presence.id), 2050);
    return true;
  }

  removePresence(id) {
    const presence = this.presences.get(String(id));
    if (!presence) return false;
    clearTimeout(presence.enterTimer);
    clearTimeout(presence.exitTimer);
    this.presences.delete(presence.id);
    this.io.emit('temple:presence:remove', { id: presence.id });
    this.emitMetrics();
    return true;
  }

  sweepInactive() {
    const seconds = this.data.settings.autoLeaveSeconds !== undefined
      ? Number(this.data.settings.autoLeaveSeconds)
      : (Number(this.data.settings.autoLeaveMinutes) || 0) * 60;
    if (seconds <= 0) return;
    const threshold = Date.now() - seconds * 1000;
    for (const presence of this.presences.values()) {
      if (presence.temporary || presence.state === 'exiting') continue;
      if (new Date(presence.lastActiveAt).getTime() < threshold) {
        this.leavePresence(presence.id, 'swipe-away');
      }
    }
  }

  async handleLeave(event) {
    const viewer = asViewer(event);
    const id = viewer?.id || event?.id || event?.userId;
    const username = viewer?.username || event?.username || event?.uniqueId;

    let targetId = null;
    if (id && this.presences.has(String(id))) {
      targetId = String(id);
    } else if (username) {
      for (const [pId, presence] of this.presences.entries()) {
        if (presence.username === username || presence.nickname === username) {
          targetId = pId;
          break;
        }
      }
    }

    if (targetId) {
      const left = this.leavePresence(targetId, 'swipe-away');
      return { left: Boolean(left), id: targetId, reason: 'swipe-away' };
    }
    return { left: false, reason: 'not-found' };
  }

  findGift(event) {
    const rawGift = event?.gift || {};
    const providerGiftId = clean(event?.giftId || rawGift.id || rawGift.giftId || event?.providerGiftId, 128);
    const giftName = clean(event?.giftName || rawGift.name, 256);
    const config = this.data.gifts.find((gift) => gift.enabled !== false && gift.providerGiftId === providerGiftId)
      || this.data.gifts.find((gift) => gift.enabled !== false && gift.name === giftName)
      || this.data.gifts.find((gift) => gift.enabled !== false && (gift.name.toLowerCase() === giftName.toLowerCase() || gift.id.toLowerCase() === providerGiftId.toLowerCase()));
    if (config) return publicGift(config);

    const category = this.speechDirector ? this.speechDirector.detectGiftCategory({ id: providerGiftId, name: giftName }) : 'general';
    const prayerTitle = category === 'love' ? 'cầu duyên'
      : category === 'peace' ? 'cầu bình an'
      : category === 'health' ? 'cầu sức khỏe'
      : category === 'luck' ? 'cầu may mắn'
      : category === 'ceremony' ? 'thỉnh chuông hộ pháp'
      : 'gieo duyên lành';

    return {
      id: providerGiftId || 'generic', providerGiftId: providerGiftId || 'generic',
      name: giftName || 'Quà phát nguyện',
      imageUrl: clean(event?.giftImageUrl || rawGift.imageUrl, 1024), animation: 'thank', soundUrl: '',
      durationMs: 4000, thankYouTemplate: `🙏 @{nickname} dâng {gift} ${prayerTitle}!`,
      priority: 10, specialEffect: 'none', enabled: true
    };
  }

  async handleGift(event) {
    const externalId = clean(event?.eventId || event?.externalEventId || event?.id, 200);
    if (externalId && this.processedGiftIds.has(externalId)) return { duplicate: true };
    if (externalId) {
      this.processedGiftIds.add(externalId);
      if (this.processedGiftIds.size > 1000) this.processedGiftIds.delete(this.processedGiftIds.values().next().value);
    }

    const gift = this.findGift(event);
    const repeatCount = clamp(event?.repeatCount ?? event?.count ?? 1, 1, 9999);
    const sender = asViewer(event);
    let presence = sender ? this.presences.get(sender.id) : null;
    if (presence) {
      Object.assign(presence, sender, { lastActiveAt: now() });
      if (presence.state === 'exiting') {
        clearTimeout(presence.exitTimer);
        presence.exitTimer = null;
        presence.state = 'praying';
        presence.instant = true;
      }
      this.io.emit('temple:presence:upsert', asPublicPresence(presence));
    } else if (sender) {
      presence = this.upsertPresence(sender, { temporary: true, instant: true });
    }

    await this.changeData((state) => {
      state.metrics.totalGifts += repeatCount;
      state.metrics.totalGiftValue += (gift.priority || 1) * repeatCount;
      state.metrics.lastGiftAt = now();

      if (sender?.id) {
        state.topDonors = state.topDonors || [];
        let donor = state.topDonors.find((d) => d.id === sender.id);
        const giftPoints = (gift.priority || 10) * repeatCount;
        if (donor) {
          donor.totalGifts = (donor.totalGifts || 0) + repeatCount;
          donor.totalValue = (donor.totalValue || 0) + giftPoints;
          donor.nickname = sender.nickname || donor.nickname;
          donor.username = sender.username || donor.username;
          donor.avatarUrl = sender.avatarUrl || donor.avatarUrl;
          donor.lastGiftAt = now();
        } else {
          donor = {
            id: sender.id,
            username: sender.username || sender.id,
            nickname: sender.nickname || sender.username || 'Thiện hữu',
            avatarUrl: sender.avatarUrl || '',
            totalGifts: repeatCount,
            totalValue: giftPoints,
            lastGiftAt: now()
          };
          state.topDonors.push(donor);
        }
        state.topDonors.sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0) || (b.totalGifts || 0) - (a.totalGifts || 0));
        if (state.topDonors.length > 50) state.topDonors.length = 50;
      }
    });
    this.io.emit('leaderboard:update', (this.data.topDonors || []).slice(0, 10));
    const item = {
      id: randomUUID(), sequence: ++this.giftSequence, gift, sender,
      presenceId: presence?.id || null, repeatCount,
      queuedAt: now(), priority: Number(gift.priority) || 0,
      temporaryPresence: Boolean(presence?.temporary)
    };
    this.giftQueue.push(item);
    this.giftQueue.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    this.io.emit('gift:queued', { id: item.id, gift, sender, queueLength: this.giftQueue.length });
    this.emitMetrics();
    this.drainGiftQueue();
    return { queued: true, id: item.id, hasCharacter: Boolean(presence) };
  }

  drainGiftQueue() {
    if (this.currentGift || !this.giftQueue.length) return;
    const item = this.giftQueue.shift();
    this.currentGift = item;
    const presence = item.presenceId ? this.presences.get(item.presenceId) : null;
    if (presence && presence.state === 'exiting') {
      clearTimeout(presence.exitTimer);
      presence.exitTimer = null;
      presence.state = 'praying';
      this.io.emit('temple:presence:upsert', asPublicPresence(presence));
    }
    const speech = (this.speechDirector && this.data.settings?.aiVoice?.giftThanksEnabled !== false)
      ? this.speechDirector.getGiftThankYouSpeech(item.sender, item.gift, item.repeatCount)
      : null;
    const thankYou = speech?.text || formatThankYou(item.gift.thankYouTemplate, item.sender, item.gift);
    const category = speech?.category || (this.speechDirector ? this.speechDirector.detectGiftCategory(item.gift) : 'general');

    this.io.emit('speech:announce', {
      id: randomUUID(),
      type: 'gift_thanks',
      category,
      text: thankYou,
      speaker: item.sender?.nickname || item.sender?.username || 'Thiện hữu',
      giftName: item.gift.name,
      url: `/api/tts?text=${encodeURIComponent(thankYou)}`,
      createdAt: now()
    });
    this.io.emit('gift:present', {
      ...item,
      category,
      sender: item.sender ? { ...item.sender } : null,
      presence: presence ? asPublicPresence(presence) : null,
      thankYou,
      queueLength: this.giftQueue.length
    });
    item.fallbackTimer = later(() => this.finishGift(item.id, 'timeout'), Math.max(2500, item.gift.durationMs + 1600));
    this.emitMetrics();
  }

  finishGift(id, source = 'client') {
    if (!this.currentGift || this.currentGift.id !== id) return false;
    const item = this.currentGift;
    clearTimeout(item.fallbackTimer);
    this.currentGift = null;
    this.io.emit('gift:complete', { id, source });
    if (item.temporaryPresence && item.presenceId) {
      const hasMoreInQueue = this.giftQueue.some((q) => q.presenceId === item.presenceId);
      const currentPresence = this.presences.get(item.presenceId);
      if (!hasMoreInQueue && currentPresence?.temporary) {
        later(() => this.leavePresence(item.presenceId, 'gift-complete'), 450);
      }
    }
    later(() => this.drainGiftQueue(), 550);
    this.emitMetrics();
    return true;
  }

  async updateSettings(input = {}) {
    await this.changeData((state) => {
      if (input.maxCharacters !== undefined) state.settings.maxCharacters = Math.floor(clamp(input.maxCharacters, 1, MAX_SLOTS));
      if (input.autoLeaveSeconds !== undefined) state.settings.autoLeaveSeconds = clamp(Number(input.autoLeaveSeconds) || 0, 0, 86400);
      if (input.autoLeaveMinutes !== undefined) {
        state.settings.autoLeaveMinutes = clamp(Number(input.autoLeaveMinutes) || 0, 0, 1440);
        if (input.autoLeaveSeconds === undefined && state.settings.autoLeaveMinutes > 0) {
          state.settings.autoLeaveSeconds = state.settings.autoLeaveMinutes * 60;
        }
      }
      if (Array.isArray(input.leaveKeywords)) {
        state.settings.leaveKeywords = input.leaveKeywords.map((item) => clean(item, 80)).filter(Boolean).slice(0, 12);
      }
      const audio = input.audio || {};
      if (audio.volume !== undefined) state.settings.audio.volume = clamp(audio.volume, 0, 1);
      if (['sequential', 'random'].includes(audio.mode)) state.settings.audio.mode = audio.mode;
      if (typeof audio.loopList === 'boolean') state.settings.audio.loopList = audio.loopList;
      if (typeof audio.repeatTrack === 'boolean') state.settings.audio.repeatTrack = audio.repeatTrack;
      state.settings.audio.revision += 1;
      const aiVoice = input.aiVoice || {};
      if (!state.settings.aiVoice) {
        state.settings.aiVoice = { enabled: true, welcomeEnabled: true, giftThanksEnabled: true, volume: 0.9, rate: 1.25, preferredVoice: '' };
      }
      if (typeof aiVoice.enabled === 'boolean') state.settings.aiVoice.enabled = aiVoice.enabled;
      if (typeof aiVoice.welcomeEnabled === 'boolean') state.settings.aiVoice.welcomeEnabled = aiVoice.welcomeEnabled;
      if (typeof aiVoice.giftThanksEnabled === 'boolean') state.settings.aiVoice.giftThanksEnabled = aiVoice.giftThanksEnabled;
      if (aiVoice.volume !== undefined) state.settings.aiVoice.volume = clamp(aiVoice.volume, 0, 1);
      if (aiVoice.rate !== undefined) state.settings.aiVoice.rate = clamp(aiVoice.rate, 0.5, 2.0);
      if (typeof aiVoice.preferredVoice === 'string') state.settings.aiVoice.preferredVoice = aiVoice.preferredVoice.trim().slice(0, 120);

      const liveProtection = input.liveProtection || {};
      if (!state.settings.liveProtection) {
        state.settings.liveProtection = {
          enabled: true,
          autoWorshipperEnabled: true,
          ambientSpeechEnabled: true,
          autoLikeEnabled: true,
          intervalMinutes: 2.5,
          speechIntervalMinutes: 4.0
        };
      }
      if (typeof liveProtection.enabled === 'boolean') state.settings.liveProtection.enabled = liveProtection.enabled;
      if (typeof liveProtection.autoWorshipperEnabled === 'boolean') state.settings.liveProtection.autoWorshipperEnabled = liveProtection.autoWorshipperEnabled;
      if (typeof liveProtection.ambientSpeechEnabled === 'boolean') state.settings.liveProtection.ambientSpeechEnabled = liveProtection.ambientSpeechEnabled;
      if (typeof liveProtection.autoLikeEnabled === 'boolean') state.settings.liveProtection.autoLikeEnabled = liveProtection.autoLikeEnabled;
      if (liveProtection.intervalMinutes !== undefined) state.settings.liveProtection.intervalMinutes = clamp(Number(liveProtection.intervalMinutes) || 2.5, 0.5, 30);
      if (liveProtection.speechIntervalMinutes !== undefined) state.settings.liveProtection.speechIntervalMinutes = clamp(Number(liveProtection.speechIntervalMinutes) || 4.0, 1, 60);
    });
    this.emitSettings();
    this.publishSnapshot();
    return this.data.settings;
  }

  async resetLeaderboard() {
    await this.changeData((state) => {
      state.topDonors = [];
    });
    this.io.emit('leaderboard:update', []);
    this.publishSnapshot();
    return true;
  }

  async addTrack({ title, filePath }) {
    const track = {
      id: randomUUID(), title: clean(title || 'Bài kinh chưa đặt tên', 256),
      filePath: clean(filePath, 1024), durationMs: null, enabled: true,
      sortOrder: this.data.tracks.length, createdAt: now()
    };
    await this.changeData((state) => { state.tracks.push(track); });
    this.emitAudio();
    this.publishSnapshot();
    return track;
  }

  async updateTrack(id, input = {}) {
    let updated = null;
    await this.changeData((state) => {
      const track = state.tracks.find((item) => item.id === id);
      if (!track) return;
      if (input.title !== undefined) track.title = clean(input.title, 256) || track.title;
      if (typeof input.enabled === 'boolean') track.enabled = input.enabled;
      updated = structuredClone(track);
    });
    if (!updated) throw new Error('Không tìm thấy bài âm thanh.');
    this.emitAudio();
    this.publishSnapshot();
    return updated;
  }

  async deleteTrack(id) {
    let found = false;
    await this.changeData((state) => {
      const before = state.tracks.length;
      state.tracks = state.tracks.filter((track) => track.id !== id);
      found = before !== state.tracks.length;
      if (state.settings.audio.currentTrackId === id) {
        state.settings.audio.currentTrackId = null;
        state.settings.audio.status = 'stopped';
        state.settings.audio.revision += 1;
      }
    });
    if (!found) throw new Error('Không tìm thấy bài âm thanh.');
    this.emitAudio();
    this.publishSnapshot();
  }

  enabledTracks() { return this.data.tracks.filter((track) => track.enabled !== false); }

  chooseTrack(direction = 1) {
    const tracks = this.enabledTracks();
    if (!tracks.length) return null;
    const audio = this.data.settings.audio;
    if (audio.mode === 'random' && tracks.length > 1) {
      const choices = tracks.filter((track) => track.id !== audio.currentTrackId);
      return choices[Math.floor(Math.random() * choices.length)];
    }
    const index = tracks.findIndex((track) => track.id === audio.currentTrackId);
    const next = index + direction;
    if (index < 0) return tracks[0];
    if (next >= tracks.length) return audio.loopList ? tracks[0] : null;
    if (next < 0) return tracks[tracks.length - 1];
    return tracks[next];
  }

  async audioAction(action, input = {}) {
    const requestedTrack = input.trackId && this.data.tracks.find((track) => track.id === input.trackId && track.enabled !== false);
    const current = this.data.settings.audio;
    let target = null;
    if (action === 'play') target = requestedTrack || this.data.tracks.find((track) => track.id === current.currentTrackId) || this.chooseTrack(1);
    if (action === 'next') target = this.chooseTrack(1);
    if (action === 'previous') target = this.chooseTrack(-1);
    if (!['play', 'pause', 'next', 'previous', 'ended'].includes(action)) throw new Error('Lệnh âm thanh không hợp lệ.');
    if (action === 'ended' && current.repeatTrack) target = this.data.tracks.find((track) => track.id === current.currentTrackId) || null;
    if (action === 'ended' && !current.repeatTrack) target = this.chooseTrack(1);

    await this.changeData((state) => {
      const audio = state.settings.audio;
      if (action === 'pause') audio.status = 'paused';
      else if (target) {
        audio.currentTrackId = target.id;
        audio.status = 'playing';
      } else if (action !== 'pause') {
        audio.status = 'stopped';
        audio.currentTrackId = null;
      }
      audio.revision += 1;
    });
    this.emitAudio();
    return this.data.settings.audio;
  }

  async addGift(input = {}) {
    const providerGiftId = clean(input.providerGiftId, 128);
    const name = clean(input.name, 256);
    if (!providerGiftId || !name) throw new Error('Cần nhập mã quà và tên quà.');
    if (this.data.gifts.some((gift) => gift.providerGiftId === providerGiftId)) throw new Error('Mã quà TikTok đã tồn tại.');
    const gift = publicGift({ id: randomUUID(), providerGiftId, name, ...input });
    await this.changeData((state) => { state.gifts.push(gift); });
    this.publishSnapshot();
    return gift;
  }

  async updateGift(id, input = {}) {
    let updated = null;
    await this.changeData((state) => {
      const gift = state.gifts.find((item) => item.id === id);
      if (!gift) return;
      const allowed = ['providerGiftId', 'name', 'imageUrl', 'animation', 'soundUrl', 'durationMs', 'thankYouTemplate', 'priority', 'specialEffect', 'enabled'];
      for (const key of allowed) if (input[key] !== undefined) gift[key] = input[key];
      const cleanGift = publicGift(gift);
      Object.assign(gift, cleanGift);
      updated = cleanGift;
    });
    if (!updated) throw new Error('Không tìm thấy quà.');
    this.publishSnapshot();
    return updated;
  }

  async deleteGift(id) {
    let found = false;
    await this.changeData((state) => {
      const count = state.gifts.length;
      state.gifts = state.gifts.filter((gift) => gift.id !== id);
      found = state.gifts.length !== count;
    });
    if (!found) throw new Error('Không tìm thấy quà.');
    this.publishSnapshot();
  }

  async handleEvent(event) {
    if (event.type === 'like') return this.handleLike(event);
    if (event.type === 'gift') return this.handleGift(event);
    if (event.type === 'comment') return this.handleComment(event);
    if (event.type === 'follow') return this.handleFollow(event);
    if (event.type === 'leave') return this.handleLeave(event);
    if (event.type === 'fortune') return this.drawFortune(asViewer(event));
    if (event.type === 'incense') return this.offerIncense(asViewer(event));
    throw new Error('Loại sự kiện không được hỗ trợ.');
  }

  async checkLiveProtection() {
    const config = this.data.settings?.liveProtection;
    if (!config || config.enabled === false) return;

    const nowMs = Date.now();
    const intervalMs = (Number(config.intervalMinutes) || 2.5) * 60 * 1000;
    const speechIntervalMs = (Number(config.speechIntervalMinutes) || 4.0) * 60 * 1000;

    // 1. Giữ chuyển động: Tự động cho Phật tử vào lạy Phật nếu vắng người
    if (config.autoWorshipperEnabled !== false) {
      const activePresences = [...this.presences.values()].filter((p) => p.state !== 'exiting');
      const timeSinceJoin = nowMs - (this.lastWorshipperJoinAt || 0);

      if (timeSinceJoin >= intervalMs && activePresences.length < 5) {
        this.spawnAmbientWorshipper();
        this.lastWorshipperJoinAt = nowMs;
      }
    }

    // 2. Giữ nhịp mốc tim: Tự động cộng vài lượt tim nhẹ để mốc chuông nhảy số
    if (config.autoLikeEnabled !== false) {
      const timeSinceActivity = nowMs - (this.lastActivityAt || 0);
      if (timeSinceActivity >= intervalMs) {
        const pulseCount = Math.floor(Math.random() * 8) + 5;
        await this.handleLike({ count: pulseCount, likeCount: pulseCount });
        this.lastActivityAt = nowMs;
      }
    }

    // 3. Giữ giọng nói AI: Định kỳ đọc lời chúc an lạc / niệm Phật nếu im ắng
    if (config.ambientSpeechEnabled !== false) {
      const timeSinceSpeech = nowMs - (this.lastSpeechAt || 0);
      if (timeSinceSpeech >= speechIntervalMs) {
        this.triggerAmbientSpeech();
        this.lastSpeechAt = nowMs;
      }
    }
  }

  spawnAmbientWorshipper() {
    const BUDDHIST_NAMES = [
      'Diệu Tâm', 'Bảo An', 'Minh Đức', 'Tuệ Quang', 'Phúc Lành',
      'Thiện Nhân', 'Thanh Tịnh', 'An Lạc', 'Tâm Nguyên', 'Chí Thiện',
      'Ngọc Hoa', 'Quang Minh', 'Hạnh Nguyện', 'Từ Bi', 'Đức Trí'
    ];
    const nickname = BUDDHIST_NAMES[Math.floor(Math.random() * BUDDHIST_NAMES.length)];
    const id = `ambient_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const username = `phattu_${Math.floor(Math.random() * 9000 + 1000)}`;

    const viewer = {
      id,
      username,
      nickname,
      avatarUrl: ''
    };

    const presence = this.upsertPresence(viewer, { temporary: true });
    if (!presence) return null;

    // Phật tử quỳ lạy trang nghiêm trong 4 - 8 phút rồi chắp tay rời đi
    const stayDurationMs = (Math.floor(Math.random() * 4) + 4) * 60 * 1000;
    presence.ambientTimer = later(() => {
      this.leavePresence(presence.id, 'ambient-cycle');
    }, stayDurationMs);

    return presence;
  }

  triggerAmbientSpeech() {
    if (this.data.settings?.aiVoice?.enabled === false) return null;
    const speech = this.speechDirector.getAmbientSpeech();
    this.lastSpeechAt = Date.now();

    this.io.emit('speech:announce', {
      id: randomUUID(),
      type: 'ambient_blessing',
      text: speech.text,
      speaker: 'Chùa An Lạc',
      createdAt: now()
    });

    return speech;
  }

  async triggerLiveProtectionNow() {
    const worshipper = this.spawnAmbientWorshipper();
    const pulseCount = Math.floor(Math.random() * 10) + 8;
    await this.handleLike({ count: pulseCount, likeCount: pulseCount });
    const speech = this.triggerAmbientSpeech();
    return {
      worshipper: worshipper ? asPublicPresence(worshipper) : null,
      likesAdded: pulseCount,
      speech
    };
  }

  destroy() {
    clearInterval(this.sweepTimer);
    clearInterval(this.ceremonyTimer);
    clearInterval(this.liveProtectionTimer);
    for (const presence of this.presences.values()) {
      clearTimeout(presence.enterTimer);
      clearTimeout(presence.exitTimer);
      clearTimeout(presence.ambientTimer);
    }
  }
}
