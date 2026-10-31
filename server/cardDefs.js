// Definition of Uno Cards and Helper Functions

const COLORS = ['red', 'blue', 'green', 'yellow'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTIONS = ['skip', 'reverse', 'draw2'];
const WILDS = ['wild', 'wild4'];

// Color hex codes and display names
const COLOR_META = {
  red: { name: 'Kırmızı', hex: '#ef233c', glow: 'rgba(239, 35, 60, 0.6)' },
  blue: { name: 'Mavi', hex: '#0984e3', glow: 'rgba(9, 132, 227, 0.6)' },
  green: { name: 'Yeşil', hex: '#00b894', glow: 'rgba(0, 184, 148, 0.6)' },
  yellow: { name: 'Sarı', hex: '#fdcb6e', glow: 'rgba(253, 203, 110, 0.6)' },
  wild: { name: 'Joker', hex: '#2d3436', glow: 'rgba(255, 255, 255, 0.5)' }
};

/**
 * Creates a standard 108-card UNO deck
 */
function createDeck() {
  const deck = [];
  let cardId = 1;

  for (const color of COLORS) {
    // One 0 card per color
    deck.push({
      id: `c_${cardId++}`,
      color: color,
      type: 'number',
      value: 0
    });

    // Two of 1-9 per color
    for (let num = 1; num <= 9; num++) {
      deck.push({ id: `c_${cardId++}`, color, type: 'number', value: num });
      deck.push({ id: `c_${cardId++}`, color, type: 'number', value: num });
    }

    // Two of each action card per color (Skip, Reverse, Draw 2)
    for (const action of ACTIONS) {
      deck.push({ id: `c_${cardId++}`, color, type: action, value: action });
      deck.push({ id: `c_${cardId++}`, color, type: action, value: action });
    }
  }

  // Four Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `c_${cardId++}`,
      color: 'wild',
      type: 'wild',
      value: 'wild'
    });
  }

  // Four Wild Draw 4 cards
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `c_${cardId++}`,
      color: 'wild',
      type: 'wild4',
      value: 'wild4'
    });
  }

  return deck;
}

/**
 * Fisher-Yates array shuffle
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Validates if cardToPlay can be placed on top of topCard
 * @param {Object} cardToPlay
 * @param {Object} topCard
 * @param {String} activeColor - color currently in play (could be chosen by wild card)
 * @param {Object} options - rule options, like stacking
 * @param {Number} pendingPenalty - if there is active stacked draw (+2/+4)
 */
function isValidMove(cardToPlay, topCard, activeColor, options = {}, pendingPenalty = 0) {
  if (!cardToPlay || !topCard) return false;

  // If there is an active draw penalty (e.g. Someone played +2 and stacking is enabled)
  if (pendingPenalty > 0) {
    if (options.allowStacking) {
      // If penalty came from draw2, player can stack another draw2 or wild4
      if (topCard.type === 'draw2') {
        return cardToPlay.type === 'draw2' || (options.allowWild4OnDraw2 && cardToPlay.type === 'wild4');
      }
      // If penalty came from wild4, player can stack wild4
      if (topCard.type === 'wild4') {
        return cardToPlay.type === 'wild4';
      }
    }
    // If not stacking, player must draw penalty cards, cannot play normal card
    return false;
  }

  // Wild cards can always be played
  if (cardToPlay.color === 'wild' || cardToPlay.type === 'wild' || cardToPlay.type === 'wild4') {
    return true;
  }

  const effectiveColor = activeColor || topCard.color;

  // Color matches
  if (cardToPlay.color === effectiveColor) {
    return true;
  }

  // Type & Value match (e.g. Green 5 on Red 5, or Green Skip on Blue Skip)
  if (cardToPlay.type === 'number' && topCard.type === 'number' && cardToPlay.value === topCard.value) {
    return true;
  }

  if (cardToPlay.type !== 'number' && cardToPlay.type === topCard.type) {
    return true;
  }

  return false;
}

module.exports = {
  COLORS,
  NUMBERS,
  ACTIONS,
  WILDS,
  COLOR_META,
  createDeck,
  shuffle,
  isValidMove
};
