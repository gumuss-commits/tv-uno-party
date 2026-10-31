/**
 * TV UNO - Card Rendering Engine
 * Generates beautiful, responsive Uno Card DOM elements with vector graphics
 */

const CardRenderer = {
  // SVG Icons
  ICONS: {
    skip: (isLarge = false) => `
      <svg class="card-icon-svg ${isLarge ? 'large' : ''}" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3"/>
        <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" stroke="currentColor" stroke-width="3"/>
      </svg>
    `,
    reverse: (isLarge = false) => `
      <svg class="card-icon-svg ${isLarge ? 'large' : ''}" viewBox="0 0 24 24">
        <path d="M7 6l-4 4 4 4V11h10a3 3 0 0 1 3 3v1h2v-1a5 5 0 0 0-5-5H7V6z" fill="currentColor"/>
        <path d="M17 18l4-4-4-4v3H7a3 3 0 0 1-3-3v-1H2v1a5 5 0 0 0 5 5h10v3z" fill="currentColor"/>
      </svg>
    `,
    draw2: (isLarge = false) => `
      <span style="font-weight:900; letter-spacing:-1px;">+2</span>
    `,
    draw4: (isLarge = false) => `
      <span style="font-weight:900; letter-spacing:-2px; text-shadow: 2px 2px 0 #000;">+4</span>
    `
  },

  /**
   * Creates an HTML Card element
   * @param {Object} card { id, color, type, value, isPlayable }
   * @param {Object} options { size: 'lg'|'sm'|'normal', faceDown: boolean, playable: boolean, interactive: boolean }
   */
  createCardElement(card, options = {}) {
    const el = document.createElement('div');
    el.className = 'uno-card';
    if (card && card.id) el.dataset.cardId = card.id;

    // Sizing
    if (options.size === 'lg') el.classList.add('card-lg');
    if (options.size === 'sm') el.classList.add('card-sm');

    // Face down card back
    if (options.faceDown || !card) {
      el.classList.add('card-back');
      el.innerHTML = `
        <div class="card-oval">
          <span class="uno-logo-text">UNO</span>
        </div>
      `;
      return el;
    }

    // Color variant
    const colorClass = `color-${card.color}`;
    el.classList.add(colorClass);

    // Playable / Disabled
    if (card.isPlayable || options.playable) {
      el.classList.add('playable');
    } else if (options.interactive && card.isPlayable === false) {
      el.classList.add('disabled');
    }

    // Corner and Center content
    let cornerContent = '';
    let centerContent = '';

    if (card.type === 'number') {
      cornerContent = `<span>${card.value}</span>`;
      centerContent = `<span class="card-center-symbol">${card.value}</span>`;
    } else if (card.type === 'skip') {
      cornerContent = this.ICONS.skip(false);
      centerContent = `<div class="card-center-symbol" style="transform: rotate(28deg);">${this.ICONS.skip(true)}</div>`;
    } else if (card.type === 'reverse') {
      cornerContent = this.ICONS.reverse(false);
      centerContent = `<div class="card-center-symbol" style="transform: rotate(28deg);">${this.ICONS.reverse(true)}</div>`;
    } else if (card.type === 'draw2') {
      cornerContent = `<span>+2</span>`;
      centerContent = `<span class="card-center-symbol" style="font-size: 58px;">+2</span>`;
    } else if (card.type === 'wild') {
      cornerContent = `<div style="font-size:12px; font-weight:900;">JOKER</div>`;
      centerContent = `
        <div class="card-center-symbol" style="transform: rotate(28deg);">
          <div class="wild-wheel">
            <div class="quadrant q-red"></div>
            <div class="quadrant q-blue"></div>
            <div class="quadrant q-green"></div>
            <div class="quadrant q-yellow"></div>
          </div>
        </div>
      `;
    } else if (card.type === 'wild4') {
      cornerContent = `<span>+4</span>`;
      centerContent = `
        <div class="card-center-symbol" style="transform: rotate(28deg); display:flex; flex-direction:column; align-items:center;">
          <div style="font-size: 52px; font-weight: 900; color: #fff; text-shadow: 0 3px 6px #000;">+4</div>
          <div style="display:flex; gap:3px; margin-top: -6px;">
            <div style="width:10px; height:15px; border-radius:2px; background:var(--uno-red); border:1px solid #fff;"></div>
            <div style="width:10px; height:15px; border-radius:2px; background:var(--uno-blue); border:1px solid #fff;"></div>
            <div style="width:10px; height:15px; border-radius:2px; background:var(--uno-green); border:1px solid #fff;"></div>
            <div style="width:10px; height:15px; border-radius:2px; background:var(--uno-yellow); border:1px solid #fff;"></div>
          </div>
        </div>
      `;
    }

    const justDrawnHtml = card.isJustDrawn ? `<div class="just-drawn-badge">YENİ!</div>` : '';

    el.innerHTML = `
      ${justDrawnHtml}
      <div class="corner top-left">${cornerContent}</div>
      <div class="card-oval">
        ${centerContent}
      </div>
      <div class="corner bottom-right">${cornerContent}</div>
    `;

    return el;
  }
};

window.CardRenderer = CardRenderer;
