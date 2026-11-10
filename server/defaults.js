export const MAX_SLOTS = 36;

export const defaultGifts = [
  {
    id: 'rose', providerGiftId: 'rose', name: 'Hoa hồng', imageUrl: '',
    animation: 'offer-flower', soundUrl: '', durationMs: 3600,
    thankYouTemplate: '🙏 Cảm ơn @{username} đã dâng {gift}!', priority: 10,
    specialEffect: 'petals', enabled: true
  },
  {
    id: 'small-gift', providerGiftId: 'small-gift', name: 'Quà nhỏ', imageUrl: '',
    animation: 'lantern', soundUrl: '', durationMs: 3800,
    thankYouTemplate: '🙏 Cảm ơn @{username} đã thắp sáng một ngọn đèn!', priority: 20,
    specialEffect: 'lantern', enabled: true
  },
  {
    id: 'lotus', providerGiftId: 'lotus', name: 'Hoa sen', imageUrl: '',
    animation: 'lotus', soundUrl: '', durationMs: 4400,
    thankYouTemplate: '🙏 Cảm ơn @{username} đã dâng {gift} thanh tịnh!', priority: 35,
    specialEffect: 'lotus', enabled: true
  },
  {
    id: 'bell', providerGiftId: 'bell', name: 'Chuông chùa', imageUrl: '',
    animation: 'bell', soundUrl: '/assets/temple_bell.wav', durationMs: 5000,
    thankYouTemplate: '🙏 Cảm ơn @{username} đã gửi {gift}!', priority: 60,
    specialEffect: 'golden-bell', enabled: true
  },
  {
    id: 'lion', providerGiftId: 'lion', name: 'Sư Tử', imageUrl: '',
    animation: 'lion-ceremony', soundUrl: '', durationMs: 5600,
    thankYouTemplate: '🙏 Cảm ơn @{username} đã gửi tặng {gift}!', priority: 100,
    specialEffect: 'lion', enabled: true
  }
];

export const defaultTracks = [
  {
    id: 'track_tieng_mo_thanh_tinh',
    title: 'Tiếng Mõ Chùa Tụng Niệm (Thanh Tịnh Không Bản Quyền)',
    filePath: '/uploads/audio/tieng-mo-chua-thanh-tinh-an-lac.wav',
    enabled: true
  },
  {
    id: 'track_chuong_bat_nha_suoi_thien',
    title: 'Chuông Bát Nhã & Suối Rừng Thiền (An Lạc Không Bản Quyền)',
    filePath: '/uploads/audio/chuong-bat-nha-va-suoi-thien.wav',
    enabled: true
  }
];

export const defaultState = () => ({
  settings: {
    maxCharacters: 18,
    autoLeaveMinutes: 0,
    autoLeaveSeconds: 90,
    leaveKeywords: ['!roi', '!rời', 'rời chùa'],
    audio: {
      status: 'stopped',
      currentTrackId: null,
      volume: 0.62,
      mode: 'sequential',
      loopList: true,
      repeatTrack: false,
      revision: 0
    },
    aiVoice: {
      enabled: true,
      welcomeEnabled: true,
      giftThanksEnabled: true,
      volume: 0.9,
      rate: 0.92,
      preferredVoice: ''
    },
    liveProtection: {
      enabled: true,
      autoWorshipperEnabled: true,
      ambientSpeechEnabled: true,
      autoLikeEnabled: true,
      intervalMinutes: 2.5,
      speechIntervalMinutes: 4.0
    }
  },
  gifts: defaultGifts,
  tracks: [],
  topDonors: [],
  metrics: {
    totalLikes: 0,
    totalGifts: 0,
    totalGiftValue: 0,
    anonymousLikes: 0,
    lastGiftAt: null
  },
  meta: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
});

export function normalizeState(source) {
  const initial = defaultState();
  const state = source && typeof source === 'object' ? source : {};
  return {
    ...initial,
    ...state,
    settings: {
      ...initial.settings,
      ...(state.settings || {}),
      audio: { ...initial.settings.audio, ...(state.settings?.audio || {}) },
      aiVoice: { ...initial.settings.aiVoice, ...(state.settings?.aiVoice || {}) },
      liveProtection: { ...initial.settings.liveProtection, ...(state.settings?.liveProtection || {}) }
    },
    gifts: Array.isArray(state.gifts) ? state.gifts : initial.gifts,
    tracks: Array.isArray(state.tracks) ? state.tracks : [],
    topDonors: Array.isArray(state.topDonors) ? state.topDonors : [],
    metrics: { ...initial.metrics, ...(state.metrics || {}) },
    meta: { ...initial.meta, ...(state.meta || {}) }
  };
}

export function publicGift(gift) {
  return {
    id: gift.id,
    providerGiftId: gift.providerGiftId,
    name: gift.name,
    imageUrl: gift.imageUrl || '',
    animation: gift.animation || 'none',
    soundUrl: gift.soundUrl || '',
    durationMs: Number(gift.durationMs) || 4000,
    thankYouTemplate: gift.thankYouTemplate || '🙏 Cảm ơn @{username} đã gửi {gift}!',
    priority: Number(gift.priority) || 0,
    specialEffect: gift.specialEffect || 'none',
    enabled: gift.enabled !== false
  };
}
