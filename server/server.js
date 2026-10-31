const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');
const roomManager = require('./rooms');

// Global error logging for cloud platforms
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Trust proxy for reverse proxies (Render, Cloudflare, Railway, Fly, Heroku, etc.)
app.set('trust proxy', true);

const PORT = process.env.PORT || 3000;

// Determine local IPv4 network address safely
function getLocalIpAddress() {
  try {
    const interfaces = os.networkInterfaces() || {};
    for (const name of Object.keys(interfaces)) {
      const list = interfaces[name] || [];
      for (const net of list) {
        if (net && net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (e) {
    console.warn('Network interface check failed, defaulting to localhost:', e.message);
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// Determine effective public / base URL
function getBaseUrl(req = null, clientOrigin = null) {
  if (clientOrigin && typeof clientOrigin === 'string' && clientOrigin.startsWith('http')) {
    return clientOrigin.replace(/\/$/, '');
  }
  // Render.com automatically provides RENDER_EXTERNAL_URL
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  }
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/$/, '');
  }
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host) {
      return `${proto}://${host}`;
    }
  }
  return `http://${LOCAL_IP}:${PORT}`;
}

// Serve static assets
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// Health check endpoint for Render / monitoring
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// API: Local & Public Network Info
app.get('/api/network', (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.json({
    ip: LOCAL_IP,
    port: PORT,
    baseUrl: baseUrl,
    tvUrl: `${baseUrl}/tv`,
    playUrl: `${baseUrl}/play`
  });
});

// API: Generate QR Code data URL
app.get('/api/qr', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const text = req.query.text || `${baseUrl}/play`;
  try {
    const qrDataUrl = await QRCode.toDataURL(text, {
      width: 400,
      margin: 2,
      color: {
        dark: '#1e2022',
        light: '#ffffff'
      }
    });
    res.json({ qr: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'QR Kod oluşturulamadı' });
  }
});

// Explicit routes for easy access
app.get('/tv', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'tv.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'phone.html'));
});

// Broadcast game state to TV and each player
function syncGameState(roomCode) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const publicState = room.game.getState();

  // Send public state to TV host
  if (room.hostSocketId) {
    io.to(room.hostSocketId).emit('tv:state_update', publicState);
  }

  // Send private state with cards to each connected player
  for (const player of room.game.players) {
    if (!player.isBot && player.id) {
      const privateState = room.game.getPlayerState(player.id);
      io.to(player.id).emit('player:state_update', privateState);
    }
  }

  // Trigger bot if current turn is a bot
  if (publicState.status === 'playing') {
    const curPlayer = room.game.getCurrentPlayer();
    if (curPlayer && curPlayer.isBot) {
      room.game.playBotTurn((result) => {
        if (result && result.action) {
          io.to(`room_${roomCode}`).emit('game:action', result.action);
        }
        syncGameState(roomCode);
      });
    }
  }
}

