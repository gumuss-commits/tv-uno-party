const { createDeck, shuffle, isValidMove, COLORS } = require('./cardDefs');

class UnoGame {
  constructor(roomCode, options = {}) {
    this.roomCode = roomCode;
    this.players = [];
    this.status = 'lobby'; // 'lobby' | 'playing' | 'round_end'
    this.deck = [];
    this.discardPile = [];
    this.activeColor = null;
    this.currentTurnIndex = 0;
    this.direction = 1; // 1 = clockwise, -1 = counter-clockwise
    this.pendingPenalty = 0;
    this.hasDrawnThisTurn = false;
    this.drawnCardId = null;
    this.lastAction = null;
    this.winner = null;

    // Uno shout & challenge tracking
    this.unoVulnerablePlayerId = null;
    this.unoGraceTimeout = null;

    // Disconnection grace timer
    this.disconnectTimeout = null;

    // External listener for state change triggers (e.g. grace period expiry)
    this.onStateChange = null;

    // Rules options
    this.options = {
      allowStacking: options.allowStacking !== undefined ? options.allowStacking : true,
      allowWild4OnDraw2: options.allowWild4OnDraw2 !== undefined ? options.allowWild4OnDraw2 : true,
      drawUntilPlayable: options.drawUntilPlayable !== undefined ? options.drawUntilPlayable : false,
      turnTimerSec: options.turnTimerSec || 0,
      ...options
    };

    // Bot timers
    this.botTimer = null;
  }

  /**
   * Add a player to the room
   */
  addPlayer({ id, name, avatar, color, isBot = false, token }) {
    // If player is rejoining with existing token
    const existingIndex = this.players.findIndex(p => p.token === token);
    if (existingIndex !== -1) {
      this.players[existingIndex].id = id;
      this.players[existingIndex].isConnected = true;
      if (name) this.players[existingIndex].name = name;
      if (this.disconnectTimeout) {
        clearTimeout(this.disconnectTimeout);
        this.disconnectTimeout = null;
      }
      return { player: this.players[existingIndex], reconnected: true };
    }

    const player = {
      id,
      token: token || `tok_${Math.random().toString(36).substring(2, 9)}`,
      name: name || `Oyuncu ${this.players.length + 1}`,
      avatar: avatar || '🎮',
      color: color || '#ff2a4b',
      hand: [],
      hasShoutedUno: false,
      isBot,
      isConnected: true,
      stats: { cardsPlayed: 0, cardsDrawn: 0, unoShouts: 0 }
    };

    this.players.push(player);
    return { player, reconnected: false };
  }

  /**
   * Remove or disconnect player from room
   */
  removePlayer(playerId) {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx === -1) return false;

    // If game in lobby, fully delete
    if (this.status === 'lobby') {
      this.players.splice(idx, 1);
      return true;
    }

    // If in game, mark disconnected
    this.players[idx].isConnected = false;

