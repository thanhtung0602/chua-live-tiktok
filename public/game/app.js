/* global Phaser, io */
const WIDTH = 1080;
const HEIGHT = 1920;
const GATE = { x: 540, y: 1980 };

// 36 vị trí bồ đoàn lễ Phật khớp với sàn gạch 3 dãy đệm 2 bên chính điện 9:16
const PRAYER_SLOTS = [
  // Hàng 1 (Gần bàn thờ nhất)
  [120, 1420], [230, 1420], [340, 1420], [740, 1420], [850, 1420], [960, 1420],
  // Hàng 2
  [100, 1490], [220, 1490], [340, 1490], [740, 1490], [860, 1490], [980, 1490],
  // Hàng 3
  [80, 1565], [210, 1565], [340, 1565], [740, 1565], [870, 1565], [1000, 1565],
  // Hàng 4
  [60, 1645], [200, 1645], [340, 1645], [740, 1645], [880, 1645], [1020, 1645],
  // Hàng 5
  [40, 1730], [190, 1730], [340, 1730], [740, 1730], [890, 1730], [1040, 1730],
  // Hàng 6 (Gần camera nhất, đệm lớn nhất)
  [20, 1825], [180, 1825], [340, 1825], [740, 1825], [900, 1825], [1060, 1825]
];

const $ = (selector) => document.querySelector(selector);
const compactNumber = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const fullNumber = new Intl.NumberFormat('vi-VN');
const giftSymbols = { 'Hoa hồng': '✿', 'Quà nhỏ': '🏮', 'Hoa sen': '🪷', 'Chuông chùa': '🔔', 'Sư Tử': '🦁' };

