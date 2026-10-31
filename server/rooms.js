const UnoGame = require('./gameEngine');

class RoomManager {
  constructor() {
    this.rooms = new Map();
    // Maps socket ID to { roomCode, role: 'host' | 'player', playerId }
    this.socketMap = new Map();
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid 0, O, 1, I for readability on TV
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(customCode = null, options = {}) {
    const code = (customCode || this.generateRoomCode()).toUpperCase();
    const game = new UnoGame(code, options);
    const room = {
      code,
      game,
      hostSocketId: null,
      createdAt: Date.now()
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    if (!code) return null;
    return this.rooms.get(code.toUpperCase());
  }

  setHostSocket(code, socketId) {
    const room = this.getRoom(code);
    if (!room) return false;
    room.hostSocketId = socketId;
    this.socketMap.set(socketId, { roomCode: room.code, role: 'host' });
    return true;
  }

  registerPlayerSocket(code, playerId, socketId) {
    const room = this.getRoom(code);
    if (!room) return false;
    this.socketMap.set(socketId, { roomCode: room.code, role: 'player', playerId });
    return true;
  }

  getSocketInfo(socketId) {
    return this.socketMap.get(socketId);
  }

  removeSocket(socketId) {
    const info = this.socketMap.get(socketId);
    if (!info) return null;
    this.socketMap.delete(socketId);
    return info;
  }

  /**
   * Add a bot to the specified room
   */
  addBot(code) {
    const room = this.getRoom(code);
    if (!room) return null;

    const botNames = ['Zeki Bot', 'Hızlı Bot', 'Usta Bot', 'Çılgın Bot', 'Şanslı Bot', 'Gizemli Bot'];
    const botAvatars = ['🤖', '👾', '🚀', '🦊', '🦁', '🦉'];
    const botColors = ['#ff3b30', '#0984e3', '#00b894', '#fdcb6e', '#a29bfe', '#fd79a8'];

    const existingBotCount = room.game.players.filter(p => p.isBot).length;
    const nameIndex = existingBotCount % botNames.length;

    const bot = room.game.addPlayer({
      id: `bot_${Math.random().toString(36).substring(2, 9)}`,
      name: botNames[nameIndex],
      avatar: botAvatars[nameIndex],
      color: botColors[nameIndex],
      isBot: true
    });

    return bot.player;
  }

  /**
   * Remove a bot from the specified room
   */
  removeBot(code) {
    const room = this.getRoom(code);
    if (!room) return false;

    const botIndex = room.game.players.findLastIndex(p => p.isBot);
    if (botIndex !== -1) {
      const bot = room.game.players[botIndex];
      return room.game.removePlayer(bot.id);
    }
    return false;
  }
}

module.exports = new RoomManager();
