import { TikTokLiveConnection } from 'tiktok-live-connector';

const TIKTOK_GIFT_NAME_MAP = [
  { match: (id, name, desc) => id === '5655' || id === '5269' || /rose|hồng/i.test(name) || /rose|hồng/i.test(desc), name: 'Hoa hồng', id: 'rose' },
  { match: (id, name, desc) => id === '8916' || /finger\s*heart|bắn\s*tim/i.test(name) || /bắn\s*tim/i.test(desc), name: 'Bắn tim', id: 'heart' },
  { match: (id, name, desc) => /spring/i.test(name) || /mùa\s*xuân/i.test(name) || /mùa\s*xuân/i.test(desc), name: 'Bó hoa mùa xuân', id: 'spring-bouquet' },
  { match: (id, name, desc) => /bouquet|bó\s*hoa/i.test(name) || /bó\s*hoa/i.test(desc), name: 'Bó hoa', id: 'bouquet' },
  { match: (id, name, desc) => /love\s*you|yêu\s*bạn/i.test(name) || /yêu\s*bạn/i.test(desc), name: 'Yêu bạn', id: 'love-you' },
  { match: (id, name, desc) => /clover|cỏ\s*bốn\s*lá/i.test(name) || /cỏ/i.test(desc), name: 'Cỏ bốn lá 10xu', id: 'clover' },
  { match: (id, name, desc) => /very\s*good|rất\s*tốt/i.test(name) || /rất\s*tốt/i.test(desc), name: 'Rất tốt', id: 'good' },
  { match: (id, name, desc) => /lotus|hoa\s*sen|sen/i.test(name) || /sen/i.test(desc), name: 'Hoa sen', id: 'lotus' },
  { match: (id, name, desc) => /bell|chuông/i.test(name) || /chuông/i.test(desc), name: 'Chuông chùa', id: 'bell' },
  { match: (id, name, desc) => /lion|sư\s*tử/i.test(name) || /sư\s*tử/i.test(desc), name: 'Sư Tử', id: 'lion' }
];

export function extractGift(data = {}) {
  const rawObj = data.gift || data.giftDetails || data.extendedGiftInfo || {};
  const rawId = String(data.giftId || rawObj.id || '').trim();
  const rawName = String(data.giftName || rawObj.name || '').trim();
  const rawDesc = String(data.describe || rawObj.describe || data.common?.displayText?.defaultPattern || '').trim();
  const imageUrl = String(data.giftPictureUrl || rawObj.image?.urlList?.[0] || rawObj.icon?.urlList?.[0] || rawObj.giftImage?.urlList?.[0] || '').trim();

  for (const item of TIKTOK_GIFT_NAME_MAP) {
    if (item.match(rawId, rawName, rawDesc)) {
      return {
        id: item.id,
        name: item.name,
        imageUrl
      };
    }
  }

  const fallbackName = rawName || rawDesc || (rawId ? `Quà tặng ${rawId}` : 'Quà tặng');
  return {
    id: rawId || 'generic',
    name: fallbackName,
    imageUrl
  };
}

function extractViewer(data = {}) {
  const user = data.user || {};
  const id = data.userId || user.idStr || user.id || data.uniqueId || user.displayId || user.uniqueId;
  const username = data.uniqueId || user.displayId || user.uniqueId || data.username || (id ? `user_${String(id).slice(-4)}` : '');
  const nickname = data.nickname || user.nickname || data.displayName || user.displayName || username || 'Thiện hữu';
  const avatarUrl = data.profilePictureUrl
    || user.avatarThumb?.urlList?.[0]
    || user.avatarLarge?.urlList?.[0]
    || user.avatarMedium?.urlList?.[0]
    || data.userDetails?.profilePictureUrls?.[0]
    || '';

  if (!id && !username) return null;
  return {
    id: String(id || username),
    username: String(username),
    nickname: String(nickname),
    avatarUrl: String(avatarUrl)
  };
}

