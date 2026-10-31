/**
 * TV UNO - Mobile Phone Controller Engine
 * Authentic Playing Card Fan (İskambil Yelpazesi) + Swipe/Tap Gestures
 */

(function() {
  const socket = io();

  // State
  let myToken = localStorage.getItem('uno_token') || null;
  let myPlayerId = null;
  let currentRoom = null;
  let myHand = [];
  let isMyTurn = false;
  let pendingWildCardId = null;
  let focusedCardId = null;
  let currentGameStatus = 'lobby';
  let wakeLock = null;

  // Avatar & Color Choices
  const AVATARS = ['🦁', '🦊', '🐼', '🐯', '🚀', '👑', '⚡', '🍕', '🥑', '🎮', '🦄', '💎', '🔥', '🦉', '🎯', '🐱'];
  const COLORS = ['#ff2a4b', '#0984e3', '#00b894', '#fdcb6e', '#a29bfe', '#fd79a8'];

  let selectedAvatar = localStorage.getItem('uno_avatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)];
  let selectedColor = localStorage.getItem('uno_color') || COLORS[Math.floor(Math.random() * COLORS.length)];

  // DOM Elements
  const phoneJoinView = document.getElementById('phone-join-view');
  const phoneGameView = document.getElementById('phone-game-view');
  const inputRoomCode = document.getElementById('input-room-code');
  const inputPlayerName = document.getElementById('input-player-name');
  const avatarSelector = document.getElementById('avatar-selector');
  const colorSelector = document.getElementById('color-selector');
  const btnJoinRoom = document.getElementById('btn-join-room');

  // Game UI Elements
  const myAvatarEl = document.getElementById('my-avatar');
  const myNameEl = document.getElementById('my-name');
  const phoneColorBadge = document.getElementById('phone-color-badge');
  const phoneColorDot = document.getElementById('phone-color-dot');
  const phoneColorName = document.getElementById('phone-color-name');
  const phoneTurnBanner = document.getElementById('phone-turn-banner');
  const miniTopcardText = document.getElementById('mini-topcard-text');
  const phoneHandContainer = document.getElementById('phone-hand-container');
  const btnDrawCard = document.getElementById('btn-draw-card');
  const drawBtnIcon = document.getElementById('draw-btn-icon');
  const drawBtnText = document.getElementById('draw-btn-text');
  const btnShoutUno = document.getElementById('btn-shout-uno');
  const btnCatchUno = document.getElementById('btn-catch-uno');
  const wildColorModal = document.getElementById('wild-color-modal');
  const btnCancelWild = document.getElementById('btn-cancel-wild');

  // Request Screen Wake Lock so phone does not sleep during party game
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  }

  // Haptic feedback helper
  function vibrate(pattern) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  // Pre-fill Room Code if scanned from TV QR Code
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    inputRoomCode.value = roomParam.toUpperCase();
  }

  // Pre-fill saved name
  const savedName = localStorage.getItem('uno_name');
  if (savedName) {
    inputPlayerName.value = savedName;
  }

  // Setup Avatar Picker
  AVATARS.forEach(avatar => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-choice-btn' + (avatar === selectedAvatar ? ' selected' : '');
    btn.textContent = avatar;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.avatar-choice-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAvatar = avatar;
      localStorage.setItem('uno_avatar', avatar);
      vibrate(15);
    });
    avatarSelector.appendChild(btn);
  });

  // Setup Color Picker
  COLORS.forEach(color => {
    const dot = document.createElement('div');
    dot.className = 'color-choice-dot' + (color === selectedColor ? ' selected' : '');
    dot.style.backgroundColor = color;
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-choice-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      selectedColor = color;
      localStorage.setItem('uno_color', color);
      vibrate(15);
    });
    colorSelector.appendChild(dot);
  });

  // Join Room Button Handler
  btnJoinRoom.addEventListener('click', () => {
    const code = (inputRoomCode.value || '').trim().toUpperCase();
    const name = (inputPlayerName.value || '').trim();

    if (!code || code.length < 2) {
      return showToast('Lütfen TV ekranındaki oda kodunu girin!');
    }
    if (!name) {
      return showToast('Lütfen isminizi girin!');
    }

    localStorage.setItem('uno_name', name);
    window.soundFX.click();
    requestWakeLock();

    socket.emit('player:join', {
      roomCode: code,
      name,
      avatar: selectedAvatar,
      color: selectedColor,
      token: myToken
    });
  });

  // Join Response Handlers
  socket.on('player:join_error', (data) => {
    vibrate([80, 50, 80]);
    showToast(data.message || 'Odaya katılırken hata oluştu.');
  });

  socket.on('player:joined_success', (data) => {
    myPlayerId = data.player.id;
    currentRoom = data.roomCode;
    myToken = data.player.token;
    localStorage.setItem('uno_token', myToken);

    // Switch UI to controller
    phoneJoinView.style.display = 'none';
    phoneGameView.style.display = 'flex';

    myAvatarEl.textContent = data.player.avatar;
    myAvatarEl.style.backgroundColor = data.player.color;
    myNameEl.textContent = data.player.name;

    if (data.state) {
      updatePlayerState(data.state);
    }
  });

  // Player State Update
  socket.on('player:state_update', (state) => {
    if (!state) return;
    updatePlayerState(state);
  });

  socket.on('player:action_error', (data) => {
    vibrate([80, 50, 80]);
    window.soundFX.penaltyBuzz();
    showToast(data.message || 'Geçersiz hamle!');
  });

  // Global game action
  socket.on('game:action', (action) => {
    if (action.type === 'game_won') {
      window.soundFX.winFanfare();
    }
  });

  /**
   * Main player state renderer
   */
  function updatePlayerState(state) {
    const wasMyTurn = isMyTurn;
    isMyTurn = state.isMyTurn;
    myHand = state.myHand || [];
    currentGameStatus = state.status;

    // Trigger turn notification chime & vibration if turn just became mine
    if (isMyTurn && !wasMyTurn) {
      vibrate([60, 40, 100]);
      window.soundFX.turnAlert();
    }

    // Update Active Color Badge
    const colorNames = { red: 'Kırmızı', blue: 'Mavi', green: 'Yeşil', yellow: 'Sarı', wild: 'Joker' };
    const colorHexes = { red: 'var(--uno-red)', blue: 'var(--uno-blue)', green: 'var(--uno-green)', yellow: 'var(--uno-yellow)', wild: '#fff' };

    phoneColorDot.style.backgroundColor = colorHexes[state.activeColor] || '#ffffff';
    phoneColorName.textContent = colorNames[state.activeColor] || state.activeColor;

    // Turn Banner
    if (state.status === 'lobby') {
      phoneTurnBanner.className = 'phone-turn-banner';
      phoneTurnBanner.textContent = 'TV ekranından oyun başlatılması bekleniyor...';
    } else if (state.status === 'round_end') {
      phoneTurnBanner.className = 'phone-turn-banner';
      phoneTurnBanner.textContent = `🏆 Kazanan: ${state.winner ? state.winner.name : 'Tebrikler'}`;
    } else if (isMyTurn) {
      phoneTurnBanner.className = 'phone-turn-banner my-turn';
      if (state.pendingPenalty > 0) {
        phoneTurnBanner.textContent = `💥 DİKKAT: +${state.pendingPenalty} CEZA! Kart at veya çek!`;
      } else if (state.hasDrawnThisTurn) {
        phoneTurnBanner.textContent = 'Yeni kartı oyna veya Pas Geç ⏭️';
      } else {
        phoneTurnBanner.textContent = '🔥 SIRA SENDE! BİR KART SEÇ';
      }
    } else {
      phoneTurnBanner.className = 'phone-turn-banner';
      const curPlayer = state.players ? state.players.find(p => p.id === state.currentTurnPlayerId) : null;
      phoneTurnBanner.textContent = `Sıra: ${curPlayer ? curPlayer.name : 'Diğer Oyuncuda'}...`;
    }

    // Mini Top Card Info
    if (state.topCard) {
      const cardName = CardRenderer.ICONS ? formatCardMini(state.topCard) : `${state.topCard.color} ${state.topCard.value}`;
      miniTopcardText.innerHTML = cardName;
    }

    // Catch UNO Button Visibility
    if (state.canCatchUno) {
      btnCatchUno.style.display = 'block';
    } else {
      btnCatchUno.style.display = 'none';
    }

    // Draw / Pass Button Mode
    if (state.hasDrawnThisTurn && isMyTurn) {
      btnDrawCard.classList.add('pass-mode');
      drawBtnIcon.textContent = '⏭️';
      drawBtnText.textContent = 'PAS GEÇ';
    } else {
      btnDrawCard.classList.remove('pass-mode');
      drawBtnIcon.textContent = '📥';
      drawBtnText.textContent = state.pendingPenalty > 0 ? `+${state.pendingPenalty} CEZA ÇEK` : 'KART ÇEK';
    }

    // Clear focused card if it was removed from hand
    if (focusedCardId && !myHand.some(c => c.id === focusedCardId)) {
      focusedCardId = null;
    }

    // Render Hand as an authentic playing card fan
    renderHandCards(myHand, state.status);
  }

  function formatCardMini(card) {
    const cNames = { red: 'Kırmızı', blue: 'Mavi', green: 'Yeşil', yellow: 'Sarı', wild: 'Joker' };
    return `<strong style="color:${card.color === 'yellow' ? '#f59e0b' : (card.color === 'wild' ? '#fff' : card.color)};">${cNames[card.color] || card.color}</strong> ${card.value}`;
  }

  /**
   * AUTHENTIC PLAYING CARD FAN RENDERER
   * - When total < 7: Single elegant oval arc.
   * - When total >= 7: Two-Tier (Alt-Üst 2 Sıra) Oval Fan with brick stagger!
   */
  function renderHandCards(cards, gameStatus) {
    phoneHandContainer.innerHTML = '';

    if (!cards || cards.length === 0) {
      focusedCardId = null;
      phoneHandContainer.innerHTML = `
        <div class="lobby-hand-wait-box">
          <div class="wait-icon">🎴</div>
          <div class="wait-title">${gameStatus === 'round_end' ? 'Tur Tamamlandı!' : 'Oyun Başlatılması Bekleniyor'}</div>
          <div class="wait-subtitle">${gameStatus === 'round_end' ? 'Yeni tur için TV ekranını bekleyin.' : 'TV ekranından oyun başlatıldığında kartlarınız buraya dağıtılacak.'}</div>
        </div>
      `;
      return;
    }

    const stage = document.createElement('div');
    stage.className = 'card-fan-stage';

    const total = cards.length;
    const containerW = phoneHandContainer.clientWidth || window.innerWidth;
    const stageW = Math.min(containerW - 8, 430);
    stage.style.width = stageW + 'px';

    const isTwoTier = total >= 7;

    if (isTwoTier) {
      // TWO TIER OVAL FAN (Alt-Üst 2 Sıra)
      const topCount = Math.ceil(total / 2);
      const topCards = cards.slice(0, topCount);
      const bottomCards = cards.slice(topCount);

      // Card dimensions for two tiers
      const cardW = stageW < 360 ? 104 : 110;
      const cardH = stageW < 360 ? 150 : 158;

      // Render Top Tier (Arka Sıra)
      renderCardTier(topCards, {
        tierClass: 'tier-top',
        baseZIndex: 10,
        stage,
        stageW,
        cardW,
        cardH,
        isTopTier: true
      });

      // Render Bottom Tier (Ön Sıra)
      renderCardTier(bottomCards, {
        tierClass: 'tier-bottom',
        baseZIndex: 60,
        stage,
        stageW,
        cardW,
        cardH,
        isTopTier: false,
        staggerOffset: (topCount === bottomCards.length) ? 14 : 0
      });

    } else {
      // SINGLE TIER OVAL FAN (< 7 Cards)
      let cardW = 114;
      let cardH = 165;
      if (total <= 4) {
        cardW = 125;
        cardH = 180;
      }

      renderCardTier(cards, {
        tierClass: 'tier-single',
        baseZIndex: 20,
        stage,
        stageW,
        cardW,
        cardH,
        isTopTier: false
      });
    }

    phoneHandContainer.appendChild(stage);
  }

  function renderCardTier(tierCards, config) {
    const { tierClass, baseZIndex, stage, stageW, cardW, cardH, isTopTier, staggerOffset = 0 } = config;
    const count = tierCards.length;

    let spacing = cardW * 0.52;
    if (count > 1) {
      const naturalWidth = cardW + (count - 1) * spacing;
      if (naturalWidth > stageW) {
        spacing = (stageW - cardW) / (count - 1);
      } else if (count <= 3) {
        spacing = Math.min(cardW * 0.75, (stageW - cardW) / (count - 1));
      }
    }

    const totalWidth = count === 1 ? cardW : cardW + (count - 1) * spacing;
    let leftPadding = Math.max(0, (stageW - totalWidth) / 2) + staggerOffset;
    if (leftPadding + totalWidth > stageW) {
      leftPadding = Math.max(0, (stageW - totalWidth) / 2);
    }

    const maxSpread = Math.min(26, Math.max(8, count * 4.6));
    const angleStep = count > 1 ? maxSpread / (count - 1) : 0;
    const startAngle = -(maxSpread / 2);
    const midIndex = (count - 1) / 2;

    tierCards.forEach((card, i) => {
      const cardEl = window.CardRenderer.createCardElement(card, {
        interactive: true,
        playable: card.isPlayable
      });

      cardEl.classList.add(tierClass);
      cardEl.style.width = cardW + 'px';
      cardEl.style.height = cardH + 'px';

      const leftX = leftPadding + (i * spacing);
      const angle = count === 1 ? 0 : startAngle + (i * angleStep);
      const distFromMid = Math.abs(i - midIndex);
      const normDist = midIndex > 0 ? (distFromMid / midIndex) : 0;

      // Parabolic vertical drop at edges for authentic oval curve
      const yDrop = Math.pow(normDist, 2) * 11;

      // Playable cards elevate by 24px so they stick out of their tier!
      const defaultY = (card.isPlayable ? -24 : 0) + yDrop;

      cardEl.style.left = `${leftX}px`;

      // Check if focused
      const isFocused = card.id === focusedCardId;
      if (isFocused) {
        cardEl.classList.add('card-focused');
        cardEl.style.transform = `translate3d(0, -75px, 0) scale(1.24) rotate(0deg)`;
        cardEl.style.zIndex = 300;
      } else {
        cardEl.style.transform = `translate3d(0, ${defaultY}px, 0) rotate(${angle}deg)`;
        cardEl.style.zIndex = baseZIndex + i;
      }

      // Attach gesture, inspection & swipe handlers
      attachFanCardGestures(cardEl, card, { leftX, defaultY, angle, zIndex: baseZIndex + i });

      stage.appendChild(cardEl);
    });
  }

  /**
   * Fan Card Touch & Swipe Handlers
   * Supports: Tap to Inspect/Focus, Tap again to Play, Swipe UP to Throw to TV
   */
  function attachFanCardGestures(cardEl, card, pos) {
    let startY = 0;
    let startX = 0;
    let currentDeltaY = 0;
    let isSwiping = false;

    cardEl.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startY = touch.clientY;
      startX = touch.clientX;
      currentDeltaY = 0;
      isSwiping = false;
    }, { passive: true });

    cardEl.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const deltaY = touch.clientY - startY;
      const deltaX = Math.abs(touch.clientX - startX);

      // If dragging upwards
      if (deltaY < -10 && deltaY < -deltaX) {
        if (e.cancelable) e.preventDefault();
        isSwiping = true;
        currentDeltaY = deltaY;
        cardEl.classList.add('swiping-up');
        cardEl.style.transform = `translate3d(0, ${pos.defaultY + deltaY}px, 0) scale(1.15) rotate(0deg)`;
      }
    }, { passive: false });

    cardEl.addEventListener('touchend', () => {
      if (isSwiping) {
        cardEl.classList.remove('swiping-up');

        // Swipe up threshold: -50px
        if (currentDeltaY < -50) {
          triggerPlayCard(card, cardEl);
        } else {
          // Snap back to normal or focused position
          if (card.id === focusedCardId) {
            cardEl.style.transform = `translate3d(0, -46px, 0) scale(1.18) rotate(0deg)`;
          } else {
            cardEl.style.transform = `translate3d(0, ${pos.defaultY}px, 0) rotate(${pos.angle}deg)`;
          }
        }
        return;
      }
    });

    // Tap handler for Inspection and Play
    cardEl.addEventListener('click', (e) => {
      if (isSwiping) return;
      e.stopPropagation();

      if (focusedCardId === card.id) {
        // Second tap on the focused card -> play it!
        triggerPlayCard(card, cardEl);
      } else {
        // First tap -> Focus & Lift this card out of the fan for clear reading
        focusedCardId = card.id;
        vibrate(18);
        renderHandCards(myHand, currentGameStatus);
      }
    });
  }

  // Tap anywhere outside hand to un-focus card
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.uno-card') && focusedCardId !== null) {
      focusedCardId = null;
      renderHandCards(myHand, currentGameStatus);
    }
  });

  // Re-render fan on screen orientation/resize change
  window.addEventListener('resize', () => {
    if (myHand.length > 0) {
      renderHandCards(myHand, currentGameStatus);
    }
  });

  /**
   * Initiate playing a card
   */
  function triggerPlayCard(card, cardEl) {
    if (!isMyTurn) {
      vibrate([40]);
      return showToast('Şu anda sıra sende değil!');
    }

    if (!card.isPlayable) {
      vibrate([80, 50, 80]);
      return showToast('Bu kart masadaki karta uymuyor!');
    }

    // If Wild Card, show color picker modal
    if (card.color === 'wild' || card.type === 'wild' || card.type === 'wild4') {
      pendingWildCardId = card.id;
      wildColorModal.style.display = 'flex';
      vibrate(30);
      return;
    }

    // Execute standard card play
    launchCardAnimation(cardEl);
    vibrate(35);
    window.soundFX.playCard();
    socket.emit('player:play_card', { cardId: card.id });
    focusedCardId = null;
  }

  function launchCardAnimation(cardEl) {
    if (!cardEl) return;
    cardEl.classList.add('thrown-to-tv');
  }

  // Wild Color Picker Selection
  document.querySelectorAll('.color-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const chosenColor = btn.dataset.color;
      wildColorModal.style.display = 'none';

      if (pendingWildCardId) {
        vibrate(35);
        window.soundFX.wildShimmer();
        socket.emit('player:play_card', {
          cardId: pendingWildCardId,
          chosenColor
        });
        pendingWildCardId = null;
        focusedCardId = null;
      }
    });
  });

  // Wild Color Picker Cancel
  if (btnCancelWild) {
    btnCancelWild.addEventListener('click', () => {
      wildColorModal.style.display = 'none';
      pendingWildCardId = null;
    });
  }

  // Draw or Pass Button
  btnDrawCard.addEventListener('click', () => {
    if (!isMyTurn) {
      return showToast('Şu anda sıra sende değil!');
    }

    vibrate(30);
    window.soundFX.drawCard();

    if (btnDrawCard.classList.contains('pass-mode')) {
      socket.emit('player:pass_turn');
    } else {
      socket.emit('player:draw_card');
    }
  });

  // UNO Shout Button
  btnShoutUno.addEventListener('click', () => {
    if (myHand.length > 2) {
      vibrate([50, 50]);
      return showToast('UNO demek için elinde 1 veya 2 kart olmalı!');
    }
    vibrate([150]);
    window.soundFX.unoShout();
    socket.emit('player:shout_uno');
    showToast('🔥 UNO diye bağırdın!');
  });

  // Catch UNO Button
  btnCatchUno.addEventListener('click', () => {
    vibrate([100, 50, 100]);
    window.soundFX.penaltyBuzz();
    socket.emit('player:catch_uno');
  });

  // Helper: Toast Message
  function showToast(msg) {
    const existing = document.querySelector('.phone-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'phone-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2500);
  }
})();