const ui = {
  likes: $('#likes-count'),
  people: $('#presence-count'),
  gifts: $('#gifts-count'),
  live: $('#live-status'),
  bellFill: $('#bell-progress-fill'),
  bellCount: $('#bell-progress-count'),
  ceremonyCountdown: $('#ceremony-countdown'),
  ceremonyAttendees: $('#ceremony-attendees'),
  bellBanner: $('#bell-milestone-banner'),
  bellBannerSub: $('#bell-milestone-sub'),
  ceremonyOverlay: $('#ceremony-overlay'),
  card: $('#gift-card'),
  avatar: $('#gift-avatar'),
  initials: $('#gift-initials'),
  nickname: $('#gift-nickname'),
  username: $('#gift-username'),
  thanks: $('#gift-thanks'),
  giftImage: $('#gift-image'),
  giftSymbol: $('#gift-symbol'),
  giftName: $('#gift-name'),
  soundPrompt: $('#sound-prompt'),
  donorList: $('#donor-list'),
  showBellMilestone(payload) {
    if (!this.bellBanner) return;
    if (this.bellBannerSub && payload?.milestone) {
      this.bellBannerSub.textContent = `Hoàn thành mốc ${payload.milestone.toLocaleString('vi-VN')} lượt tim công đức`;
    }
    this.bellBanner.setAttribute('aria-hidden', 'false');
    this.bellBanner.classList.add('is-visible');
    setTimeout(() => {
      this.bellBanner.classList.remove('is-visible');
      this.bellBanner.setAttribute('aria-hidden', 'true');
    }, 4500);
  },
  showCeremonyOverlay(show) {
    if (!this.ceremonyOverlay) return;
    this.ceremonyOverlay.classList.toggle('is-active', Boolean(show));
    this.ceremonyOverlay.setAttribute('aria-hidden', show ? 'false' : 'true');

    const lotusField = document.getElementById('ceremony-lotus-field');
    if (show) {
      this.startLotusShower(lotusField);
    } else {
      this.stopLotusShower(lotusField);
    }
  },
  startLotusShower(container) {
    this.stopLotusShower(container);
    if (!container) return;
    container.innerHTML = '';
    const icons = ['🪷', '🌸', '🪷', '✨', '🪷', '🌸'];

    const spawn = () => {
      const el = document.createElement('div');
      el.className = 'ceremony-lotus-petal';
      el.textContent = icons[Math.floor(Math.random() * icons.length)];
      const left = Math.random() * 92 + 4;
      const duration = 4.5 + Math.random() * 3.5;
      const delay = Math.random() * 0.4;
      const size = 18 + Math.random() * 22;
      el.style.left = `${left}%`;
      el.style.fontSize = `${size}px`;
      el.style.animationDuration = `${duration}s`;
      el.style.animationDelay = `${delay}s`;
      container.appendChild(el);
      setTimeout(() => el.remove(), (duration + delay + 0.5) * 1000);
    };

    // Tạo ngay đợt đầu tiên 16 đóa sen
    for (let i = 0; i < 16; i++) {
      setTimeout(spawn, i * 140);
    }
    this.lotusTimer = setInterval(spawn, 360);
  },
  stopLotusShower(container) {
    if (this.lotusTimer) {
      clearInterval(this.lotusTimer);
      this.lotusTimer = null;
    }
    if (container) container.innerHTML = '';
  },
  updateLeaderboard(donors = []) {
    if (!this.donorList) return;
    if (!donors.length) {
      this.donorList.innerHTML = '<li class="donor-empty">Chưa có pháp duyên cúng dường</li>';
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    this.donorList.innerHTML = donors.slice(0, 5).map((donor, idx) => {
      const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other';
      const medal = medals[idx] || (idx + 1);
      const name = donor.nickname || donor.username || 'Thiện hữu';
      const score = compactNumber.format(donor.totalValue || donor.totalGifts || 0);
      return `<li class="donor-item">
        <span class="donor-rank ${rankClass}">${medal}</span>
        <span class="donor-name" title="${name}">${name}</span>
        <span class="donor-score">${score}</span>
      </li>`;
    }).join('');
  },
  updateMetrics(metrics = {}) {
    this.likes.textContent = compactNumber.format(metrics.totalLikes || 0);
    this.people.textContent = compactNumber.format(metrics.presentCount || 0);
    this.gifts.textContent = compactNumber.format(metrics.totalGifts || 0);
    this.likes.title = fullNumber.format(metrics.totalLikes || 0);
    this.gifts.title = fullNumber.format(metrics.totalGifts || 0);

    const bellLikes = metrics.bellCycleLikes ?? ((metrics.totalLikes || 0) % 1000);
    if (this.bellCount) this.bellCount.textContent = fullNumber.format(bellLikes);
    if (this.bellFill) {
      const pct = Math.min(100, Math.round((bellLikes / 1000) * 100));
      this.bellFill.style.width = `${pct}%`;
    }
    if (this.ceremonyAttendees) this.ceremonyAttendees.textContent = metrics.presentCount || 0;
  },
  updateLive(live = {}) {
    const active = live.status === 'connected' || live.status === 'awaiting-webhook';
    const simulated = live.status === 'simulated';
    this.live.classList.toggle('is-live', active);
    this.live.classList.toggle('is-simulated', simulated);
    const label = simulated ? 'CHẾ ĐỘ GIẢ LẬP' : active ? 'ĐÃ KẾT NỐI LIVE' : 'ĐANG CHỜ KẾT NỐI';
    this.live.querySelector('span').textContent = label;
  },
  showGift(data) {
    const sender = data.sender || {};
    const gift = data.gift || {};
    const name = sender.nickname || sender.username || 'Thiện hữu';
    const username = sender.username ? `@${sender.username.replace(/^@/, '')}` : 'Khách hành hương';
    this.nickname.textContent = name;
    this.username.textContent = username;
    this.thanks.textContent = data.thankYou || `🙏 Cảm ơn ${username} đã gửi ${gift.name || 'một món quà'}!`;
    this.giftName.textContent = `${gift.name || 'Quà tặng'}${data.repeatCount > 1 ? ` ×${data.repeatCount}` : ''}`;
    this.giftSymbol.textContent = giftSymbols[gift.name] || (gift.specialEffect === 'lion' ? '🦁' : '✦');
    this.initials.textContent = (name.match(/[\p{L}\p{N}]/u)?.[0] || '🙏').toUpperCase();

    this.avatar.classList.remove('is-broken');
    this.avatar.removeAttribute('src');
    if (sender.avatarUrl) {
      this.avatar.src = sender.avatarUrl;
      this.avatar.onerror = () => this.avatar.classList.add('is-broken');
    }
    this.giftImage.classList.remove('has-image');
    this.giftImage.removeAttribute('src');
    if (gift.imageUrl) {
      this.giftImage.src = gift.imageUrl;
      this.giftImage.onload = () => this.giftImage.classList.add('has-image');
      this.giftImage.onerror = () => this.giftImage.classList.remove('has-image');
    }
    this.card.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => this.card.classList.add('is-visible'));
  },
  hideGift() {
    this.card.classList.remove('is-visible');
    this.card.setAttribute('aria-hidden', 'true');
  },
  speechBubble: $('#ai-speech-bubble'),
  speechIcon: $('#speech-icon'),
  speechKicker: $('#speech-kicker'),
  speechContent: $('#speech-content'),
  fortuneOverlay: $('#fortune-card-overlay'),
  fortuneNumberTitle: $('#fortune-number-title'),
  fortuneRecipientName: $('#fortune-recipient-name'),
  fortunePoem: $('#fortune-poem'),
  fortuneMeaning: $('#fortune-meaning'),
  fortuneAdvice: $('#fortune-advice'),
  fortuneTimer: null,
  showFortune(payload) {
    if (!this.fortuneOverlay || !payload?.fortune) return;
    const f = payload.fortune;
    const v = payload.viewer || {};
    const numStr = String(f.number).padStart(2, '0');
    if (this.fortuneNumberTitle) this.fortuneNumberTitle.textContent = `QUẺ SỐ ${numStr} · ${f.category}`;
    const name = v.nickname || v.username || 'Thiện hữu';
    if (this.fortuneRecipientName) this.fortuneRecipientName.textContent = `@${name.replace(/^@+/, '')}`;
    if (this.fortunePoem) {
      this.fortunePoem.innerHTML = (f.poem || '').split('\n').join('<br />');
    }
    if (this.fortuneMeaning) {
      this.fortuneMeaning.innerHTML = `<strong>Giải nghĩa:</strong> ${f.meaning || ''}`;
    }
    if (this.fortuneAdvice) {
      this.fortuneAdvice.innerHTML = `<strong>Lời Phật dạy:</strong> ${f.advice || ''}`;
    }
    this.fortuneOverlay.setAttribute('aria-hidden', 'false');
    this.fortuneOverlay.classList.add('is-visible');

    // Tự động đóng sau 10 giây
    clearTimeout(this.fortuneTimer);
    this.fortuneTimer = setTimeout(() => this.hideFortune(), 10000);
  },
  hideFortune() {
    if (!this.fortuneOverlay) return;
    clearTimeout(this.fortuneTimer);
    this.fortuneOverlay.classList.remove('is-visible');
    this.fortuneOverlay.setAttribute('aria-hidden', 'true');
  },
  showSpeech(payload) {
    if (!this.speechBubble || !payload?.text) return;
    const isGift = payload.type === 'gift_thanks';
    const isAmbient = payload.type === 'ambient_blessing';
    const isFortune = payload.type === 'fortune';
    this.speechBubble.classList.toggle('mode-gift', isGift);
    this.speechBubble.classList.toggle('mode-fortune', isFortune);
    this.speechBubble.classList.toggle('mode-welcome', !isGift && !isAmbient && !isFortune);
    this.speechBubble.classList.toggle('mode-ambient', isAmbient);
    if (this.speechIcon) this.speechIcon.textContent = isFortune ? '🎋' : isGift ? '🪷' : isAmbient ? '🙏' : '🎙️';
    if (this.speechKicker) this.speechKicker.textContent = isFortune ? `QUẺ XĂM QUÁN ÂM · ${payload.speaker || 'LỜI QUẺ'}` : isGift ? 'TRI ÂN CÔNG ĐỨC' : isAmbient ? 'KHUYẾN TẤN AN LẠC' : 'LỜI CHÙA';
    if (this.speechContent) this.speechContent.textContent = payload.text;
    this.speechBubble.setAttribute('aria-hidden', 'false');
    this.speechBubble.classList.add('is-speaking');
  },
  hideSpeech() {
    if (!this.speechBubble) return;
    this.speechBubble.classList.remove('is-speaking');
    this.speechBubble.setAttribute('aria-hidden', 'true');
  },
  showSoundPrompt(show) { this.soundPrompt.hidden = !show; }
};