export class LiveProvider {
  constructor({ name = 'tiktok-connector', onEvent, onStatus, forwardUrl = process.env.FORWARD_TO_URL, webhookSecret = process.env.LIVE_WEBHOOK_SECRET }) {
    this.name = name;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.forwardUrl = forwardUrl;
    this.webhookSecret = webhookSecret;
    this.status = 'disconnected';
    this.channel = '';
    this.liveConnection = null;
    this.reconnectTimer = null;
    this.roomId = null;
  }

  setMode(mode = 'live', channel = '') {
    if (channel) this.channel = String(channel).trim();
    if (mode === 'simulator' || mode === 'mock') {
      this.disconnect();
      this.name = 'Mock simulator';
      this.status = 'simulated';
      this.onStatus?.(this.snapshot());
      return this.snapshot();
    }
    if (mode === 'webhook') {
      this.disconnect();
      this.name = 'tiktok-webhook';
      this.status = 'awaiting-webhook';
      this.onStatus?.(this.snapshot());
      return this.snapshot();
    }
    // Chế độ live thực tế
    this.name = 'tiktok-connector';
    return this.connect(this.channel || channel || '@camsisi0');
  }

  connect(channel = '') {
    this.channel = String(channel || '').trim();
    const clean = this.channel.replace(/^@/, '').trim();

    if (!clean || this.name === 'Mock simulator') {
      this.status = this.name === 'Mock simulator' ? 'simulated' : 'awaiting-webhook';
      this.onStatus?.(this.snapshot());
      return this.snapshot();
    }

    if (this.name === 'tiktok-webhook' || this.name === 'Authorized TikTok API') {
      this.status = 'awaiting-webhook';
      this.onStatus?.(this.snapshot());
      return this.snapshot();
    }

    // Kết nối trực tiếp TikTok LIVE qua TikTokLiveConnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.liveConnection) {
      try { this.liveConnection.disconnect(); } catch {}
      this.liveConnection = null;
    }

    this.status = 'connecting';
    this.onStatus?.(this.snapshot());

