/* global io */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const number = new Intl.NumberFormat('vi-VN');

let state = {
  settings: { maxCharacters: 18, autoLeaveMinutes: 0, leaveKeywords: [], audio: { status: 'stopped', volume: .62, mode: 'sequential', loopList: true, repeatTrack: false } },
  gifts: [], tracks: [], metrics: {}, presences: [], live: {}
};
let simType = 'like';
let toastTimer;

const titles = { overview: 'Tổng quan chính điện', audio: 'Âm thanh & kinh', gifts: 'Quà tặng', people: 'Thiện hữu trong chùa', live: 'Kết nối TikTok LIVE' };
const escape = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formValue = (form, name) => form.elements[name]?.value ?? '';

function toast(message, error = false) {
  const target = $('#toast');
  target.textContent = message;
  target.className = `show-toast${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { target.className = ''; }, 3300);
}

function adminHeaders(json = true) {
  const headers = {};
  const token = $('#admin-token').value.trim();
  if (token) headers['x-admin-token'] = token;
  if (json) headers['content-type'] = 'application/json';
  return headers;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...adminHeaders(!(options.body instanceof FormData)), ...(options.headers || {}) }
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Yêu cầu thất bại (${response.status})`);
  return payload;
}

function showTab(tab) {
  $$('.nav-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  $$('.page').forEach((page) => page.classList.toggle('active', page.id === `${tab}-page`));
  $('#page-title').textContent = titles[tab];
}

function renderMetrics() {
  const metrics = state.metrics || {};
  $('#metric-likes').textContent = number.format(metrics.totalLikes || 0);
  $('#metric-anonymous').textContent = `${number.format(metrics.anonymousLikes || 0)} không định danh`;
  $('#metric-presence').textContent = `${metrics.presentCount || state.presences.length || 0} / ${state.settings.maxCharacters || 18}`;
  $('#metric-gifts').textContent = number.format(metrics.totalGifts || 0);
  $('#metric-queue').textContent = metrics.queuedGifts ? `${metrics.queuedGifts} quà đang chờ` : 'hàng đợi trống';
  const track = state.tracks.find((item) => item.id === state.settings.audio.currentTrackId);
  $('#metric-audio').textContent = ({ playing: 'Đang phát', paused: 'Tạm dừng', stopped: 'Đang dừng' })[state.settings.audio.status] || 'Đang dừng';
  $('#metric-track').textContent = track?.title || 'Chưa chọn bài';
}

function renderSettings() {
  const form = $('#settings-form');
  const { audio } = state.settings;
  form.elements.maxCharacters.value = state.settings.maxCharacters;
  if (form.elements.autoLeaveMinutes) form.elements.autoLeaveMinutes.value = state.settings.autoLeaveMinutes;
  if (form.elements.autoLeaveSeconds) {
    const sec = state.settings.autoLeaveSeconds !== undefined
      ? String(state.settings.autoLeaveSeconds)
      : String((state.settings.autoLeaveMinutes || 0) * 60);
    form.elements.autoLeaveSeconds.value = sec;
  }
  form.elements.leaveKeywords.value = (state.settings.leaveKeywords || []).join(', ');
  form.elements.volume.value = audio.volume;
  $('#volume-output').textContent = `${Math.round(audio.volume * 100)}%`;
  form.elements.mode.value = audio.mode;
  form.elements.loopList.checked = Boolean(audio.loopList);
  form.elements.repeatTrack.checked = Boolean(audio.repeatTrack);

  const aiVoice = state.settings.aiVoice || { enabled: true, welcomeEnabled: true, giftThanksEnabled: true, volume: 0.9, rate: 0.92, preferredVoice: '' };
  if (form.elements.aiVoiceEnabled) form.elements.aiVoiceEnabled.checked = aiVoice.enabled !== false;
  if (form.elements.aiWelcomeEnabled) form.elements.aiWelcomeEnabled.checked = aiVoice.welcomeEnabled !== false;
  if (form.elements.aiGiftThanksEnabled) form.elements.aiGiftThanksEnabled.checked = aiVoice.giftThanksEnabled !== false;
  if (form.elements.aiRate) {
    form.elements.aiRate.value = aiVoice.rate || 0.92;
    $('#ai-rate-output').textContent = `${aiVoice.rate || 0.92}x`;
  }
  if (form.elements.aiVolume) {
    form.elements.aiVolume.value = aiVoice.volume ?? 0.9;
    $('#ai-volume-output').textContent = `${Math.round((aiVoice.volume ?? 0.9) * 100)}%`;
  }
  populateVoiceSelect(aiVoice.preferredVoice || '');

  const protection = state.settings.liveProtection || {
    enabled: true,
    autoWorshipperEnabled: true,
    ambientSpeechEnabled: true,
    autoLikeEnabled: true,
    intervalMinutes: 2.5,
    speechIntervalMinutes: 4.0
  };
  if (form.elements.protectionEnabled) form.elements.protectionEnabled.checked = protection.enabled !== false;
  if (form.elements.protectionAutoWorshipper) form.elements.protectionAutoWorshipper.checked = protection.autoWorshipperEnabled !== false;
  if (form.elements.protectionAmbientSpeech) form.elements.protectionAmbientSpeech.checked = protection.ambientSpeechEnabled !== false;
  if (form.elements.protectionAutoLike) form.elements.protectionAutoLike.checked = protection.autoLikeEnabled !== false;
  if (form.elements.protectionInterval) form.elements.protectionInterval.value = protection.intervalMinutes || 2.5;
  if (form.elements.protectionSpeechInterval) form.elements.protectionSpeechInterval.value = protection.speechIntervalMinutes || 4.0;
}

function cleanVoiceText(raw) {
  return String(raw || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\p{Extended_Pictographic}]/gu, '')
    .replace(/[✦·•☸♥★☆✓✔✕✖~`@#$%^&*()_+={}\[\]|\\:;"'<>/?]/g, ' ')
    .replace(/!+/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function populateVoiceSelect(preferredVoice = '') {
  const select = $('#ai-voice-select');
  if (!select) return;
  const voices = (typeof window !== 'undefined' && 'speechSynthesis' in window)
    ? (window.speechSynthesis.getVoices() || [])
    : [];
  const viVoices = voices.filter(v => v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.startsWith('vi') || /vietnam/i.test(v.name));

  const currentVal = preferredVoice || select.value || '';
  select.innerHTML = '<option value="">✨ Giọng AI Tự Nhiên (Google Cloud TTS - Trong trẻo, 100% phát tiếng)</option>';

  viVoices.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.name;
    let label = v.name;
    if (/hoaimy|hoài\s*my/i.test(v.name)) label += ' 🌟 [Nữ - Rất truyền cảm & tự nhiên]';
    else if (/namminh|nam\s*minh/i.test(v.name)) label += ' 🌟 [Nam - Trầm ấm & tự nhiên]';
    else if (/google/i.test(v.name)) label += ' ⭐ [Google Tiếng Việt chuẩn]';
    else if (/an\b/i.test(v.name)) label += ' [Microsoft An - Cổ điển]';
    opt.textContent = label;
    if (v.name === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    populateVoiceSelect(state.settings?.aiVoice?.preferredVoice || '');
  };
}

function renderTracks() {
  const current = state.tracks.find((track) => track.id === state.settings.audio.currentTrackId);
  $('#now-track').textContent = current?.title || 'Chưa chọn bài';
  const mode = state.settings.audio;
  $('#now-mode').textContent = mode.repeatTrack ? 'Đang lặp lại một bài.' : mode.mode === 'random' ? 'Phát ngẫu nhiên trong danh sách.' : 'Phát lần lượt theo thứ tự tải lên.';
  $('#track-count').textContent = `${state.tracks.length} bài`;
  const list = $('#tracks-list');
  if (!state.tracks.length) {
    list.className = 'data-list empty-state';
    list.textContent = 'Chưa có bài âm thanh. Tải lên bản ghi có quyền sử dụng để bắt đầu.';
    return;
  }
  list.className = 'data-list';
  list.innerHTML = state.tracks.map((track) => `<div class="list-row ${track.enabled === false ? 'gift-disabled' : ''}">
    <span class="row-icon">♫</span><div class="row-main"><b>${escape(track.title)} ${track.id === mode.currentTrackId ? '<span class="status-badge">đang chọn</span>' : ''}</b><small>${track.enabled === false ? 'Đã tắt' : 'Sẵn sàng phát'} · ${escape(track.filePath)}</small></div>
    <div class="row-actions"><button data-play-track="${track.id}">Phát</button><button data-toggle-track="${track.id}">${track.enabled === false ? 'Bật' : 'Tắt'}</button><button data-edit-track="${track.id}">Sửa</button><button class="danger" data-delete-track="${track.id}">Xóa</button></div></div>`).join('');
}

function renderGiftSelect() {
  const select = $('#sim-gift');
  const selected = select.value;
  const gifts = state.gifts.filter((gift) => gift.enabled !== false);
  select.innerHTML = gifts.map((gift) => `<option value="${escape(gift.providerGiftId)}">${escape(gift.name)} · ưu tiên ${gift.priority}</option>`).join('');
  if (gifts.some((gift) => gift.providerGiftId === selected)) select.value = selected;
}

function renderGifts() {
  $('#gift-count').textContent = `${state.gifts.length} ánh xạ`;
  const list = $('#gifts-list');
  if (!state.gifts.length) {
    list.className = 'data-list empty-state'; list.textContent = 'Chưa có quà được cấu hình.'; return;
  }
  list.className = 'data-list';
  list.innerHTML = state.gifts.map((gift) => `<div class="list-row ${gift.enabled === false ? 'gift-disabled' : ''}">
    <span class="row-icon">${escape(gift.name === 'Sư Tử' ? '🦁' : '✦')}</span><div class="row-main"><b>${escape(gift.name)} <span class="gift-tag">P${gift.priority}</span></b><small>${escape(gift.providerGiftId)} · ${escape(gift.animation)} · ${gift.durationMs}ms${gift.enabled === false ? ' · tắt' : ''}</small></div>
    <div class="row-actions"><button data-edit-gift="${gift.id}">Sửa</button><button class="danger" data-delete-gift="${gift.id}">Xóa</button></div></div>`).join('');
  renderGiftSelect();
}

function renderPeople() {
  const list = $('#people-list');
  const people = state.presences || [];
  $('#presence-label').textContent = `${people.length} thiện hữu`;
  if (!people.length) { list.className = 'data-list empty-state'; list.textContent = 'Chính điện đang yên tĩnh.'; return; }
  list.className = 'data-list';
  list.innerHTML = people.map((person) => `<div class="list-row"><span class="row-icon">${escape((person.nickname || person.username || 'T')[0].toUpperCase())}</span><div class="row-main"><b>${escape(person.nickname || person.username || 'Thiện hữu')} <span class="status-badge ${person.state === 'exiting' ? 'leaving' : ''}">${person.state === 'entering' ? 'đang vào' : person.state === 'exiting' ? 'đang rời' : 'đang lễ'}</span></b><small>@${escape(person.username || person.id)} · vị trí ${person.slotIndex + 1}${person.temporary ? ' · khách vinh danh tạm thời' : ''}</small></div><div class="row-actions"><button class="danger" data-remove-person="${person.id}">Mời rời</button></div></div>`).join('');
}

function renderLive() {
  const live = state.live || {};
  const isMock = live.name === 'Mock simulator' || live.name === 'mock' || live.mode === 'simulator';
  const isWebhook = live.name === 'tiktok-webhook' || live.mode === 'webhook';
  const currentMode = isMock ? 'simulator' : (isWebhook ? 'webhook' : 'live');

  // Đổi trạng thái nút chế độ
  $$('.mode-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === currentMode));

  // Cập nhật thanh tiêu đề trên cùng
  const topbarBadge = $('#topbar-mode-badge');
  const topbarText = $('#topbar-mode-text');
  const topbarBtn = $('#topbar-toggle-mode-btn');
  if (topbarBadge && topbarText && topbarBtn) {
    topbarBadge.className = `topbar-mode-badge ${currentMode}`;
    if (currentMode === 'live') {
      topbarText.textContent = `🔴 THỰC TẾ (${live.channel || '@camsisi0'})`;
      topbarBtn.textContent = 'Chuyển Giả Lập';
    } else if (currentMode === 'simulator') {
      topbarText.textContent = '🟡 GIẢ LẬP';
      topbarBtn.textContent = 'Chuyển LIVE Thật';
    } else {
      topbarText.textContent = '🔵 WEBHOOK';
      topbarBtn.textContent = 'Chuyển LIVE Thật';
    }
  }

  const connected = ['connected', 'awaiting-webhook', 'simulated'].includes(live.status);
  $('#provider-name').textContent = currentMode === 'live'
    ? 'TikTok LIVE Thực Tế (tiktok-connector)'
    : currentMode === 'simulator'
    ? 'Chế độ Giả Lập (Mock simulator)'
    : 'Webhook TikFinity (API)';

  const status = $('#provider-status');
  status.classList.toggle('connected', connected);
  status.querySelector('span').textContent = ({
    simulated: 'Đang ở chế độ giả lập',
    'awaiting-webhook': `Đang chờ webhook cho kênh ${live.channel || '@camsisi0'}`,
    connected: `Đã kết nối LIVE (${live.channel || '@camsisi0'})`,
    connecting: `Đang kết nối phòng LIVE ${live.channel || '@camsisi0'}...`,
    disconnected: 'Đã ngắt kết nối',
    'stream-ended': 'Phiên LIVE đã kết thúc'
  })[live.status] || 'Đã ngắt kết nối';

  $('#provider-description').textContent = currentMode === 'simulator'
    ? 'Hệ thống đang chạy chế độ Giả lập. Bạn có thể bấm các nút mô phỏng ở tab Tổng quan để thử nghiệm.'
    : currentMode === 'live'
    ? `Hệ thống đang kết nối trực tiếp phòng LIVE của kênh ${live.channel || '@camsisi0'}. Mọi bình luận, thả tim, quà tặng thật sẽ tự động hiển thị lên chùa.`
    : `Đang lắng nghe sự kiện từ TikFinity hoặc TikTok Studio gửi vào webhook POST /api/live/events.`;

  const channelInput = document.querySelector('#provider-form [name="channel"]');
  if (channelInput && live.channel) channelInput.value = live.channel;
}

function renderLeaderboard() {
  const list = $('#admin-donor-list');
  if (!list) return;
  const donors = state.topDonors || [];
  if (!donors.length) {
    list.className = 'data-list empty-state';
    list.textContent = 'Chưa có pháp duyên cúng dường.';
    return;
  }
  list.className = 'data-list';
  list.innerHTML = donors.map((d, idx) => `
    <div class="list-row">
      <span class="row-icon">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}</span>
      <div class="row-main">
        <b>${escape(d.nickname || d.username || 'Thiện hữu')}</b>
        <small>@${escape(d.username || d.id)} · ${d.totalGifts || 1} quà</small>
      </div>
      <div class="row-actions">
        <strong style="color: #f7ca68;">${number.format(d.totalValue || d.totalGifts || 0)}</strong>
      </div>
    </div>
  `).join('');
}

function renderAll() {
  renderMetrics(); renderSettings(); renderTracks(); renderGifts(); renderPeople(); renderLive(); renderLeaderboard();
}

function resetGiftForm() {
  const form = $('#gift-form');
  form.reset();
  form.elements.id.value = '';
  form.elements.priority.value = 10;
  form.elements.durationMs.value = 4000;
  form.elements.thankYouTemplate.value = '🙏 Cảm ơn @{username} đã gửi {gift}!';
  form.elements.enabled.checked = true;
  $('#gift-form-title').textContent = 'Tạo ánh xạ quà';
}

function loadGiftIntoForm(id) {
  const gift = state.gifts.find((item) => item.id === id);
  if (!gift) return;
  const form = $('#gift-form');
  Object.entries(gift).forEach(([key, value]) => { if (form.elements[key] && key !== 'enabled') form.elements[key].value = value ?? ''; });
  form.elements.enabled.checked = gift.enabled !== false;
  $('#gift-form-title').textContent = `Chỉnh sửa: ${gift.name}`;
  document.getElementById('gifts-page').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectSimulation(type) {
  simType = type;
  $$('.sim-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.sim === type));
  $('.gift-field').hidden = type !== 'gift';
  $('.comment-field').hidden = type !== 'comment';
  $('#sim-count-field').hidden = type !== 'like';
  $('#simulate-submit').textContent = type === 'like' ? 'Gửi tim vào chính điện' : type === 'gift' ? 'Gửi quà và trình diễn camera' : type === 'leave' ? 'Mô phỏng người chơi lướt khỏi Live (Out)' : 'Gửi bình luận';
}

$$('.nav-tabs button').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.tab)));
$$('.sim-tab').forEach((button) => button.addEventListener('click', () => selectSimulation(button.dataset.sim)));
$('#volume-input').addEventListener('input', (event) => { $('#volume-output').textContent = `${Math.round(Number(event.target.value) * 100)}%`; });
$('#admin-token').value = sessionStorage.getItem('temple-admin-token') || '';
$('#admin-token').addEventListener('change', (event) => sessionStorage.setItem('temple-admin-token', event.target.value));

$('#simulate-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  payload.type = simType;
  if (!payload.viewerId.trim()) {
    delete payload.viewerId; delete payload.username; delete payload.nickname;
  }
  if (simType === 'like') payload.count = Number(payload.count || 1);
  if (simType === 'gift') payload.repeatCount = 1;
  try {
    const result = await api('/api/admin/simulate', { method: 'POST', body: JSON.stringify(payload) });
    toast(result.result?.anonymous ? 'Đã cộng tim ẩn danh, không tạo nhân vật.' : 'Sự kiện đã gửi vào chính điện.');
  } catch (error) { toast(error.message, true); }
});

$('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    maxCharacters: Number(formValue(form, 'maxCharacters')),
    autoLeaveMinutes: Number(formValue(form, 'autoLeaveMinutes') || 1.5),
    autoLeaveSeconds: Number(formValue(form, 'autoLeaveSeconds') || 90),
    leaveKeywords: formValue(form, 'leaveKeywords').split(',').map((item) => item.trim()).filter(Boolean),
    audio: {
      volume: Number(formValue(form, 'volume')),
      mode: formValue(form, 'mode'),
      loopList: form.elements.loopList.checked,
      repeatTrack: form.elements.repeatTrack.checked
    },
    aiVoice: {
      enabled: form.elements.aiVoiceEnabled?.checked ?? true,
      welcomeEnabled: form.elements.aiWelcomeEnabled?.checked ?? true,
      giftThanksEnabled: form.elements.aiGiftThanksEnabled?.checked ?? true,
      rate: Number(formValue(form, 'aiRate') || 0.92),
      volume: Number(formValue(form, 'aiVolume') || 0.9),
      preferredVoice: form.elements.aiPreferredVoice?.value || ''
    },
    liveProtection: {
      enabled: form.elements.protectionEnabled?.checked ?? true,
      autoWorshipperEnabled: form.elements.protectionAutoWorshipper?.checked ?? true,
      ambientSpeechEnabled: form.elements.protectionAmbientSpeech?.checked ?? true,
      autoLikeEnabled: form.elements.protectionAutoLike?.checked ?? true,
      intervalMinutes: Number(formValue(form, 'protectionInterval') || 2.5),
      speechIntervalMinutes: Number(formValue(form, 'protectionSpeechInterval') || 4.0)
    }
  };
  try {
    await api('/api/admin/settings', { method: 'POST', body: JSON.stringify(payload) });
    toast('Đã lưu cấu hình chính điện & Chế độ Treo Live 24/7.');
  } catch (error) { toast(error.message, true); }
});

$('#ai-rate-input')?.addEventListener('input', (e) => {
  $('#ai-rate-output').textContent = `${e.target.value}x`;
});

$('#ai-volume-input')?.addEventListener('input', (e) => {
  $('#ai-volume-output').textContent = `${Math.round(e.target.value * 100)}%`;
});

let adminAudioPreview = null;

function speakAdminPreview(text) {
  const clean = cleanVoiceText(text);
  if (!clean) return;
  const pref = $('#ai-voice-select')?.value || '';
  const volume = Number($('#ai-volume-input')?.value || 0.9);

  // Mặc định hoặc Google Cloud TTS: Phát qua Audio Stream (100% luôn có tiếng)
  if (!pref || pref === 'google_online') {
    if (!adminAudioPreview) adminAudioPreview = new Audio();
    adminAudioPreview.pause();
    adminAudioPreview.src = `/api/tts?text=${encodeURIComponent(clean)}`;
    adminAudioPreview.volume = Math.max(0, Math.min(1, volume));
    adminAudioPreview.play().catch(e => console.warn('Preview audio blocked:', e));
    return;
  }

  // Nếu người dùng chọn giọng Windows cụ thể
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'vi-VN';
      u.rate = Number($('#ai-rate-input')?.value || 0.92);
      u.volume = volume;
      const voices = window.speechSynthesis.getVoices() || [];
      const match = voices.find(v => v.name === pref);
      if (match) u.voice = match;

      u.onerror = () => {
        if (!adminAudioPreview) adminAudioPreview = new Audio();
        adminAudioPreview.src = `/api/tts?text=${encodeURIComponent(clean)}`;
        adminAudioPreview.volume = volume;
        adminAudioPreview.play().catch(() => {});
      };

      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setTimeout(() => window.speechSynthesis.speak(u), 60);
      } else {
        window.speechSynthesis.speak(u);
      }
      return;
    } catch (_) {}
  }

  // Fallback chung
  if (!adminAudioPreview) adminAudioPreview = new Audio();
  adminAudioPreview.src = `/api/tts?text=${encodeURIComponent(clean)}`;
  adminAudioPreview.volume = volume;
  adminAudioPreview.play().catch(() => {});
}

$('#test-speech-welcome')?.addEventListener('click', async () => {
  try {
    const res = await api('/api/admin/speech/test', {
      method: 'POST',
      body: JSON.stringify({ type: 'welcome', speaker: 'Thiện Tùng' })
    });
    toast(`🎙️ Đang phát lời chào: "${res.speech.text}"`);
    speakAdminPreview(res.speech.text);
  } catch (err) { toast(err.message, true); }
});

$('#test-speech-gift')?.addEventListener('click', async () => {
  try {
    const res = await api('/api/admin/speech/test', {
      method: 'POST',
      body: JSON.stringify({ type: 'gift', speaker: 'Minh An', giftName: 'Hoa hồng' })
    });
    toast(`🪷 Đang phát tri ân quà: "${res.speech.text}"`);
    speakAdminPreview(res.speech.text);
  } catch (err) { toast(err.message, true); }
});

$('#btn-test-ambient-speech')?.addEventListener('click', async () => {
  try {
    const res = await api('/api/admin/speech/test', {
      method: 'POST',
      body: JSON.stringify({ type: 'ambient' })
    });
    toast(`🙏 AI phát biểu an lạc: "${res.speech.text}"`);
    speakAdminPreview(res.speech.text);
  } catch (err) { toast(err.message, true); }
});

const handleTriggerProtection = async () => {
  try {
    const res = await api('/api/admin/protection/trigger', { method: 'POST' });
    const name = res.result?.worshipper?.nickname || 'Phật tử';
    const likes = res.result?.likesAdded || 10;
    toast(`🛡️ Đã kích hoạt giữ nhịp: Phật tử "${name}" vào lễ, +${likes} tim & AI niệm Phật!`);
  } catch (err) { toast(err.message, true); }
};
$('#btn-trigger-protection')?.addEventListener('click', handleTriggerProtection);
$('#btn-quick-protection')?.addEventListener('click', handleTriggerProtection);

$('#btn-admin-bell')?.addEventListener('click', async () => {
  try {
    const res = await api('/api/admin/bell/strike', {
      method: 'POST',
      body: JSON.stringify({ milestone: 1000 })
    });
    toast('🔔 Đã thỉnh 1 tiếng Đại Hồng Chung (Mốc 1.000 tim)!');
  } catch (err) { toast(err.message, true); }
});

$('#btn-admin-ceremony')?.addEventListener('click', async () => {
  try {
    const res = await api('/api/admin/ceremony/trigger', {
      method: 'POST'
    });
    toast('🙏 Đã khởi sự Đại Lễ Hồi Hướng Công Đức trong chính điện!');
  } catch (err) { toast(err.message, true); }
});

$$('[data-audio]').forEach((button) => button.addEventListener('click', async () => {
  try { await api('/api/admin/audio/action', { method: 'POST', body: JSON.stringify({ action: button.dataset.audio }) }); } catch (error) { toast(error.message, true); }
}));

$('#upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await api('/api/admin/audio/upload', { method: 'POST', body: new FormData(event.currentTarget) }); event.currentTarget.reset(); toast('Đã tải bài vào thư viện.'); } catch (error) { toast(error.message, true); }
});

$('#tracks-list').addEventListener('click', async (event) => {
  const button = event.target.closest('button'); if (!button) return;
  const playId = button.dataset.playTrack, toggleId = button.dataset.toggleTrack, editId = button.dataset.editTrack, deleteId = button.dataset.deleteTrack;
  try {
    if (playId) await api('/api/admin/audio/action', { method: 'POST', body: JSON.stringify({ action: 'play', trackId: playId }) });
    if (toggleId) { const track = state.tracks.find((item) => item.id === toggleId); await api(`/api/admin/audio/${toggleId}`, { method: 'PATCH', body: JSON.stringify({ enabled: !track.enabled }) }); }
    if (editId) { const track = state.tracks.find((item) => item.id === editId); const title = window.prompt('Tên bài kinh', track.title); if (title?.trim()) await api(`/api/admin/audio/${editId}`, { method: 'PATCH', body: JSON.stringify({ title }) }); }
    if (deleteId && window.confirm('Xóa bài này khỏi playlist? File tải lên được giữ lại để tránh mất dữ liệu ngoài ý muốn.')) await api(`/api/admin/audio/${deleteId}`, { method: 'DELETE' });
  } catch (error) { toast(error.message, true); }
});

$('#gift-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  payload.priority = Number(payload.priority); payload.durationMs = Number(payload.durationMs); payload.enabled = form.elements.enabled.checked;
  const id = payload.id; delete payload.id;
  try {
    await api(id ? `/api/admin/gifts/${id}` : '/api/admin/gifts', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    toast(id ? 'Đã cập nhật quà tặng.' : 'Đã tạo ánh xạ quà.'); resetGiftForm();
  } catch (error) { toast(error.message, true); }
});
$('#gift-reset').addEventListener('click', resetGiftForm);
$('#gifts-list').addEventListener('click', async (event) => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.editGift) loadGiftIntoForm(button.dataset.editGift);
  if (button.dataset.deleteGift && window.confirm('Xóa ánh xạ quà này?')) {
    try { await api(`/api/admin/gifts/${button.dataset.deleteGift}`, { method: 'DELETE' }); toast('Đã xóa ánh xạ quà.'); } catch (error) { toast(error.message, true); }
  }
});

$('#people-list').addEventListener('click', async (event) => {
  const id = event.target.closest('[data-remove-person]')?.dataset.removePerson;
  if (!id) return;
  try { const output = await api(`/api/admin/participants/${encodeURIComponent(id)}/remove`, { method: 'POST' }); toast(output.removed ? 'Nhân vật đang rời về cổng.' : 'Nhân vật không còn trong chính điện.'); } catch (error) { toast(error.message, true); }
});

$$('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const mode = btn.dataset.mode;
    const channel = $('#provider-form [name="channel"]')?.value || '@camsisi0';
    try {
      const res = await api('/api/admin/live/mode', {
        method: 'POST',
        body: JSON.stringify({ mode, channel })
      });
      state.live = res.live;
      renderLive();
      toast(mode === 'live' ? `Đã chuyển sang TikTok LIVE Thực Tế (${channel})` : mode === 'simulator' ? 'Đã chuyển sang chế độ Giả Lập' : 'Đã chuyển sang Webhook TikFinity');
    } catch (err) {
      toast(err.message, true);
    }
  });
});

$('#topbar-toggle-mode-btn')?.addEventListener('click', async () => {
  const isLive = state.live?.mode === 'live' || state.live?.name === 'tiktok-connector';
  const nextMode = isLive ? 'simulator' : 'live';
  const channel = state.live?.channel || '@camsisi0';
  try {
    const res = await api('/api/admin/live/mode', {
      method: 'POST',
      body: JSON.stringify({ mode: nextMode, channel })
    });
    state.live = res.live;
    renderLive();
    toast(nextMode === 'live' ? `Đã chuyển sang TikTok LIVE Thực Tế (${channel})` : 'Đã chuyển sang chế độ Giả Lập');
  } catch (err) {
    toast(err.message, true);
  }
});

$('#provider-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await api('/api/admin/live/connect', { method: 'POST', body: JSON.stringify({ channel: formValue(event.currentTarget, 'channel') }) }); toast('Nguồn sự kiện đã được bật.'); } catch (error) { toast(error.message, true); }
});
$('#disconnect-live').addEventListener('click', async () => {
  try { await api('/api/admin/live/disconnect', { method: 'POST', body: '{}' }); toast('Đã ngắt nguồn sự kiện.'); } catch (error) { toast(error.message, true); }
});

const socket = io();
socket.on('connect', () => $('#connection-state').className = 'connection connected');
socket.on('disconnect', () => $('#connection-state').className = 'connection disconnected');
socket.on('temple:snapshot', (snapshot) => { state = snapshot; renderAll(); });
socket.on('metrics:update', (metrics) => { state.metrics = { ...state.metrics, ...metrics }; renderMetrics(); });
socket.on('temple:presence:upsert', (person) => { const index = state.presences.findIndex((item) => item.id === person.id); if (index >= 0) state.presences[index] = person; else state.presences.push(person); renderPeople(); renderMetrics(); });
socket.on('temple:presence:remove', ({ id }) => { state.presences = state.presences.filter((person) => person.id !== id); renderPeople(); renderMetrics(); });
socket.on('audio:state', (audio) => { state.settings.audio = { ...state.settings.audio, ...audio }; state.tracks = audio.tracks || state.tracks; renderMetrics(); renderTracks(); });
socket.on('settings:update', (settings) => { state.settings = settings; renderSettings(); renderMetrics(); });
socket.on('live:status', (live) => { state.live = live; renderLive(); });
socket.on('leaderboard:update', (donors) => { state.topDonors = donors; renderLeaderboard(); });

$('#reset-leaderboard-btn')?.addEventListener('click', async () => {
  if (!confirm('Đặt lại bảng vàng cúng dường về 0 cho phiên livestream mới?')) return;
  try {
    await api('/api/admin/leaderboard/reset', { method: 'POST' });
    state.topDonors = [];
    renderLeaderboard();
    toast('Đã đặt lại bảng vàng.');
  } catch (err) {
    toast(err.message, true);
  }
});

const BUDDHIST_NAMES = [
  'Diệu Tâm', 'Bảo An', 'Minh Đức', 'Tuệ Quang', 'Phúc Lành', 
  'Thiện Nhân', 'Thanh Tịnh', 'An Lạc', 'Tâm Nguyên', 'Chí Thiện',
  'Ngọc Hoa', 'Quang Minh', 'Hạnh Nguyện', 'Từ Bi', 'Đức Trí'
];

$$('[data-quick]').forEach((btn) => btn.addEventListener('click', async () => {
  const action = btn.dataset.quick;
  try {
    const idx = Math.floor(Math.random() * BUDDHIST_NAMES.length);
    const name = BUDDHIST_NAMES[idx];
    const id = `pt_${Date.now() % 100000}`;
    if (action === 'leave-active') {
      const activePerson = (state.presences || []).find((p) => p.state !== 'exiting');
      if (!activePerson) {
        toast('Không có Phật tử nào đang trong chính điện để rời đi.', true);
        return;
      }
      await api('/api/admin/simulate', {
        method: 'POST',
        body: JSON.stringify({
          type: 'leave',
          viewerId: activePerson.id,
          username: activePerson.username || activePerson.id,
          nickname: activePerson.nickname
        })
      });
      toast(`🚪 Phật tử ${activePerson.nickname || activePerson.username} đã lướt khỏi live (Out)`);
      return;
    }
    if (action === 'like-10' || action === 'like-100' || action === 'like-1000') {
      const count = action === 'like-10' ? 10 : action === 'like-100' ? 100 : 1000;
      await api('/api/admin/simulate', {
        method: 'POST',
        body: JSON.stringify({ type: 'like', count })
      });
      toast(`💖 Đã gửi +${count} lượt tim vào chính điện!`);
      return;
    }
    if (action === 'like-random') {
      await api('/api/admin/simulate', {
        method: 'POST',
        body: JSON.stringify({ type: 'like', viewerId: id, username: `pt_${id}`, nickname: name, count: 1 })
      });
      toast(`Đã thêm Phật tử: ${name}`);
    } else if (action === 'gift-lotus' || action === 'gift-bell' || action === 'gift-lion') {
      const giftId = action === 'gift-lotus' ? 'lotus' : action === 'gift-bell' ? 'bell' : 'lion';
      const giftName = action === 'gift-lotus' ? 'Hoa sen' : action === 'gift-bell' ? 'Chuông chùa' : 'Sư Tử';
      await api('/api/admin/simulate', {
        method: 'POST',
        body: JSON.stringify({ type: 'gift', giftId, viewerId: id, username: `pt_${id}`, nickname: name, repeatCount: 1 })
      });
      toast(`Đã gửi quà: ${giftName} từ ${name}`);
    } else if (action === 'comment-pray') {
      await api('/api/admin/simulate', {
        method: 'POST',
        body: JSON.stringify({ type: 'comment', viewerId: id, username: `pt_${id}`, nickname: name, text: 'Nam mô A Di Đà Phật 🙏' })
      });
      toast(`Đã gửi bình luận niệm Phật từ ${name}`);
    } else if (action === 'comment-fortune') {
      const activePerson = (state.presences || []).find((p) => p.state !== 'exiting');
      const vId = activePerson?.id || id;
      const vName = activePerson?.nickname || name;
      await api('/api/admin/simulate', {
        method: 'POST',
        body: JSON.stringify({ type: 'comment', viewerId: vId, username: `pt_${vId}`, nickname: vName, text: 'gieo quẻ' })
      });
      toast(`🎋 Phật tử ${vName} vừa gieo quẻ xăm Quán Âm!`);
    }
  } catch (err) {
    toast(err.message, true);
  }
}));

try {
  const response = await fetch('/api/state');
  state = await response.json();
  renderAll();
  resetGiftForm();
} catch (error) { toast(`Không tải được trạng thái: ${error.message}`, true); }