// Socket.io Connection & Event Handling
io.on('connection', (socket) => {
  // --- TV HOST EVENTS ---
  socket.on('host:create_or_join', (data = {}) => {
    let roomCode = (data.roomCode || '').toUpperCase();
    let room = roomManager.getRoom(roomCode);

    if (!room) {
      room = roomManager.createRoom(roomCode || null, data.options || {});
      roomCode = room.code;
      // Setup state change callback for game events (e.g. grace period expiry)
      room.game.onStateChange = (trigger) => {
        if (trigger === 'player_timeout' && room.game.lastAction) {
          io.to(`room_${roomCode}`).emit('game:action', room.game.lastAction);
        }
        syncGameState(roomCode);
      };
    }

    roomManager.setHostSocket(roomCode, socket.id);
    socket.join(`room_${roomCode}`);

    // Dynamic base origin so QR code works on public website or local
    const baseOrigin = getBaseUrl(null, data.origin);
    const playUrl = `${baseOrigin}/play?room=${roomCode}`;

    QRCode.toDataURL(playUrl, { width: 320, margin: 2, color: { dark: '#111827', light: '#ffffff' } })
      .then(qr => {
        socket.emit('host:room_ready', {
          roomCode,
          playUrl,
          qrCode: qr,
          state: room.game.getState()
        });
      })
      .catch(() => {
        socket.emit('host:room_ready', {
          roomCode,
          playUrl,
          qrCode: null,
          state: room.game.getState()
        });
      });
  });

  socket.on('host:start_game', () => {
    const info = roomManager.getSocketInfo(socket.id);
    if (!info || info.role !== 'host') return;

    const room = roomManager.getRoom(info.roomCode);
    if (!room) return;

    try {
      room.game.startNewGame();
      io.to(`room_${info.roomCode}`).emit('game:action', {
        type: 'game_start',
        text: 'Oyun Başladı! Kartlar Dağıtıldı!'
      });
      syncGameState(info.roomCode);
    } catch (err) {
      socket.emit('host:error', { message: err.message });
    }
  });

  socket.on('host:add_bot', () => {
    const info = roomManager.getSocketInfo(socket.id);
    if (!info || info.role !== 'host') return;

    const bot = roomManager.addBot(info.roomCode);
    if (bot) {
      syncGameState(info.roomCode);
    }
  });

  socket.on('host:remove_bot', () => {
    const info = roomManager.getSocketInfo(socket.id);
    if (!info || info.role !== 'host') return;

    const removed = roomManager.removeBot(info.roomCode);
    if (removed) {
      syncGameState(info.roomCode);
    }
  });

  socket.on('host:update_options', (options) => {
    const info = roomManager.getSocketInfo(socket.id);
    if (!info || info.role !== 'host') return;

    const room = roomManager.getRoom(info.roomCode);
    if (!room) return;

    Object.assign(room.game.options, options);
    syncGameState(info.roomCode);
  });

  // --- MOBILE PHONE CONTROLLER EVENTS ---
  socket.on('player:join', (data) => {
    const roomCode = (data.roomCode || '').toUpperCase();
    const room = roomManager.getRoom(roomCode);

    if (!room) {
      return socket.emit('player:join_error', { message: 'Geçersiz oda kodu! TV ekranındaki kodu kontrol edin.' });
    }

    const { player, reconnected } = room.game.addPlayer({
      id: socket.id,
      name: data.name,
      avatar: data.avatar,
      color: data.color,
      token: data.token
    });

    roomManager.registerPlayerSocket(roomCode, socket.id, socket.id);
    socket.join(`room_${roomCode}`);

    socket.emit('player:joined_success', {
      player,
      roomCode,
      reconnected,
      state: room.game.getPlayerState(socket.id)
    });

    io.to(`room_${roomCode}`).emit('game:action', {
      type: 'player_joined',
      text: `${player.avatar} ${player.name} odaya katıldı!`,
      player: player.name
    });

    syncGameState(roomCode);
  });

  socket.on('player:play_card', ({ cardId, chosenColor }) => {
    const info = roomManager.getSocketInfo(socket.id);
    if (!info || info.role !== 'player') return;

    const room = roomManager.getRoom(info.roomCode);
    if (!room) return;

    const result = room.game.playCard(socket.id, cardId, chosenColor);
    if (!result.success) {
      return socket.emit('player:action_error', { message: result.error });
    }

    io.to(`room_${info.roomCode}`).emit('game:action', room.game.lastAction);
    syncGameState(info.roomCode);
  });

  socket.on('player:draw_card', () => {
    const info = roomManager.getSocketInfo(socket.id);
    if (!info || info.role !== 'player') return;

    const room = roomManager.getRoom(info.roomCode);
    if (!room) return;

    const result = room.game.drawCard(socket.id);
    if (!result.success) {
      return socket.emit('player:action_error', { message: result.error });
    }

    io.to(`room_${info.roomCode}`).emit('game:action', room.game.lastAction);
    syncGameState(info.roomCode);
  });

  socket.on('player:pass_turn', () => {
    const info = roomManager.getSocketInfo(socket.id);
    if (!info || info.role !== 'player') return;

    const room = roomManager.getRoom(info.roomCode);
    if (!room) return;

    const result = room.game.passTurn(socket.id);
    if (!result.success) {
      return socket.emit('player:action_error', { message: result.error });
    }

    io.to(`room_${info.roomCode}`).emit('game:action', room.game.lastAction);
    syncGameState(info.roomCode);
  });

  socket.on('player:shout_uno', () => {
    const info = roomManager.getSocketInfo(socket.id);
    if (!info || info.role !== 'player') return;

    const room = roomManager.getRoom(info.roomCode);
    if (!room) return;

    const success = room.game.shoutUno(socket.id);
    if (success) {
      io.to(`room_${info.roomCode}`).emit('game:action', room.game.lastAction);
      syncGameState(info.roomCode);
    } else {
      socket.emit('player:action_error', { message: 'UNO demek için elinde 1 veya 2 kart olmalı!' });
    }
  });

  socket.on('player:catch_uno', () => {
    const info = roomManager.getSocketInfo(socket.id);
    if (!info || info.role !== 'player') return;

    const room = roomManager.getRoom(info.roomCode);
    if (!room) return;

    const success = room.game.catchUno(socket.id);
    if (success) {
      io.to(`room_${info.roomCode}`).emit('game:action', room.game.lastAction);
      syncGameState(info.roomCode);
    } else {
      socket.emit('player:action_error', { message: 'Yakalayacak oyuncu kalmadı!' });
    }
  });

  socket.on('disconnect', () => {
    const info = roomManager.removeSocket(socket.id);
    if (!info) return;

    const room = roomManager.getRoom(info.roomCode);
    if (!room) return;

    if (info.role === 'player') {
      room.game.removePlayer(socket.id);
      syncGameState(info.roomCode);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const displayUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || `http://${LOCAL_IP}:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`🎉 TV UNO OYUN SUNUCUSU BAŞLATILDI! (Port: ${PORT})`);
  console.log(`📺 TV EKRANI:    ${displayUrl}/tv`);
  console.log(`📱 TELEFON GİRİŞ: ${displayUrl}/play`);
  console.log(`======================================================\n`);
});
