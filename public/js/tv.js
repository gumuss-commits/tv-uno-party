/**
 * TV UNO - Television / Big Screen Display Logic
 */

(function() {
  const socket = io();

  let currentRoomCode = null;
  let currentState = null;
  let previousTopCardId = null;
  let previousTopCardObj = null;

  // DOM Elements
  const tvRoomCodeEl = document.getElementById('tv-room-code');
  const tvLobbyView = document.getElementById('tv-lobby-view');
  const tvArenaView = document.getElementById('tv-arena-view');
  const tvQrBox = document.getElementById('tv-qr-box');
  const tvJoinUrl = document.getElementById('tv-join-url');
  const lobbyPlayersGrid = document.getElementById('lobby-players-grid');
  const lobbyPlayerCount = document.getElementById('lobby-player-count');
  const btnStartGame = document.getElementById('btn-start-game');
  const btnAddBot = document.getElementById('btn-add-bot');
  const btnRemoveBot = document.getElementById('btn-remove-bot');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnRestartGame = document.getElementById('btn-restart-game');

  // Arena Elements
  const directionOrbit = document.getElementById('direction-orbit');
  const activeColorBeacon = document.getElementById('active-color-beacon');
  const colorDot = document.getElementById('color-dot');
  const colorNameText = document.getElementById('color-name-text');
  const pendingPenaltyBanner = document.getElementById('pending-penalty-banner');
  const penaltyCountVal = document.getElementById('penalty-count-val');
  const deckCountBadge = document.getElementById('deck-count-badge');
  const tvTopCardWrapper = document.getElementById('tv-top-card-wrapper');
  const discardUnder1 = document.getElementById('discard-under-1');
  const discardUnder2 = document.getElementById('discard-under-2');
  const tvPlayersLayout = document.getElementById('tv-players-layout');
  const tvEventTicker = document.getElementById('tv-event-ticker');
  const tvWinnerModal = document.getElementById('tv-winner-modal');
  const winnerAvatar = document.getElementById('winner-avatar');
  const winnerName = document.getElementById('winner-name');

  // Query params
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');

  // Audio unlock on any key or touch
  const unlockAudio = () => {
    window.soundFX.init();
  };
  ['click', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true });
  });

  // Initialize room creation with origin so QR code and links match the website
  socket.emit('host:create_or_join', {
    roomCode: roomParam,
    origin: window.location.origin
  });

  socket.on('host:room_ready', (data) => {
    currentRoomCode = data.roomCode;
    tvRoomCodeEl.textContent = data.roomCode;
    tvJoinUrl.textContent = data.playUrl;

    if (data.qrCode) {
      tvQrBox.innerHTML = `<img src="${data.qrCode}" alt="Katılım QR Kodu">`;
    }

    if (data.state) {
      updateGameState(data.state);
    }
  });

  socket.on('tv:state_update', (state) => {
    updateGameState(state);
  });

  socket.on('game:action', (action) => {
    handleGameAction(action);
  });

  socket.on('host:error', (err) => {
    showTicker(`⚠️ ${err.message}`);
  });

  // Host Action Listeners
  btnStartGame.addEventListener('click', () => {
    window.soundFX.click();
    socket.emit('host:start_game');
  });

  btnAddBot.addEventListener('click', () => {
    window.soundFX.click();
    socket.emit('host:add_bot');
  });

  btnRemoveBot.addEventListener('click', () => {
    window.soundFX.click();
    socket.emit('host:remove_bot');
  });

  btnRestartGame.addEventListener('click', () => {
    window.soundFX.click();
    tvWinnerModal.style.display = 'none';
    stopConfetti();
    socket.emit('host:start_game');
  });

  btnFullscreen.addEventListener('click', () => {
    window.soundFX.click();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  /**
   * Main state update dispatcher
   */
  function updateGameState(state) {
    currentState = state;

    if (state.status === 'lobby') {
      tvLobbyView.style.display = 'grid';
      tvArenaView.style.display = 'none';
      tvWinnerModal.style.display = 'none';
      stopConfetti();
      document.body.className = 'tv-body';
      renderLobbyPlayers(state.players);
    } else if (state.status === 'playing' || state.status === 'round_end') {
      tvLobbyView.style.display = 'none';
      tvArenaView.style.display = 'flex';
      renderArena(state);

      if (state.status === 'round_end' && state.winner) {
        showWinnerCelebration(state.winner);
      }
    }
  }

  /**
   * Render Lobby players grid
   */
  function renderLobbyPlayers(players) {
    lobbyPlayerCount.textContent = `${players.length}/8`;
    lobbyPlayersGrid.innerHTML = '';

    btnStartGame.disabled = players.length < 2;

    players.forEach(p => {
      const item = document.createElement('div');
      item.className = 'tv-lobby-player-item';
      item.innerHTML = `
        <div class="player-avatar-large" style="background-color: ${p.color};">
          ${p.avatar}
        </div>
        <div class="player-name-large">${escapeHtml(p.name)}</div>
        <div class="player-tag">${p.isBot ? '🤖 BOT' : '📱 OYUNCU'}</div>
      `;
      lobbyPlayersGrid.appendChild(item);
    });
  }

  /**
   * Render in-game arena table
   */
  function renderArena(state) {
    // Ambient background color glow
    document.body.className = `tv-body glow-${state.activeColor || 'blue'}`;

    // Direction orbit
    if (state.direction === 1) {
      directionOrbit.classList.remove('reversed');
    } else {
      directionOrbit.classList.add('reversed');
    }

    // Draw deck count
    deckCountBadge.textContent = `Deste: ${state.deckCount}`;

    // Active Color Beacon (especially when Wild card played)
    if (state.topCard && (state.topCard.color === 'wild' || state.topCard.type === 'wild' || state.topCard.type === 'wild4')) {
      activeColorBeacon.style.display = 'flex';
      const colorNames = { red: 'KIRMIZI', blue: 'MAVİ', green: 'YEŞİL', yellow: 'SARI' };
      const colorHexes = { red: 'var(--uno-red)', blue: 'var(--uno-blue)', green: 'var(--uno-green)', yellow: 'var(--uno-yellow)' };
      colorDot.style.backgroundColor = colorHexes[state.activeColor] || '#ffffff';
      colorNameText.textContent = colorNames[state.activeColor] || state.activeColor.toUpperCase();
    } else {
      activeColorBeacon.style.display = 'none';
    }

    // Pending Penalty Banner
    if (state.pendingPenalty > 0) {
      pendingPenaltyBanner.style.display = 'block';
      penaltyCountVal.textContent = state.pendingPenalty;
    } else {
      pendingPenaltyBanner.style.display = 'none';
    }

    // Discard Pile: Layered Cards Simulation
    if (state.topCard) {
      const isNewCard = !previousTopCardId || previousTopCardId !== state.topCard.id;
      if (isNewCard) {
        if (previousTopCardObj) {
          // Slide old top card to under-pile with natural angle
          discardUnder1.innerHTML = '';
          const underEl = window.CardRenderer.createCardElement(previousTopCardObj, { size: 'lg' });
          const rot = (Math.random() * 24 - 12).toFixed(1);
          discardUnder1.style.transform = `rotate(${rot}deg)`;
          discardUnder1.appendChild(underEl);
        }

        previousTopCardId = state.topCard.id;
        previousTopCardObj = state.topCard;

        tvTopCardWrapper.innerHTML = '';
        const cardEl = window.CardRenderer.createCardElement(state.topCard, { size: 'lg' });
        tvTopCardWrapper.appendChild(cardEl);
      }
    }

    // Render Seated Players around the table with dynamic oval positioning
    renderPlayersAroundTable(state.players, state.currentTurnPlayerId);
  }

  /**
   * Mathematically perfect elliptical seating distribution for 2 to 8 players
   */
  function renderPlayersAroundTable(players, currentTurnPlayerId) {
    tvPlayersLayout.innerHTML = '';
    const total = players.length;
    if (total === 0) return;

    // Angle distribution (in degrees, 90deg is bottom, 270deg is top)
    let angles = [];
    if (total === 2) {
      angles = [90, 270]; // Bottom vs Top
    } else if (total === 3) {
      angles = [90, 210, 330]; // Bottom, Top-Left, Top-Right
    } else if (total === 4) {
      angles = [90, 180, 270, 0]; // Bottom, Left, Top, Right
    } else {
      // 5 to 8 players: evenly spaced clockwise starting from bottom
      const step = 360 / total;
      for (let i = 0; i < total; i++) {
        angles.push((90 + (i * step)) % 360);
      }
    }

    const radiusX = 42; // percent from center
    const radiusY = 38; // percent from center

    players.forEach((player, idx) => {
      const seat = document.createElement('div');
      seat.className = 'tv-player-seat';
      seat.dataset.playerId = player.id;

      const angleDeg = angles[idx];
      const angleRad = (angleDeg * Math.PI) / 180;

      const leftPercent = 50 + radiusX * Math.cos(angleRad);
      const topPercent = 50 + radiusY * Math.sin(angleRad);

      seat.style.left = `${leftPercent}%`;
      seat.style.top = `${topPercent}%`;
      seat.style.transform = 'translate(-50%, -50%)';

      if (player.id === currentTurnPlayerId) {
        seat.classList.add('is-turn');
      }

      // UNO flame badge if player has 1 card
      const unoFlameHtml = (player.cardCount === 1)
        ? `<div class="uno-shout-flame">🔥 UNO!</div>`
        : '';

      seat.innerHTML = `
        ${unoFlameHtml}
        <div class="seat-card">
          <div class="seat-avatar" style="background-color: ${player.color};">
            ${player.avatar}
          </div>
          <div class="seat-details">
            <div class="seat-name">${escapeHtml(player.name)}</div>
            <div class="seat-cards-badge">
              <span>🃏</span>
              <span class="cards-count-num">${player.cardCount} Kart</span>
            </div>
          </div>
        </div>
      `;

      tvPlayersLayout.appendChild(seat);
    });
  }

  /**
   * Handle game actions & sound effects
   */
  function handleGameAction(action) {
    if (!action) return;

    if (action.text) {
      showTicker(action.text);
    }

    // Play synthesized sound effects
    switch (action.type) {
      case 'game_start':
        window.soundFX.winFanfare();
        break;
      case 'play_card':
        if (action.card) {
          if (action.card.type === 'skip' || action.card.type === 'reverse') {
            window.soundFX.skipReverse();
          } else if (action.card.type === 'wild' || action.card.type === 'wild4') {
            window.soundFX.wildShimmer();
          } else {
            window.soundFX.playCard();
          }
        }
        break;
      case 'draw_card':
      case 'bot_draw':
      case 'draw_penalty':
        window.soundFX.drawCard();
        break;
      case 'uno_shout':
      case 'bot_uno':
        window.soundFX.unoShout();
        break;
      case 'uno_caught':
      case 'bot_catch_uno':
        window.soundFX.penaltyBuzz();
        break;
      case 'game_won':
        window.soundFX.winFanfare();
        break;
    }

    // Show speech bubble over the player who performed the action
    if (action.player) {
      showPlayerBubble(action.player, action.text);
    }
  }

  function showPlayerBubble(playerName, text) {
    const seats = document.querySelectorAll('.tv-player-seat');
    seats.forEach(seat => {
      const nameEl = seat.querySelector('.seat-name');
      if (nameEl && nameEl.textContent.trim() === playerName.trim()) {
        const existing = seat.querySelector('.seat-bubble');
        if (existing) existing.remove();

        const bubble = document.createElement('div');
        bubble.className = 'seat-bubble';

        // Extract punchy short phrase from text
        let shortText = 'Oynadı';
        if (text.includes('UNO!')) shortText = '🔥 UNO!';
        else if (text.includes('+4')) shortText = '💥 +4 ATTI!';
        else if (text.includes('+2')) shortText = '💥 +2 ATTI!';
        else if (text.includes('Pas')) shortText = '⛔ PAS';
        else if (text.includes('Yön')) shortText = '🔄 YÖN';
        else if (text.includes('çekti')) shortText = '📥 KART ÇEKTİ';
        else if (text.includes('yakaladı')) shortText = '⚡ YAKALANDI!';

        bubble.textContent = shortText;
        seat.appendChild(bubble);

        setTimeout(() => bubble.remove(), 2400);
      }
    });
  }

  function showTicker(msg) {
    tvEventTicker.textContent = msg;
    tvEventTicker.style.animation = 'none';
    tvEventTicker.offsetHeight; // trigger reflow
    tvEventTicker.style.animation = 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
  }

  function showWinnerCelebration(winner) {
    winnerAvatar.textContent = winner.avatar;
    winnerAvatar.style.backgroundColor = winner.color;
    winnerName.textContent = winner.name;
    tvWinnerModal.style.display = 'flex';
    startConfetti();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // --- Particle Confetti Engine for TV Celebration ---
  let confettiInterval = null;
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function startConfetti() {
    particles = [];
    const colors = ['#ff2a4b', '#0984e3', '#00b894', '#fdcb6e', '#a29bfe', '#fd79a8'];
    for (let i = 0; i < 180; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: Math.random() * 12 + 6,
        h: Math.random() * 16 + 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.random() * 4 - 2,
        vy: Math.random() * 5 + 3,
        rot: Math.random() * 360,
        vRot: Math.random() * 6 - 3
      });
    }

    if (!confettiInterval) {
      confettiInterval = requestAnimationFrame(renderConfetti);
    }
  }

  function renderConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vRot;

      if (p.y > canvas.height) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    confettiInterval = requestAnimationFrame(renderConfetti);
  }

  function stopConfetti() {
    if (confettiInterval) {
      cancelAnimationFrame(confettiInterval);
      confettiInterval = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
})();