    // Khởi chạy kết nối bất đồng bộ
    this.#initDirectConnection(clean).catch((err) => {
      console.warn(`[TikTok LIVE] Lỗi khởi tạo kết nối: ${err.message}`);
    });

    return this.snapshot();
  }

  async #initDirectConnection(username) {
    try {
      this.liveConnection = new TikTokLiveConnection(username, {
        processInitialData: false,
        fetchRoomInfoOnConnect: true
      });

      this.liveConnection.on('chat', (data) => {
        const comment = String(data.comment || data.content || '').trim();
        const viewer = extractViewer(data);
        const uid = viewer?.username || 'viewer';
        const nickname = viewer?.nickname || uid;

        console.log(`[TikTok LIVE Chat] 💬 @${uid} (${nickname}): "${comment}"`);

        this.ingest({
          type: 'comment',
          eventId: `tt-chat-${data.msgId || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          data: {
            text: comment,
            viewer: viewer || undefined
          }
        }).catch((err) => console.error('[LiveProvider] Lỗi xử lý comment:', err.message));
      });

      this.liveConnection.on('gift', (data) => {
        const viewer = extractViewer(data);
        const uid = viewer?.username || 'viewer';
        const nickname = viewer?.nickname || uid;

        const giftInfo = extractGift(data);
        const giftName = giftInfo.name;
        const giftId = giftInfo.id;
        const repeatCount = Number(data.repeatCount || data.count || 1);
        const giftImageUrl = giftInfo.imageUrl;

        console.log(`[TikTok LIVE Gift] 🎁 @${uid} (${nickname}) tặng: ${giftName} x${repeatCount}`);

        this.ingest({
          type: 'gift',
          eventId: `tt-gift-${data.msgId || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          data: {
            giftId,
            giftName,
            repeatCount,
            giftImageUrl,
            viewer: viewer || undefined
          }
        }).catch((err) => console.error('[LiveProvider] Lỗi xử lý gift:', err.message));
      });

      this.liveConnection.on('like', (data) => {
        const viewer = extractViewer(data);
        const likeCount = Number(data.count || data.likeCount || 1);
        const total = data.total ? Number(data.total) : (data.totalLikeCount ? Number(data.totalLikeCount) : undefined);

        console.log(`[TikTok LIVE Like] ♥ ${viewer ? `@${viewer.username} (${viewer.nickname})` : 'Ẩn danh'} thả ${likeCount} tim (Mốc: ${total || 'N/A'})`);

        this.ingest({
          type: 'like',
          eventId: `tt-like-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          data: {
            count: likeCount,
            total,
            viewer: viewer || undefined
          }
        }).catch((err) => console.error('[LiveProvider] Lỗi xử lý like:', err.message));
      });

      this.liveConnection.on('follow', (data) => {
        const viewer = extractViewer(data);
        if (!viewer) return;
        console.log(`[TikTok LIVE Follow] 🌸 @${viewer.username} (${viewer.nickname}) vừa bấm theo dõi kênh!`);

        this.ingest({
          type: 'follow',
          eventId: `tt-follow-${data.msgId || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          data: {
            viewer
          }
        }).catch((err) => console.error('[LiveProvider] Lỗi xử lý follow:', err.message));
      });

      this.liveConnection.on('social', (data) => {
        const key = data.common?.displayText?.key || data.displayType || '';
        if (typeof key === 'string' && key.toLowerCase().includes('follow')) {
          const viewer = extractViewer(data);
          if (!viewer) return;
          console.log(`[TikTok LIVE Follow] 🌸 @${viewer.username} (${viewer.nickname}) vừa bấm theo dõi kênh!`);
          this.ingest({
            type: 'follow',
            eventId: `tt-follow-${data.msgId || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            data: { viewer }
          }).catch(() => {});
        }
      });

      this.liveConnection.on('member', (data) => {
        const viewer = extractViewer(data);
        if (!viewer) return;

        this.ingest({
          type: 'like',
          eventId: `tt-join-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          data: {
            count: 1,
            viewer
          }
        }).catch(() => {});
      });

      this.liveConnection.on('disconnected', () => {
        console.warn(`[TikTok LIVE] Mất kết nối phòng @${username}. Sẽ thử kết nối lại sau 15s...`);
        this.status = 'disconnected';
        this.onStatus?.(this.snapshot());
        this.#scheduleReconnect(username);
      });

      this.liveConnection.on('streamEnd', () => {
        console.warn(`[TikTok LIVE] Phiên phát sóng của @${username} đã kết thúc.`);
        this.status = 'stream-ended';
        this.onStatus?.(this.snapshot());
        this.#scheduleReconnect(username);
      });

      const state = await this.liveConnection.connect();
      this.status = 'connected';
      this.roomId = state?.roomId || null;
      console.log(`[TikTok LIVE] ✅ ĐÃ KẾT NỐI THÀNH CÔNG phòng LIVE @${username} (Room ID: ${this.roomId})`);
      this.onStatus?.(this.snapshot());
    } catch (err) {
      console.warn(`[TikTok LIVE] Chưa kết nối được phòng @${username}: ${err.message}`);
      this.status = 'disconnected';
      this.onStatus?.(this.snapshot());
      this.#scheduleReconnect(username);
    }
  }

  #scheduleReconnect(username) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.status !== 'connected' && this.channel) {
        console.log(`[TikTok LIVE] Đang thử kết nối lại @${username}...`);
        this.#initDirectConnection(username).catch(() => {});
      }
    }, 15000);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.liveConnection) {
      try { this.liveConnection.disconnect(); } catch {}
      this.liveConnection = null;
    }
    this.status = 'disconnected';
    this.onStatus?.(this.snapshot());
    return this.snapshot();
  }

  snapshot() {
    const mode = (this.name === 'Mock simulator' || this.name === 'mock')
      ? 'simulator'
      : (this.name === 'tiktok-webhook' ? 'webhook' : 'live');
    return {
      name: this.name,
      mode,
      status: this.status,
      channel: this.channel,
      roomId: this.roomId
    };
  }

  normalizeEvent(raw = {}) {
    if (!raw || typeof raw !== 'object') return null;
    let type = String(raw.type || raw.event || raw.action || raw.eventType || '').toLowerCase();

    // Chuẩn hóa tên sự kiện từ TikFinity hoặc TikTokLive connector
    if (type === 'chat' || type === 'message') type = 'comment';
    if (type === 'likes') type = 'like';
    if (type === 'gifts') type = 'gift';

    // Phát hiện sự kiện người xem rời phòng / lướt khỏi live
    const isLeave = ['leave', 'member_leave', 'user_leave', 'swipe_away', 'swipe-away', 'disconnect', 'out'].includes(type)
      || (type === 'member' && (raw.action === 'leave' || raw.action === 3 || raw.leave === true || String(raw.displayType || '').includes('leave')));

    if (isLeave) {
      type = 'leave';
    } else if (!['like', 'gift', 'comment', 'fortune', 'follow'].includes(type)) {
      return null;
    }

    const data = (raw.data && typeof raw.data === 'object') ? raw.data : raw;
    const rawViewer = data.viewer || data.sender || data.user || {};
    const id = rawViewer.id || rawViewer.userId || rawViewer.uniqueId || data.userId || data.uniqueId || data.author || raw.userId;
    const username = rawViewer.username || rawViewer.uniqueId || data.username || data.uniqueId || (id ? `user_${String(id).slice(-4)}` : '');
    const nickname = rawViewer.nickname || rawViewer.displayName || data.nickname || data.displayName || username;
    const avatarUrl = rawViewer.avatarUrl || rawViewer.avatar || data.avatarUrl || data.avatar || '';

    const viewer = id ? { id: String(id), username: String(username), nickname: String(nickname), avatarUrl: String(avatarUrl) } : undefined;

    const normalized = {
      type,
      eventId: raw.eventId || data.eventId || raw.id || data.id || `live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      viewer
    };

    if (type === 'like') {
      normalized.count = Number(data.count || data.likeCount || data.likes || raw.count || 1);
      if (data.total !== undefined || raw.total !== undefined) {
        normalized.total = Number(data.total ?? raw.total);
      }
    } else if (type === 'follow') {
      normalized.viewer = viewer;
    } else if (type === 'gift') {
      const giftInfo = extractGift(data);
      normalized.giftId = data.giftId || raw.giftId || giftInfo.id;
      normalized.giftName = data.giftName || raw.giftName || giftInfo.name;
      normalized.repeatCount = Number(data.repeatCount || data.count || raw.repeatCount || 1);
      normalized.giftImageUrl = data.giftImageUrl || data.imageUrl || raw.giftImageUrl || giftInfo.imageUrl || '';
    } else if (type === 'comment') {
      normalized.text = String(data.text || data.comment || data.message || data.content || raw.text || '');
    } else if (type === 'leave') {
      normalized.reason = String(data.reason || raw.reason || 'swipe-away');
    }

    return normalized;
  }

  async ingest(rawEvent) {
    const event = this.normalizeEvent(rawEvent);
    if (!event) {
      throw new Error('Sự kiện LIVE không hợp lệ. Hỗ trợ: like, gift, comment, leave, fortune, follow.');
    }
    if (this.status !== 'connected' && this.name !== 'Mock simulator') {
      this.status = 'connected';
      this.onStatus?.(this.snapshot());
    }

    // Nếu cấu hình chuyển tiếp sang Render để hiển thị trên link Render
    if (this.forwardUrl && !rawEvent._forwarded) {
      fetch(this.forwardUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-live-secret': this.webhookSecret || 'chua_online_secret_2026'
        },
        body: JSON.stringify({ ...rawEvent, _forwarded: true })
      }).catch((err) => {
        console.warn('[LiveProvider] Không chuyển tiếp được sang Render:', err.message);
      });
    }

    return this.onEvent(event);
  }
}