    // If it was this player's turn, give 20 second grace period before auto-skipping
    if (this.currentTurnIndex === idx) {
      if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = setTimeout(() => {
        if (this.status === 'playing' && this.currentTurnIndex === idx && !this.players[idx].isConnected) {
          this.lastAction = {
            type: 'player_timeout',
            player: this.players[idx].name,
            text: `⏱️ ${this.players[idx].name} bağlanamadığı için sırası devredildi.`
          };
          this.advanceTurn();
          if (this.onStateChange) this.onStateChange('player_timeout');
        }
      }, 20000);
    }
    return true;
  }

  /**
   * Start a new game round
   */
  startNewGame() {
    if (this.players.length < 2) {
      throw new Error('En az 2 oyuncu gerekli!');
    }

    this.status = 'playing';
    this.deck = shuffle(createDeck());
    this.discardPile = [];
    this.direction = 1;
    this.currentTurnIndex = Math.floor(Math.random() * this.players.length);
    this.pendingPenalty = 0;
    this.hasDrawnThisTurn = false;
    this.drawnCardId = null;
    this.winner = null;
    this.unoVulnerablePlayerId = null;
    if (this.unoGraceTimeout) clearTimeout(this.unoGraceTimeout);
    if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);

    // Deal 7 cards to each player
    for (const player of this.players) {
      player.hand = [];
      player.hasShoutedUno = false;
      for (let i = 0; i < 7; i++) {
        player.hand.push(this.drawCardFromDeck());
      }
    }

    // Flip the first card (cannot be wild4 on first turn)
    let firstCard = this.drawCardFromDeck();
    while (firstCard.type === 'wild4') {
      this.deck.push(firstCard);
      this.deck = shuffle(this.deck);
      firstCard = this.drawCardFromDeck();
    }

    this.discardPile.push(firstCard);
    this.activeColor = firstCard.color === 'wild' ? COLORS[Math.floor(Math.random() * COLORS.length)] : firstCard.color;

    // Handle initial action card effect if any
    let initialActionText = `Oyun başladı! İlk kart: ${this.getCardName(firstCard)}`;
    if (firstCard.type === 'skip') {
      initialActionText += ` - ${this.getCurrentPlayer().name} pas geçti!`;
      this.advanceTurn();
    } else if (firstCard.type === 'reverse') {
      if (this.players.length === 2) {
        // In 2 player, reverse acts like skip
        initialActionText += ` - 2 Kişilik oyunda sıra atlandı!`;
        this.advanceTurn();
      } else {
        this.direction *= -1;
        initialActionText += ` - Oyun yönü değişti!`;
      }
    } else if (firstCard.type === 'draw2') {
      if (this.options.allowStacking) {
        this.pendingPenalty = 2;
        initialActionText += ` - Ceza: +2 kart birikti!`;
      } else {
        const target = this.getCurrentPlayer();
        target.hand.push(this.drawCardFromDeck(), this.drawCardFromDeck());
        initialActionText += ` - ${target.name} 2 kart çekti ve sırası geçti!`;
        this.advanceTurn();
      }
    }

    this.lastAction = {
      type: 'game_start',
      text: initialActionText,
      card: firstCard
    };

    return this.getState();
  }

  /**
   * Helper to draw a single card from deck (reshuffles discard pile if needed)
   */
  drawCardFromDeck() {
    if (this.deck.length === 0) {
      if (this.discardPile.length <= 1) {
        // Generate fresh deck without duplicates
        const fresh = shuffle(createDeck());
        this.deck = fresh.filter(c => !this.discardPile.some(dp => dp.id === c.id));
      } else {
        // Keep top card, shuffle rest
        const topCard = this.discardPile.pop();
        this.deck = shuffle(this.discardPile);
        this.discardPile = [topCard];
      }
    }
    return this.deck.pop();
  }

  getCurrentPlayer() {
    return this.players[this.currentTurnIndex];
  }

  getNextPlayerIndex(offset = 1) {
    const len = this.players.length;
    let nextIdx = (this.currentTurnIndex + (this.direction * offset)) % len;
    if (nextIdx < 0) nextIdx += len;
    return nextIdx;
  }

  getNextPlayer(offset = 1) {
    return this.players[this.getNextPlayerIndex(offset)];
  }

  advanceTurn(skipCount = 0) {
    this.hasDrawnThisTurn = false;
    this.drawnCardId = null;
    const len = this.players.length;
    const step = 1 + skipCount;
    this.currentTurnIndex = (this.currentTurnIndex + (this.direction * step)) % len;
    if (this.currentTurnIndex < 0) {
      this.currentTurnIndex += len;
    }
  }

  getTopCard() {
    return this.discardPile[this.discardPile.length - 1];
  }

  /**
   * Player shouts UNO
   */
  shoutUno(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;

    // Can shout if currently has 1 or 2 cards
    if (player.hand.length <= 2) {
      player.hasShoutedUno = true;
      player.stats.unoShouts++;

      if (this.unoVulnerablePlayerId === playerId) {
        this.unoVulnerablePlayerId = null;
        if (this.unoGraceTimeout) clearTimeout(this.unoGraceTimeout);
      }

      this.lastAction = {
        type: 'uno_shout',
        player: player.name,
        text: `🔥 ${player.name} "UNO!" diye bağırdı!`
      };
      return true;
    }
    return false;
  }

  /**
   * Catch someone who forgot to shout UNO
   */
  catchUno(callerId) {
    const caller = this.players.find(p => p.id === callerId);
    if (!caller || !this.unoVulnerablePlayerId) return false;

    const vulnerablePlayer = this.players.find(p => p.id === this.unoVulnerablePlayerId);
    if (!vulnerablePlayer || vulnerablePlayer.hand.length !== 1 || vulnerablePlayer.hasShoutedUno) {
      return false;
    }

    // Give 2 penalty cards
    const penaltyCard1 = this.drawCardFromDeck();
    const penaltyCard2 = this.drawCardFromDeck();
    vulnerablePlayer.hand.push(penaltyCard1, penaltyCard2);
    vulnerablePlayer.stats.cardsDrawn += 2;

    this.unoVulnerablePlayerId = null;
    if (this.unoGraceTimeout) clearTimeout(this.unoGraceTimeout);

    this.lastAction = {
      type: 'uno_caught',
      caller: caller.name,
      victim: vulnerablePlayer.name,
      player: caller.name,
      text: `⚡ ${caller.name}, ${vulnerablePlayer.name}'ı yakaladı! ${vulnerablePlayer.name} 2 ceza kartı çekti!`
    };

    return true;
  }

  /**
   * Player plays a card
   */
  playCard(playerId, cardId, chosenColor = null) {
    if (this.status !== 'playing') {
      return { success: false, error: 'Oyun aktif değil.' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      return { success: false, error: 'Sıra sende değil!' };
    }

    // If player already drew a card this turn, only that drawn card can be played
    if (this.hasDrawnThisTurn && cardId !== this.drawnCardId) {
      return { success: false, error: 'Kart çektiğiniz için sadece yeni çektiğiniz kartı oynayabilir veya pas geçebilirsiniz!' };
    }

    const cardIndex = currentPlayer.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return { success: false, error: 'Kart elinde bulunamadı!' };
    }

    const card = currentPlayer.hand[cardIndex];
    const topCard = this.getTopCard();

    // Check validity
    const valid = isValidMove(card, topCard, this.activeColor, this.options, this.pendingPenalty);
    if (!valid) {
      return { success: false, error: 'Bu kartı oynayamazsın!' };
    }

    // If wild card, chosen color must be provided
    if (card.color === 'wild' || card.type === 'wild' || card.type === 'wild4') {
      if (!chosenColor || !COLORS.includes(chosenColor)) {
        return { success: false, error: 'Lütfen bir renk seçin (Kırmızı, Mavi, Yeşil, Sarı)!' };
      }
    }

    // Remove from player hand & add to discard pile
    currentPlayer.hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    currentPlayer.stats.cardsPlayed++;

    // Update active color
    if (card.color === 'wild') {
      this.activeColor = chosenColor;
    } else {
      this.activeColor = card.color;
    }

    // UNO check for this player
    if (currentPlayer.hand.length === 1) {
      if (!currentPlayer.hasShoutedUno) {
        // Player is vulnerable to being caught for 4.5 seconds
        this.unoVulnerablePlayerId = currentPlayer.id;
        if (this.unoGraceTimeout) clearTimeout(this.unoGraceTimeout);
        this.unoGraceTimeout = setTimeout(() => {
          this.unoVulnerablePlayerId = null;
          if (this.onStateChange) this.onStateChange('uno_grace_expired');
        }, 4500);
      }
    } else {
      currentPlayer.hasShoutedUno = false;
    }

    // Check Win Condition
    if (currentPlayer.hand.length === 0) {
      this.status = 'round_end';
      this.winner = {
        id: currentPlayer.id,
        name: currentPlayer.name,
        avatar: currentPlayer.avatar,
        color: currentPlayer.color
      };
      this.lastAction = {
        type: 'game_won',
        player: currentPlayer.name,
        text: `🏆 TEBRİKLER! ${currentPlayer.name} oyunu KAZANDI! 🎉`,
        card
      };
      return { success: true, won: true, state: this.getState() };
    }

    // Handle Card Effects
    let actionText = `${currentPlayer.name}, ${this.getCardName(card)} oynadı.`;
    let skipCount = 0;

    if (card.type === 'skip') {
      const skippedPlayer = this.getNextPlayer(1);
      skipCount = 1;
      actionText += ` ⛔ ${skippedPlayer.name} sırasını kaybetti!`;
    } else if (card.type === 'reverse') {
      if (this.players.length === 2) {
        // 2 players: reverse behaves as skip
        skipCount = 1;
        actionText += ` 🔄 Sıra tekrar ${currentPlayer.name}'e geçti!`;
      } else {
        this.direction *= -1;
        actionText += ` 🔄 Oyunun yönü tersine döndü!`;
      }
    } else if (card.type === 'draw2') {
      if (this.options.allowStacking) {
        this.pendingPenalty += 2;
        actionText += ` 💥 Ceza +2 arttı (Toplam ceza: +${this.pendingPenalty})!`;
      } else {
        const nextPlayer = this.getNextPlayer(1);
        nextPlayer.hand.push(this.drawCardFromDeck(), this.drawCardFromDeck());
        nextPlayer.stats.cardsDrawn += 2;
        skipCount = 1;
        actionText += ` 💥 ${nextPlayer.name} 2 kart çekti ve sırası geçti!`;
      }
    } else if (card.type === 'wild4') {
      if (this.options.allowStacking) {
        this.pendingPenalty += 4;
        actionText += ` 🌈💥 Ceza +4 arttı (Toplam ceza: +${this.pendingPenalty})! Yeni renk: ${this.getColorName(this.activeColor)}`;
      } else {
        const nextPlayer = this.getNextPlayer(1);
        for (let i = 0; i < 4; i++) {
          nextPlayer.hand.push(this.drawCardFromDeck());
        }
        nextPlayer.stats.cardsDrawn += 4;
        skipCount = 1;
        actionText += ` 🌈💥 ${nextPlayer.name} 4 kart çekti ve sırası geçti! Yeni renk: ${this.getColorName(this.activeColor)}`;
      }
    } else if (card.type === 'wild') {
      actionText += ` 🌈 Yeni renk: ${this.getColorName(this.activeColor)}`;
    }

    this.lastAction = {
      type: 'play_card',
      player: currentPlayer.name,
      card,
      chosenColor,
      text: actionText
    };

    // Advance turn
    this.advanceTurn(skipCount);

    return { success: true, won: false, state: this.getState() };
  }

  /**
   * Player draws a card
   */
  drawCard(playerId) {
    if (this.status !== 'playing') {
      return { success: false, error: 'Oyun aktif değil.' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      return { success: false, error: 'Sıra sende değil!' };
    }

    // If there is an accumulated penalty (+2 or +4 stacking)
    if (this.pendingPenalty > 0) {
      const drawnCards = [];
      for (let i = 0; i < this.pendingPenalty; i++) {
        const c = this.drawCardFromDeck();
        currentPlayer.hand.push(c);
        drawnCards.push(c);
      }
      currentPlayer.stats.cardsDrawn += this.pendingPenalty;

      const penaltyCount = this.pendingPenalty;
      this.pendingPenalty = 0;

      this.lastAction = {
        type: 'draw_penalty',
        player: currentPlayer.name,
        count: penaltyCount,
        text: `📦 ${currentPlayer.name} biriken ${penaltyCount} ceza kartını çekti ve sırası geçti!`
      };

      this.advanceTurn();
      return { success: true, drawnCards, turnPassed: true, state: this.getState() };
    }

    // Normal draw
    if (this.hasDrawnThisTurn) {
      return { success: false, error: 'Bu turda zaten kart çektin! Oynayabilir veya pas geçebilirsin.' };
    }

    const card = this.drawCardFromDeck();
    currentPlayer.hand.push(card);
    currentPlayer.stats.cardsDrawn++;
    this.hasDrawnThisTurn = true;
    this.drawnCardId = card.id;

    // Check if the drawn card can be played
    const canPlayDrawn = isValidMove(card, this.getTopCard(), this.activeColor, this.options, this.pendingPenalty);

    this.lastAction = {
      type: 'draw_card',
      player: currentPlayer.name,
      text: `📥 ${currentPlayer.name} 1 kart çekti.`
    };

    return {
      success: true,
      card,
      canPlayDrawn,
      state: this.getState()
    };
  }

  /**
   * Player passes turn after drawing a card
   */
  passTurn(playerId) {
    if (this.status !== 'playing') {
      return { success: false, error: 'Oyun aktif değil.' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      return { success: false, error: 'Sıra sende değil!' };
    }

    if (!this.hasDrawnThisTurn) {
      return { success: false, error: 'Pas geçmeden önce kart çekmelisin!' };
    }

    this.lastAction = {
      type: 'pass_turn',
      player: currentPlayer.name,
      text: `⏭️ ${currentPlayer.name} pas geçti.`
    };

    this.advanceTurn();
    return { success: true, state: this.getState() };
  }

  /**
   * AI Bot Turn Logic
   */
  playBotTurn(callback) {
    if (this.status !== 'playing') return;

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer || !currentPlayer.isBot) return;

    // Simulate thinking delay (1200ms - 1800ms)
    clearTimeout(this.botTimer);
    this.botTimer = setTimeout(() => {
      if (this.status !== 'playing') return;
      const bot = this.getCurrentPlayer();
      if (!bot || !bot.isBot) return;

      // Uno shout check for bot
      if (bot.hand.length === 2) {
        if (Math.random() < 0.92) {
          this.shoutUno(bot.id);
          if (callback) callback({ type: 'bot_uno', action: this.lastAction });
        }
      }

      // Check if vulnerable human player can be caught by bot
      if (this.unoVulnerablePlayerId && this.unoVulnerablePlayerId !== bot.id) {
        if (Math.random() < 0.75) {
          const caught = this.catchUno(bot.id);
          if (caught && callback) {
            callback({ type: 'bot_catch_uno', action: this.lastAction });
          }
        }
      }

      const topCard = this.getTopCard();

      // Find valid cards in hand
      const validCards = bot.hand.filter(c =>
        isValidMove(c, topCard, this.activeColor, this.options, this.pendingPenalty)
      );

      if (validCards.length > 0) {
        // AI Selection strategy:
        let selectedCard = null;

        if (this.pendingPenalty > 0) {
          selectedCard = validCards.find(c => c.type === 'draw2') || validCards.find(c => c.type === 'wild4');
        }

        if (!selectedCard) {
          // Play colored action card or matching number first
          const nonWild = validCards.filter(c => c.color !== 'wild');
          if (nonWild.length > 0) {
            selectedCard = nonWild.find(c => ['skip', 'reverse', 'draw2'].includes(c.type)) || nonWild[0];
          } else {
            selectedCard = validCards[0];
          }
        }

        // Determine best color if Wild
        let chosenColor = null;
        if (selectedCard.color === 'wild') {
          const colorCounts = { red: 0, blue: 0, green: 0, yellow: 0 };
          bot.hand.forEach(c => {
            if (c.color !== 'wild' && colorCounts[c.color] !== undefined) {
              colorCounts[c.color]++;
            }
          });
          chosenColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b);
        }

        const res = this.playCard(bot.id, selectedCard.id, chosenColor);
        if (callback) callback({ ...res, action: this.lastAction });
      } else {
        // Must draw card
        const drawRes = this.drawCard(bot.id);
        if (drawRes.success && !drawRes.turnPassed) {
          // Notify draw action
          if (callback) callback({ type: 'bot_draw', action: this.lastAction });

          // If drawn card is playable, play it immediately with 85% chance
          if (drawRes.canPlayDrawn && Math.random() < 0.85) {
            setTimeout(() => {
              let botChosenColor = null;
              if (drawRes.card.color === 'wild') {
                botChosenColor = COLORS[Math.floor(Math.random() * COLORS.length)];
              }
              const playRes = this.playCard(bot.id, drawRes.card.id, botChosenColor);
              if (callback) callback({ ...playRes, action: this.lastAction });
            }, 800);
          } else {
            // Pass turn
            setTimeout(() => {
              const passRes = this.passTurn(bot.id);
              if (callback) callback({ ...passRes, action: this.lastAction });
            }, 600);
          }
        } else {
          if (callback) callback({ ...drawRes, action: this.lastAction });
        }
      }
    }, 1300);
  }

  /**
   * Formatted card name for log/events
   */
  getCardName(card) {
    if (!card) return '';
    const colorName = this.getColorName(card.color);
    if (card.type === 'number') return `${colorName} ${card.value}`;
    if (card.type === 'skip') return `${colorName} Pas`;
    if (card.type === 'reverse') return `${colorName} Yön Değiştir`;
    if (card.type === 'draw2') return `${colorName} +2`;
    if (card.type === 'wild') return `Renk Değiştir (Joker)`;
    if (card.type === 'wild4') return `Joker +4`;
    return `${card.color} ${card.value}`;
  }

  getColorName(color) {
    const map = { red: 'Kırmızı', blue: 'Mavi', green: 'Yeşil', yellow: 'Sarı', wild: 'Joker' };
    return map[color] || color;
  }

  /**
   * Public state for TV and player views
   */
  getState() {
    const topCard = this.getTopCard();
    const currentPlayer = this.getCurrentPlayer();

    return {
      roomCode: this.roomCode,
      status: this.status,
      options: this.options,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        cardCount: p.hand.length,
        hasShoutedUno: p.hasShoutedUno,
        isBot: p.isBot,
        isConnected: p.isConnected,
        isCurrentTurn: currentPlayer ? currentPlayer.id === p.id : false
      })),
      topCard: topCard || null,
      activeColor: this.activeColor,
      currentTurnIndex: this.currentTurnIndex,
      currentTurnPlayerId: currentPlayer ? currentPlayer.id : null,
      direction: this.direction,
      pendingPenalty: this.pendingPenalty,
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      drawnCardId: this.drawnCardId,
      deckCount: this.deck.length,
      discardCount: this.discardPile.length,
      unoVulnerablePlayerId: this.unoVulnerablePlayerId,
      lastAction: this.lastAction,
      winner: this.winner
    };
  }

  /**
   * Secret player state with their actual card array
   */
  getPlayerState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    const publicState = this.getState();
    const topCard = this.getTopCard();

    // Mark each card as playable or not
    const isMyTurn = publicState.currentTurnPlayerId === playerId;
    const handWithPlayable = player.hand.map(card => {
      let isPlayable = isMyTurn && isValidMove(card, topCard, this.activeColor, this.options, this.pendingPenalty);
      // If player already drew a card this turn, only that drawn card can be played!
      if (this.hasDrawnThisTurn) {
        isPlayable = isPlayable && (card.id === this.drawnCardId);
      }
      return {
        ...card,
        isPlayable,
        isJustDrawn: card.id === this.drawnCardId
      };
    });

    return {
      ...publicState,
      myHand: handWithPlayable,
      myPlayerId: playerId,
      isMyTurn,
      hasShoutedUno: player.hasShoutedUno,
      canShoutUno: player.hand.length <= 2 && !player.hasShoutedUno,
      canCatchUno: !!this.unoVulnerablePlayerId && this.unoVulnerablePlayerId !== playerId
    };
  }
}

module.exports = UnoGame;