class AiVoiceDirector {
  constructor() {
    this.queue = [];
    this.isSpeaking = false;
    this.speechTimer = null;
    this.lastWelcomeAt = 0;
    this.activeUtterance = null;
    this.audioPlayer = new Audio();
    this.audioPlayer.preload = 'auto';
    this.settings = {
      enabled: true,
      welcomeEnabled: true,
      giftThanksEnabled: true,
      volume: 0.9,
      rate: 0.92,
      preferredVoice: ''
    };
    this.bestVoice = null;
    this.loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  cleanSpeechText(raw) {
    if (!raw) return '';
    return String(raw)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\p{Extended_Pictographic}]/gu, '')
      .replace(/[✦·•☸♥★☆✓✔✕✖~`@#$%^&*()_+={}\[\]|\\:;"'<>/?]/g, ' ')
      .replace(/!+/g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/,+/g, ',')
      .replace(/\s+/g, ' ')
      .trim();
  }

  findBestVoice(voices, preferredName = '') {
    if (!voices || !voices.length) return null;
    if (preferredName) {
      const exact = voices.find(v => v.name === preferredName);
      if (exact) return exact;
    }
    // 1. Microsoft Hoài My (Natural / Online)
    const hoaiMy = voices.find(v => /hoaimy|hoài\s*my/i.test(v.name));
    if (hoaiMy) return hoaiMy;

    // 2. Microsoft Nam Minh (Natural / Online)
    const namMinh = voices.find(v => /namminh|nam\s*minh/i.test(v.name));
    if (namMinh) return namMinh;

    // 3. Giọng tiếng Việt Natural / Online / Neural
    const naturalVi = voices.find(v =>
      (v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.startsWith('vi')) &&
      /natural|online|neural/i.test(v.name)
    );
    if (naturalVi) return naturalVi;

    // 4. Google Tiếng Việt (Chrome)
    const googleVi = voices.find(v =>
      (v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.startsWith('vi')) &&
      /google/i.test(v.name)
    );
    if (googleVi) return googleVi;

    // 5. Bất kỳ giọng tiếng Việt nào khác
    return voices.find(v =>
      v.lang === 'vi-VN' || v.lang === 'vi_VN' || v.lang.startsWith('vi') ||
      (v.name || '').toLowerCase().includes('vietnam')
    ) || null;
  }

  loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices() || [];
    this.bestVoice = this.findBestVoice(voices, this.settings.preferredVoice);
  }

  unlock() {
    // 1. Mở khóa Audio Player
    if (this.audioPlayer) {
      this.audioPlayer.play().then(() => this.audioPlayer.pause()).catch(() => {});
    }
    // 2. Mở khóa Speech Synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        const silent = new SpeechSynthesisUtterance(' ');
        silent.volume = 0.01;
        window.speechSynthesis.speak(silent);
      } catch (_) {}
    }
    // 3. Ẩn nút nhắc bật âm thanh
    const prompt = document.getElementById('sound-prompt');
    if (prompt) prompt.style.display = 'none';
  }

  applySettings(settings = {}) {
    if (settings.aiVoice) {
      this.settings = { ...this.settings, ...settings.aiVoice };
      this.loadVoices();
    }
  }

  announce(payload) {
    if (!payload?.text) return;
    if (this.settings.enabled === false) return;
    if (payload.type === 'welcome' && this.settings.welcomeEnabled === false) return;
    if (payload.type === 'gift_thanks' && this.settings.giftThanksEnabled === false) return;

    const isGift = payload.type === 'gift_thanks';
    const now = Date.now();

    if (!isGift) {
      // Cooldown 5s cho lời chào để tránh spam khi bão tim
      if (now - this.lastWelcomeAt < 5000 && this.isSpeaking) {
        const existingIdx = this.queue.findIndex(item => item.type === 'welcome');
        if (existingIdx >= 0) {
          this.queue[existingIdx] = payload;
        } else if (this.queue.length < 2) {
          this.queue.push(payload);
        }
        return;
      }
      this.lastWelcomeAt = now;
    }

    if (isGift) {
      this.queue.unshift(payload);
    } else {
      this.queue.push(payload);
    }

    this.drain();
  }

  drain() {
    if (this.isSpeaking || !this.queue.length) return;
    const item = this.queue.shift();
    this.speak(item);
  }

  speak(item) {
    this.isSpeaking = true;
    clearTimeout(this.speechTimer);

    // Hiển thị phụ đề trên màn hình
    ui.showSpeech(item);

    const cleanedText = this.cleanSpeechText(item.text);
    if (!cleanedText) {
      this.isSpeaking = false;
      this.drain();
      return;
    }

    const volume = Number(this.settings.volume ?? 0.9);
    audioDirector?.duck(true);
    const finish = () => {
      this.isSpeaking = false;
      this.activeUtterance = null;
      audioDirector?.duck(false);
      this.speechTimer = setTimeout(() => {
        ui.hideSpeech();
        setTimeout(() => this.drain(), 300);
      }, 900);
    };

    // Nếu người dùng chọn dùng Audio Stream tự nhiên hoặc không chọn giọng máy cụ thể:
    // Phát qua Audio Stream Google TTS (100% không bao giờ mất tiếng trên OBS lẫn mọi trình duyệt)
    const pref = this.settings.preferredVoice || '';
    const useAudioStream = !pref || pref === 'google_online' || pref === 'auto';

    if (useAudioStream) {
      this.playAudioStream(cleanedText, volume, finish);
      return;
    }

    // Nếu người dùng chọn giọng Windows cục bộ (Hoài My, Nam Minh, An...):
    this.playSpeechSynthesis(cleanedText, volume, finish, () => {
      // Fallback ngay sang Audio Stream nếu giọng nội bộ bị lỗi hoặc im lặng
      this.playAudioStream(cleanedText, volume, finish);
    });
  }

  playAudioStream(text, volume, onFinish) {
    try {
      this.audioPlayer.pause();
      this.audioPlayer.src = `/api/tts?text=${encodeURIComponent(text)}`;
      this.audioPlayer.volume = Math.max(0, Math.min(1, volume));

      let ended = false;
      const done = () => {
        if (!ended) {
          ended = true;
          this.audioPlayer.onended = null;
          this.audioPlayer.onerror = null;
          onFinish();
        }
      };

      this.audioPlayer.onended = done;
      this.audioPlayer.onerror = (e) => {
        console.warn('Audio stream error, fallback timer active:', e);
        const estDuration = Math.max(3500, text.length * 85);
        setTimeout(done, estDuration);
      };

      const playPromise = this.audioPlayer.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio play blocked by browser policy:', err);
          $('#sound-prompt')?.style.setProperty('display', 'block');
          const estDuration = Math.max(3500, text.length * 85);
          setTimeout(done, estDuration);
        });
      }
    } catch (err) {
      console.warn('playAudioStream error:', err);
      setTimeout(onFinish, 3500);
    }
  }

  playSpeechSynthesis(text, volume, onFinish, onFallback) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return onFallback();
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const voices = window.speechSynthesis.getVoices() || [];
      const voice = this.findBestVoice(voices, this.settings.preferredVoice);
      if (!voice) {
        return onFallback();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang || 'vi-VN';
      utterance.rate = Number(this.settings.rate || 0.92);
      utterance.volume = volume;
      utterance.pitch = 1.0;

      let started = false;
      let finished = false;

      const done = () => {
        if (!finished) {
          finished = true;
          this.activeUtterance = null;
          onFinish();
        }
      };

      utterance.onstart = () => { started = true; };
      utterance.onend = done;
      utterance.onerror = (e) => {
        console.warn('Utterance error:', e);
        if (!started) onFallback();
        else done();
      };

      this.activeUtterance = utterance;

      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setTimeout(() => window.speechSynthesis.speak(utterance), 60);
      } else {
        window.speechSynthesis.speak(utterance);
      }

      // Nếu sau 800ms vẫn chưa phát tiếng, tự động kích hoạt fallback sang Audio Stream
      setTimeout(() => {
        if (!started && !finished) {
          console.warn('Speech synthesis did not start, using audio fallback');
          window.speechSynthesis.cancel();
          onFallback();
        }
      }, 800);
    } catch (err) {
      console.warn('playSpeechSynthesis exception:', err);
      onFallback();
    }
  }
}

class AudioDirector {
  constructor(socket) {
    this.socket = socket;
    this.decks = [new Audio(), new Audio()];
    this.decks.forEach((deck) => {
      deck.preload = 'auto';
      deck.addEventListener('ended', () => {
        if (deck === this.active && this.state?.status === 'playing') {
          this.socket.emit('audio:ended', { revision: this.state.revision });
        }
      });
      deck.addEventListener('error', () => {
        if (deck === this.active) ui.showSoundPrompt(true);
      });
    });
    this.activeIndex = 0;
    this.active = this.decks[0];
    this.currentTrackId = null;
    this.state = null;
    this.fadeFrame = null;
  }

  get volume() { return Math.max(0, Math.min(1, Number(this.state?.volume ?? 0.62))); }

  apply(next) {
    this.state = next;
    const track = next.tracks?.find((item) => item.id === next.currentTrackId && item.enabled !== false);
    if (!track || next.status === 'stopped') {
      this.pauseAll();
      return;
    }
    if (track.id !== this.currentTrackId) {
      this.crossfade(track);
      return;
    }
    if (next.status === 'paused') {
      this.active.pause();
      return;
    }
    this.active.volume = this.volume;
    this.tryPlay(this.active);
  }

  async tryPlay(deck) {
    try {
      await deck.play();
      ui.showSoundPrompt(false);
    } catch (_error) {
      ui.showSoundPrompt(true);
    }
  }

  crossfade(track) {
    const previous = this.active;
    const incoming = this.decks[(this.activeIndex + 1) % this.decks.length];
    cancelAnimationFrame(this.fadeFrame);
    incoming.pause();
    incoming.src = track.filePath;
    incoming.currentTime = 0;
    incoming.volume = 0;
    this.activeIndex = (this.activeIndex + 1) % this.decks.length;
    this.active = incoming;
    this.currentTrackId = track.id;
    if (this.state.status !== 'playing') return;
    this.tryPlay(incoming);
    const started = performance.now();
    const initial = previous.paused ? 0 : previous.volume;
    const fade = (time) => {
      const progress = Math.min(1, (time - started) / 700);
      incoming.volume = this.volume * progress;
      if (previous !== incoming) previous.volume = initial * (1 - progress);
      if (progress < 1) this.fadeFrame = requestAnimationFrame(fade);
      else if (previous !== incoming) {
        previous.pause();
        previous.currentTime = 0;
        previous.volume = this.volume;
      }
    };
    this.fadeFrame = requestAnimationFrame(fade);
  }

  pauseAll() {
    cancelAnimationFrame(this.fadeFrame);
    cancelAnimationFrame(this.duckFrame);
    this.decks.forEach((deck) => deck.pause());
  }

  duck(isDucking) {
    this.isDucking = isDucking;
    if (!this.active || this.state?.status !== 'playing') return;
    const targetVolume = isDucking ? this.volume * 0.18 : this.volume;
    cancelAnimationFrame(this.duckFrame);
    const startVolume = this.active.volume;
    const started = performance.now();
    const duration = isDucking ? 300 : 750;
    const fade = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      this.active.volume = Math.max(0, Math.min(1, startVolume + (targetVolume - startVolume) * progress));
      if (progress < 1) {
        this.duckFrame = requestAnimationFrame(fade);
      }
    };
    this.duckFrame = requestAnimationFrame(fade);
  }

  unlock() {
    if (this.state?.status === 'playing') this.tryPlay(this.active);
  }

  playEffect(url) {
    if (!url) return;
    const effect = new Audio(url);
    effect.volume = Math.min(1, this.volume * 0.68);
    effect.addEventListener('ended', () => { effect.src = ''; });
    effect.play().catch(() => ui.showSoundPrompt(true));
  }
}

function hash(value = '') {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

/**
 * Nhân vật Phật tử 2D chân thật:
 * - Dáng người thật từ ảnh vẽ 2D nhìn từ sau lưng (back view) hướng về Tam Thế Phật
 * - Mặc áo tràng lam đi chùa truyền thống với nếp vải tự nhiên
 * - Animation cúng bái (lạy Phật: quỳ chắp tay -> cúi gập đảnh lễ sát đất -> tĩnh lặng -> nâng người lên)
 * - Animation ra vào (bước đi khoan thai, tà áo lay động theo nhịp bước)
 * - Bảng tên Pill viền vàng phong cách Chùa Online dưới chân
 */
class RealisticWorshipper {
  constructor(scene, data) {
    this.scene = scene;
    this.data = data;
    this.container = scene.add.container(GATE.x, GATE.y).setDepth(GATE.y);

    // Bóng đổ mềm mại dưới bồ đoàn / sàn (kích thước vừa vặn cân đối)
    this.shadow = scene.add.ellipse(0, 16, 150, 48, 0x0a050e, 0.45);

    // Sprite nhân vật vẽ tay 2D thật (KHÔNG dùng hình trụ / khối hình học ghép)
    const initialKey = scene.textures.exists('worshipper_walk1') ? 'worshipper_walk1' : (scene.textures.exists('raw_walk1') ? 'raw_walk1' : 'worshipper_kneel');
    this.sprite = scene.add.sprite(0, 0, initialKey);
    this.sprite.setOrigin(0.5, 0.90);

    // Tinh chỉnh sắc độ nhẹ cho từng áo tràng lam của Phật tử
    const tints = [0xffffff, 0xf6f9fc, 0xeef4f8, 0xe2ebf5, 0xd8e4f0];
    this.robeTint = tints[hash(data.id) % tints.length];
    this.sprite.setTint(this.robeTint);

    // Bảng tên Pill viền vàng phong cách Chùa Online dưới chân (Khởi tạo TRƯỚC khi setSpritePose)
    this.badgeContainer = scene.add.container(0, 58);
    this.badgeBg = scene.add.graphics();
    this.badgeText = scene.add.text(0, 0, '', {
      fontFamily: '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif',
      fontSize: '30px',
      fontWeight: '700',
      color: '#fff9e8',
      stroke: '#0e0711',
      strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5);

    this.badgeContainer.add([this.badgeBg, this.badgeText]);
    this.container.add([this.shadow, this.sprite, this.badgeContainer]);

    this.mode = 'new';
    this.moving = false;
    this.prostrating = false;
    this.prostrationTimer = null;
    this.walkTimer = null;

    this.setSpritePose('stand');
    this.updateData(data);
  }

  target() {
    const raw = PRAYER_SLOTS[this.data.slotIndex] || PRAYER_SLOTS[0];
    const scale = 0.62 + Math.max(0, (raw[1] - 1420) / 405) * 0.44;
    return { x: raw[0], y: raw[1], scale };
  }

  updateData(data) {
    this.data = { ...this.data, ...data };
    const name = this.data.nickname || this.data.username || 'Thiện hữu';
    const displayName = `☸ ${name.length > 11 ? `${name.slice(0, 10)}…` : name}`;
    this.badgeText.setText(displayName);

    const width = Math.max(160, this.badgeText.width + 36);
    const height = 48;
    const bg = this.badgeBg;
    bg.clear();
    bg.fillStyle(0x130a17, 0.90);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 24);
    bg.lineStyle(2.4, 0xf3ca68, 0.92);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 24);
  }

  setSpritePose(pose) {
    const tex = (key) => this.scene.textures.exists(key) ? key : `raw_${key.replace('worshipper_', '')}`;
    if (pose === 'kneel') {
      this.sprite.setTexture(tex('worshipper_kneel'));
      this.sprite.setDisplaySize(192, 300);
      this.shadow.setSize(155, 48);
      if (this.badgeContainer) this.badgeContainer.setPosition(0, 48);
    } else if (pose === 'bow') {
      this.sprite.setTexture(tex('worshipper_bow'));
      this.sprite.setDisplaySize(230, 224);
      this.shadow.setSize(180, 54);
      if (this.badgeContainer) this.badgeContainer.setPosition(0, 38);
    } else if (pose === 'walk1') {
      this.sprite.setTexture(tex('worshipper_walk1'));
      this.sprite.setDisplaySize(128, 336);
      this.shadow.setSize(118, 38);
      if (this.badgeContainer) this.badgeContainer.setPosition(0, 58);
    } else if (pose === 'walk2') {
      this.sprite.setTexture(tex('worshipper_walk2'));
      this.sprite.setDisplaySize(128, 336);
      this.shadow.setSize(118, 38);
      if (this.badgeContainer) this.badgeContainer.setPosition(0, 58);
    } else {
      // stand
      this.sprite.setTexture(tex('worshipper_walk1'));
      this.sprite.setDisplaySize(128, 336);
      this.shadow.setSize(118, 38);
      if (this.badgeContainer) this.badgeContainer.setPosition(0, 58);
    }
  }

  /**
   * Bắt đầu chu kỳ cúng bái lạy Phật tự nhiên (Kowtow):
   * Quỳ chắp tay -> cúi gập người lạy Phật sát đất -> dừng tĩnh lặng -> nâng người lên
   */
  startPrayerCycle() {
    this.stopPrayerCycle();
    if (this.mode === 'exiting') return;

    // Nhịp thở nhẹ nhàng khi quỳ lễ
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: this.sprite.scaleY * 1.025,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    // Độ trễ ngẫu nhiên giữa các nhân vật (7.5 - 13.5s) để không bị lạy đồng loạt
    const interval = Phaser.Math.Between(7500, 13500);
    this.prostrationTimer = this.scene.time.delayedCall(interval, () => {
      this.prostrate(() => this.startPrayerCycle());
    });
  }

  stopPrayerCycle() {
    if (this.prostrationTimer) {
      this.prostrationTimer.remove(false);
      this.prostrationTimer = null;
    }
    this.scene.tweens.killTweensOf(this.sprite);
  }

  /**
   * Động tác lạy Phật uyển chuyển, cung kính
   */
  prostrate(onComplete) {
    if (this.moving || this.mode === 'exiting' || this.prostrating) return;
    this.prostrating = true;
    this.scene.tweens.killTweensOf(this.sprite);

    // 1. Cúi gập người từ tư thế quỳ (kneel -> bow)
    this.setSpritePose('kneel');
    const origScaleY = this.sprite.scaleY;

    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: origScaleY * 0.82,
      y: 12,
      duration: 520,
      ease: 'Quad.in',
      onComplete: () => {
        // Chuyển sang sprite phủ phục lạy sát đất
        this.setSpritePose('bow');
        this.sprite.y = 5;

        // 2. Dừng tĩnh lặng phủ phục chí thành đảnh lễ Tam Bảo: 1400ms
        this.scene.time.delayedCall(1400, () => {
          if (this.mode === 'exiting') return;

          // 3. Từ từ nâng người dậy về tư thế chắp tay
          this.setSpritePose('kneel');
          this.sprite.y = 12;
          this.sprite.scaleY = origScaleY * 0.82;

          this.scene.tweens.add({
            targets: this.sprite,
            scaleY: origScaleY,
            y: 0,
            duration: 750,
            ease: 'Sine.out',
            onComplete: () => {
              this.prostrating = false;
              onComplete?.();
            }
          });
        });
      }
    });
  }

  /**
   * Animation Đi vào chùa (Entering):
   * Bước chân luân phiên nhịp nhàng trên thảm đỏ, tà áo lay động,
   * tới bồ đoàn thì từ từ quỳ xuống trang nghiêm.
   */
  enter() {
    this.stopPrayerCycle();
    const target = this.target();
    this.mode = 'entering';
    this.moving = true;

    const startX = GATE.x + ((hash(this.data.id) % 60) - 30);
    this.container.setPosition(startX, GATE.y).setScale(target.scale * 1.05).setAlpha(1).setDepth(GATE.y);
    this.setSpritePose('walk1');

    // Chạy bước chân luân phiên (walk1 <-> walk2)
    let step = 0;
    this.walkTimer = this.scene.time.addEvent({
      delay: 240,
      loop: true,
      callback: () => {
        if (this.moving) {
          step = (step + 1) % 2;
          this.setSpritePose(step === 0 ? 'walk1' : 'walk2');
        }
      }
    });

    // Chặng 1: Bước theo lối đi giữa lên ngang hàng bồ đoàn
    this.scene.tweens.add({
      targets: this.container,
      x: 540 + ((hash(`${this.data.id}aisle`) % 30) - 15),
      y: target.y + 15,
      scale: target.scale * 1.04,
      duration: 1700,
      ease: 'Linear',
      onUpdate: () => this.container.setDepth(this.container.y),
      onComplete: () => {
        // Chặng 2: Rẽ vào bồ đoàn
        this.scene.tweens.add({
          targets: this.container,
          x: target.x,
          y: target.y,
          scale: target.scale,
          duration: 900,
          ease: 'Sine.out',
          onUpdate: () => this.container.setDepth(this.container.y),
          onComplete: () => {
            if (this.walkTimer) this.walkTimer.remove(false);
            this.moving = false;
            // Quỳ xuống bồ đoàn trang nghiêm
            this.setSpritePose('kneel');
            this.startPrayerCycle();
          }
        });
      }
    });
  }

  placeAndPray() {
    this.stopPrayerCycle();
    const target = this.target();
    this.scene.tweens.killTweensOf(this.container);
    this.container.setPosition(target.x, target.y).setScale(target.scale).setAlpha(1).setDepth(target.y);
    this.moving = false;
    this.setSpritePose('kneel');
    this.startPrayerCycle();
  }

  pray() {
    this.mode = 'praying';
    if (!this.moving && !this.prostrating) {
      this.setSpritePose('kneel');
      this.startPrayerCycle();
    }
  }

  /**
   * Animation Tri ân khi nhận quà:
   * Toàn thân phát sáng kim quang, dập đầu lạy tạ sâu sắc 3 lạy
   */
  thank() {
    if (this.mode === 'exiting') return;
    this.stopPrayerCycle();

    // Hào quang vàng rực rỡ sau lưng
    const aura = this.scene.add.circle(0, -20, 95, 0xffd966, 0.45)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(aura);
    this.scene.tweens.add({
      targets: aura,
      scale: 1.6,
      alpha: 0,
      duration: 1800,
      ease: 'Sine.out',
      onComplete: () => aura.destroy()
    });

    this.prostrate(() => {
      this.scene.time.delayedCall(300, () => {
        this.pray();
      });
    });
  }

  /**
   * Animation Rời chùa (Exiting):
   * Từ từ đứng dậy, quay người bước đi chậm rãi về phía cổng và mờ dần
   */
  leave() {
    if (this.mode === 'exiting') return;
    this.mode = 'exiting';
    this.stopPrayerCycle();
    this.moving = true;

    // 1. Đứng dậy
    this.setSpritePose('walk1');

    let step = 0;
    this.walkTimer = this.scene.time.addEvent({
      delay: 240,
      loop: true,
      callback: () => {
        if (this.moving) {
          step = (step + 1) % 2;
          this.setSpritePose(step === 0 ? 'walk1' : 'walk2');
        }
      }
    });

    // 2. Bước ra lối đi giữa và đi về cổng
    const side = (hash(`${this.data.id}leave`) % 80) - 40;
    this.scene.tweens.add({
      targets: this.container,
      x: GATE.x + side,
      y: GATE.y + 40,
      alpha: 0,
      scale: Math.max(0.70, this.container.scaleX * 0.9),
      duration: 2100,
      ease: 'Sine.in',
      onUpdate: () => this.container.setDepth(this.container.y),
      onComplete: () => {
        if (this.walkTimer) this.walkTimer.remove(false);
        this.moving = false;
      }
    });
  }

  destroy() {
    this.stopPrayerCycle();
    if (this.walkTimer) this.walkTimer.remove(false);
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy(true);
  }
}

class WorshipperManager {
  constructor(scene) {
    this.scene = scene;
    this.people = new Map();
  }

  upsert(data, snapshot = false) {
    let person = this.people.get(data.id);
    if (!person) {
      person = new RealisticWorshipper(this.scene, data);
      this.people.set(data.id, person);
      if (snapshot && data.state === 'praying') person.placeAndPray();
      else if (data.instant || data.state === 'praying') person.placeAndPray();
      else if (data.state === 'exiting') person.leave();
      else person.enter();
      return person;
    }
    person.updateData(data);
    if (data.state === 'exiting') person.leave();
    else if (data.state === 'praying') person.pray();
    else if (data.state === 'entering' && person.mode !== 'entering') person.enter();
    return person;
  }

  remove(id) {
    const person = this.people.get(id);
    if (!person) return;
    person.destroy();
    this.people.delete(id);
  }

  applySnapshot(presences = []) {
    const known = new Set(presences.map((presence) => presence.id));
    [...this.people.keys()].filter((id) => !known.has(id)).forEach((id) => this.remove(id));
    presences.forEach((presence) => this.upsert(presence, true));
  }
}

class TempleScene extends Phaser.Scene {
  constructor() { super('TempleScene'); }

  preload() {
    this.load.image('temple_bg', '/assets/temple_bg.jpg');
    this.load.image('worshipper_kneel', '/assets/worshipper_kneel.png');
    this.load.image('worshipper_bow', '/assets/worshipper_bow.png');
    this.load.image('worshipper_walk1', '/assets/worshipper_walk1.png');
    this.load.image('worshipper_walk2', '/assets/worshipper_walk2.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0e0711').setBounds(0, 0, WIDTH, HEIGHT);
    this.drawTemple();
    this.worshippers = new WorshipperManager(this);
    this.presenting = false;
    if (latestSnapshot) this.applySnapshot(latestSnapshot);
    if (pendingGift) {
      const gift = pendingGift;
      pendingGift = null;
      this.presentGift(gift);
    }
  }

  drawTemple() {
    // 1. Ảnh nền chính điện Chùa Phật thật 9:16 sắc nét
    if (this.textures.exists('temple_bg')) {
      const bg = this.add.image(WIDTH / 2, HEIGHT / 2, 'temple_bg');
      bg.setDisplaySize(WIDTH, HEIGHT);
      bg.setDepth(0);
    } else {
      this.drawFallbackTemple();
    }

    // 2. Hiệu ứng Hào quang Phật Thích Ca (Chính giữa bàn thờ)
    const haloX = 540;
    const haloY = 730;
    const halo = this.add.circle(haloX, haloY, 150, 0xffd970, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(5);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.14, to: 0.32 },
      scale: { from: 0.95, to: 1.08 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    const haloOuter = this.add.circle(haloX, haloY, 240, 0xf6ad42, 0.10)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);
    this.tweens.add({
      targets: haloOuter,
      alpha: { from: 0.06, to: 0.16 },
      scale: { from: 0.92, to: 1.05 },
      duration: 3400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    // 4. Ngọn nến lung linh trên bàn thờ
    [418, 662].forEach((x, index) => {
      const candle = this.add.circle(x, 938, 18, 0xffbf58, 0.35)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(6);
      this.tweens.add({
        targets: candle,
        alpha: { from: 0.22, to: 0.50 },
        scale: { from: 0.85, to: 1.25 },
        duration: 900 + index * 260,
        yoyo: true,
        repeat: -1,
        ease: 'Quad.easeInOut'
      });
    });

    // 5. Lư hương trầm thoang thoảng bốc lên từ bàn thờ (X: 540, Y: 1025)
    this.time.addEvent({
      delay: 500,
      callback: () => this.emitIncenseSmoke(540, 1025),
      loop: true
    });

    // 6. Câu kinh linh thiêng trên đỉnh
    const blessing = this.add.text(WIDTH / 2, 70, 'NAM MÔ A DI ĐÀ PHẬT', {
      fontFamily: '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif',
      fontSize: '22px',
      color: '#ffe599',
      letterSpacing: 4,
      stroke: '#341424',
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0.85).setDepth(10);
    this.tweens.add({
      targets: blessing,
      alpha: { from: 0.65, to: 1 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  emitIncenseSmoke(x, y) {
    const wisp = this.add.circle(x + Phaser.Math.Between(-8, 8), y, Phaser.Math.Between(4, 7), 0xf7ede2, 0.28)
      .setDepth(7);
    this.tweens.add({
      targets: wisp,
      x: x + Phaser.Math.Between(-35, 35),
      y: y - Phaser.Math.Between(130, 220),
      scale: { from: 1, to: 3.5 },
      alpha: { from: 0.28, to: 0 },
      duration: Phaser.Math.Between(2600, 3400),
      ease: 'Sine.out',
      onComplete: () => wisp.destroy()
    });
  }

  drawFallbackTemple() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x130b1d, 0x1e1024, 0x5d2037, 0x2d1328, 1).fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(0xf6ba55, 0.08).fillCircle(540, 400, 420);
    g.fillStyle(0x5d2b3c, 1).fillRect(0, 1200, WIDTH, 720);
  }

  drawLotusAt(x, y, scale = 1, depth = 2) {
    const flower = this.add.container(x, y).setScale(scale).setDepth(depth);
    const g = this.add.graphics();
    const petals = [[0, -14], [12, -7], [14, 6], [0, 11], [-14, 6], [-12, -7]];
    petals.forEach(([px, py], index) => {
      g.fillStyle(index % 2 ? 0xf2a4b9 : 0xffc0c9, 1).fillEllipse(px, py, 16, 30);
    });
    g.fillStyle(0xf4c662, 1).fillCircle(0, 0, 6);
    flower.add(g);
    return flower;
  }

  applySnapshot(snapshot) {
    this.worshippers.applySnapshot(snapshot.presences || []);
  }

  upsertPresence(presence) { this.worshippers.upsert(presence); }
  removePresence(id) { this.worshippers.remove(id); }

  presentGift(payload) {
    if (this.presenting) return;
    this.presenting = true;
    const person = payload.presence?.id ? this.worshippers.people.get(payload.presence.id) : null;
    const point = person ? { x: person.container.x, y: person.container.y - 65 } : { x: 540, y: 760 };
    const camera = this.cameras.main;

    person?.thank();
    ui.showGift(payload);
    this.playGiftEffect(payload.gift?.specialEffect, point, payload.gift);

    // Mở rộng giới hạn camera để pan tự do tới mọi vị trí nhân vật (kể cả hàng bồ đoàn sát mép)
    camera.removeBounds();

    // Zoom siêu cận cảnh vào nhân vật (3.6x - phóng to gấp 5 lần so với mức zoom 1.25x trước đây)
    const zoomLevel = person ? 3.6 : 2.2;
    camera.pan(point.x, point.y, 700, 'Cubic.easeInOut');
    camera.zoomTo(zoomLevel, 700, 'Cubic.easeInOut');

    const duration = Math.max(3400, Number(payload.gift?.durationMs) || 4500);
    this.time.delayedCall(duration, () => {
      camera.pan(WIDTH / 2, HEIGHT / 2, 750, 'Cubic.easeInOut');
      camera.zoomTo(1, 750, 'Cubic.easeInOut');
      this.time.delayedCall(780, () => {
        camera.setBounds(0, 0, WIDTH, HEIGHT);
        ui.hideGift();
        person?.pray();
        this.presenting = false;
        liveSocket.emit('gift:finished', { id: payload.id });
      });
    });
  }

  playGiftEffect(effect, point, gift) {
    if (gift?.soundUrl) audioDirector.playEffect(gift.soundUrl);

    if (effect === 'petals' || effect === 'lotus' || effect === 'lion') {
      const count = effect === 'lion' ? 30 : 18;
      for (let index = 0; index < count; index += 1) {
        const petal = this.add.ellipse(point.x + Phaser.Math.Between(-90, 90), point.y - Phaser.Math.Between(40, 200), 12, 20, index % 2 ? 0xffb6c3 : 0xfad5df, 0.95).setDepth(2100);
        this.tweens.add({
          targets: petal,
          x: petal.x + Phaser.Math.Between(-80, 80),
          y: petal.y + Phaser.Math.Between(150, 320),
          angle: Phaser.Math.Between(-180, 180),
          alpha: 0,
          duration: 1650 + index * 35,
          ease: 'Quad.in',
          onComplete: () => petal.destroy()
        });
      }
    }

    if (effect === 'lantern' || effect === 'golden-bell' || effect === 'lion') {
      const gold = this.add.circle(point.x, point.y - 45, 16, 0xffc85d, 0.70).setBlendMode(Phaser.BlendModes.ADD).setDepth(2050);
      this.tweens.add({
        targets: gold,
        scale: effect === 'lion' ? 22 : 14,
        alpha: 0,
        duration: 1350,
        ease: 'Sine.out',
        onComplete: () => gold.destroy()
      });
    }

    if (effect === 'lotus' || effect === 'lion') {
      const lotus = this.drawLotusAt(point.x, point.y + 40, effect === 'lion' ? 2.8 : 2.0, 2110).setAlpha(0);
      this.tweens.add({
        targets: lotus,
        alpha: 1,
        scale: lotus.scale * 1.20,
        duration: 650,
        yoyo: true,
        hold: 1400,
        onComplete: () => lotus.destroy()
      });
    }

    if (effect === 'golden-bell') {
      const bell = this.add.text(point.x, point.y - 95, '🔔', { fontSize: '72px' }).setOrigin(0.5).setDepth(2120);
      this.tweens.add({
        targets: bell,
        angle: { from: -18, to: 18 },
        duration: 190,
        yoyo: true,
        repeat: 5,
        onComplete: () => bell.destroy()
      });
    }

    if (effect === 'lion') {
      const honor = this.add.text(point.x, point.y - 130, '✦  SỔ PHƯỚC DUYÊN  ✦', {
        fontFamily: '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif',
        fontSize: '22px',
        color: '#ffe6a3',
        stroke: '#52203a',
        strokeThickness: 6
      }).setOrigin(0.5).setDepth(2130).setAlpha(0);
      this.tweens.add({
        targets: honor,
        y: honor.y - 15,
        alpha: 1,
        duration: 450,
        yoyo: true,
        hold: 1800,
        onComplete: () => honor.destroy()
      });
    }

    if (gift?.animation === 'offer-flower') {
      const flower = this.drawLotusAt(point.x, point.y - 20, 1.3, 2140);
      this.tweens.add({
        targets: flower,
        y: flower.y - 75,
        alpha: 0,
        duration: 1600,
        ease: 'Sine.out',
        onComplete: () => flower.destroy()
      });
    }
  }

  strikeBellAura() {
    // Vòng sóng kim quang Đại Hồng Chung lan tỏa từ tòa sen
    const ring = this.add.circle(540, 500, 30, 0xffd700, 0.45);
    ring.setStrokeStyle(4, 0xffeb88, 0.95);
    ring.setDepth(2000);
    this.tweens.add({
      targets: ring,
      radius: 680,
      alpha: 0,
      duration: 2800,
      ease: 'Cubic.out',
      onComplete: () => ring.destroy()
    });
  }

  performCeremony() {
    // Toàn bộ Phật tử trong chùa quỳ lạy trang nghiêm 3 lạy
    this.worshippers.forEach((w) => {
      if (w.mode !== 'exiting') {
        w.prostrate(() => {
          this.time.delayedCall(800, () => {
            if (w.mode !== 'exiting') {
              w.prostrate(() => {
                this.time.delayedCall(800, () => {
                  if (w.mode !== 'exiting') w.prostrate();
                });
              });
            }
          });
        });
      }
    });

    // Mưa hoa sen vàng bay lên
    for (let i = 0; i < 16; i++) {
      this.time.delayedCall(i * 380, () => {
        const x = 120 + Math.random() * 840;
        const y = 1400 + Math.random() * 300;
        const lotus = this.drawLotusAt(x, y, 1.2, 2100);
        this.tweens.add({
          targets: lotus,
          y: y - 240,
          alpha: 0,
          scale: 1.5,
          duration: 3200,
          ease: 'Sine.out',
          onComplete: () => lotus.destroy()
        });
      });
    }
  }
}

let templeScene = null;
let latestSnapshot = null;
let pendingGift = null;
const liveSocket = io();
window.liveSocket = liveSocket;
const audioDirector = new AudioDirector(liveSocket);
const aiVoiceDirector = new AiVoiceDirector();
window.aiVoiceDirector = aiVoiceDirector;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#0e0711',
  transparent: false,
  scene: [TempleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH,
    height: HEIGHT
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance'
  }
});

game.events.once('ready', () => { templeScene = game.scene.getScene('TempleScene'); });
game.events.on('step', () => { if (!templeScene && game.scene.isActive('TempleScene')) templeScene = game.scene.getScene('TempleScene'); });

function sceneOrQueue(callback) {
  const scene = templeScene || (game.scene.isActive('TempleScene') ? game.scene.getScene('TempleScene') : null);
  if (scene?.worshippers) {
    templeScene = scene;
    callback(scene);
    return true;
  }
  return false;
}

function playBellAudio() {
  try {
    const audio = new Audio('/assets/temple_bell.wav');
    audio.volume = 0.85;
    audio.play().catch(() => {});
  } catch (_) {}
}

let nextCeremonyTimestamp = Date.now() + 600000;
function tickCeremonyTimer() {
  const remaining = Math.max(0, Math.ceil((nextCeremonyTimestamp - Date.now()) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  if (ui.ceremonyCountdown) ui.ceremonyCountdown.textContent = `${mm}:${ss}`;
}
setInterval(tickCeremonyTimer, 1000);

// Đồng hồ thời gian thực chống thuật toán quét tĩnh video của TikTok
const liveClockEl = document.getElementById('live-clock');
function tickLiveClock() {
  if (!liveClockEl) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  liveClockEl.textContent = `${h}:${m}:${s}`;
}
setInterval(tickLiveClock, 1000);
tickLiveClock();

liveSocket.on('temple:snapshot', (snapshot) => {
  latestSnapshot = snapshot;
  ui.updateMetrics(snapshot.metrics);
  ui.updateLive(snapshot.live);
  ui.updateLeaderboard(snapshot.topDonors || []);
  if (snapshot.ceremony?.nextCeremonyAt) {
    nextCeremonyTimestamp = snapshot.ceremony.nextCeremonyAt;
    tickCeremonyTimer();
  }
  audioDirector.apply({ ...snapshot.settings.audio, tracks: snapshot.tracks });
  aiVoiceDirector.applySettings(snapshot.settings);
  sceneOrQueue((scene) => scene.applySnapshot(snapshot));
});
liveSocket.on('temple:presence:upsert', (presence) => sceneOrQueue((scene) => scene.upsertPresence(presence)));
liveSocket.on('temple:presence:remove', ({ id }) => sceneOrQueue((scene) => scene.removePresence(id)));
liveSocket.on('leaderboard:update', (donors) => ui.updateLeaderboard(donors));
liveSocket.on('metrics:update', (metrics) => ui.updateMetrics(metrics));
liveSocket.on('live:status', (live) => ui.updateLive(live));
liveSocket.on('audio:state', (audio) => audioDirector.apply(audio));
liveSocket.on('settings:update', (settings) => aiVoiceDirector.applySettings(settings));
liveSocket.on('speech:announce', (payload) => aiVoiceDirector.announce(payload));
liveSocket.on('gift:present', (payload) => {
  if (!sceneOrQueue((scene) => scene.presentGift(payload))) pendingGift = payload;
});
liveSocket.on('bell:strike', (payload) => {
  playBellAudio();
  ui.showBellMilestone(payload);
  sceneOrQueue((scene) => scene.strikeBellAura());
});
liveSocket.on('ceremony:start', (payload) => {
  playBellAudio();
  ui.showCeremonyOverlay(true);
  sceneOrQueue((scene) => scene.performCeremony());
});
liveSocket.on('ceremony:end', (payload) => {
  ui.showCeremonyOverlay(false);
  if (payload?.nextCeremonyAt) {
    nextCeremonyTimestamp = payload.nextCeremonyAt;
    tickCeremonyTimer();
  }
});
liveSocket.on('ceremony:status', (status) => {
  if (status?.nextCeremonyAt) {
    nextCeremonyTimestamp = status.nextCeremonyAt;
    tickCeremonyTimer();
  }
});
liveSocket.on('fortune:draw', (payload) => {
  ui.showFortune(payload);
  sceneOrQueue((scene) => {
    const person = scene.worshippers?.people?.get(payload.viewer?.id);
    if (person && typeof person.prostrate === 'function') {
      person.prostrate();
    }
  });
});
liveSocket.on('connect_error', () => ui.updateLive({ status: 'disconnected' }));

const unlockAll = () => {
  audioDirector.unlock();
  aiVoiceDirector.unlock();
};
$('#enable-sound')?.addEventListener('click', unlockAll);
window.addEventListener('pointerdown', unlockAll, { once: true });
$('#toggle-donor-board')?.addEventListener('click', () => {
  const board = $('#donor-board');
  if (!board) return;
  board.classList.toggle('panel-collapsed');
  try { localStorage.setItem('donorBoardCollapsed', board.classList.contains('panel-collapsed') ? '1' : '0'); } catch (_) {}
});

$('#toggle-gift-guide')?.addEventListener('click', () => {
  const guide = $('#gift-guide');
  if (!guide) return;
  guide.classList.toggle('panel-collapsed');
  try { localStorage.setItem('giftGuideCollapsed', guide.classList.contains('panel-collapsed') ? '1' : '0'); } catch (_) {}
});

$('#fortune-close-btn')?.addEventListener('click', () => ui.hideFortune());

// Khôi phục trạng thái thu gọn đã lưu từ phiên trước
try {
  if (localStorage.getItem('giftGuideCollapsed') === '1') {
    $('#gift-guide')?.classList.add('panel-collapsed');
  }
  if (localStorage.getItem('donorBoardCollapsed') === '1') {
    $('#donor-board')?.classList.add('panel-collapsed');
  }
} catch (_) {}
