/*
  This boundary deliberately does not scrape TikTok or open undocumented LIVE
  sockets. In production, point an authorized provider/API at /api/live/events
  and validate its secret/signature before normalized events reach the game.
*/
export class LiveProvider {
  constructor({ name = 'Mock simulator', onEvent, onStatus }) {
    this.name = name;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.status = 'disconnected';
    this.channel = '';
  }

  connect(channel = '') {
    this.channel = String(channel || '').trim();
    this.status = this.name === 'Mock simulator' ? 'simulated' : 'awaiting-webhook';
    this.onStatus?.(this.snapshot());
    return this.snapshot();
  }

  disconnect() {
    this.status = 'disconnected';
    this.onStatus?.(this.snapshot());
    return this.snapshot();
  }

  snapshot() {
    return { name: this.name, status: this.status, channel: this.channel };
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
    } else if (!['like', 'gift', 'comment', 'fortune'].includes(type)) {
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
    } else if (type === 'gift') {
      normalized.giftId = data.giftId || data.giftName || raw.giftId || raw.giftName;
      normalized.giftName = data.giftName || raw.giftName;
      normalized.repeatCount = Number(data.repeatCount || data.count || raw.repeatCount || 1);
      normalized.giftImageUrl = data.giftImageUrl || data.imageUrl || raw.giftImageUrl || '';
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
      throw new Error('Sự kiện LIVE không hợp lệ. Hỗ trợ: like, gift, comment, leave, fortune.');
    }
    if (this.status !== 'connected' && this.name !== 'Mock simulator') {
      this.status = 'connected';
      this.onStatus?.(this.snapshot());
    }
    return this.onEvent(event);
  }
}
