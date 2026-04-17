require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const uploadRoute = require('./routes/upload');
const roomManager = require('./game/RoomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use('/api', uploadRoute);
app.get('/health', (_, res) => res.json({ ok: true }));

// ─── Socket.io イベントハンドラ ────────────────────────────

io.on('connection', (socket) => {
  console.log(`接続: ${socket.id}`);

  socket.on('create_room', ({ roomCode, nickname, deck }) => {
    if (!roomCode || !nickname) return;
    const result = roomManager.createRoom(roomCode.trim(), socket.id, nickname.trim());
    if (!result.ok) {
      socket.emit('room_error', { message: result.error });
      return;
    }
    const room = result.room;
    socket.join(roomCode);
    socket.deck = deck || [];
    socket.emit('room_joined', { isHost: true, lobbyState: room.getLobbyState() });
  });

  socket.on('join_room', ({ roomCode, nickname, deck }) => {
    if (!roomCode || !nickname) return;
    const result = roomManager.joinRoom(roomCode.trim(), socket.id, nickname.trim());
    if (!result.ok) {
      socket.emit('room_error', { message: result.error });
      return;
    }
    const room = result.room;
    socket.join(roomCode);
    socket.deck = deck || [];
    // 3人以上になったら1v1モードを自動でバトルロワイヤルに切り替え
    if (room.players.size >= 3 && room.mode === '1v1') {
      room.setMode('battle_royale');
    }
    socket.emit('room_joined', { isHost: false, lobbyState: room.getLobbyState() });
    socket.to(roomCode).emit('lobby_update', { lobbyState: room.getLobbyState() });
  });

  socket.on('set_mode', ({ mode }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room || room.hostId !== socket.id) return;
    room.setMode(mode);
    io.to(room.roomCode).emit('lobby_update', { lobbyState: room.getLobbyState() });
  });

  socket.on('start_game', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room || room.hostId !== socket.id || room.status !== 'waiting') return;
    if (room.players.size < 2) {
      socket.emit('room_error', { message: '2人以上必要です' });
      return;
    }
    // 全プレイヤーのデッキ枚数チェック（5〜15枚）
    const MIN_DECK = 5;
    const MAX_DECK = 15;
    for (const id of room.joinOrder) {
      const ps = io.sockets.sockets.get(id);
      const deckLen = ps?.deck?.length ?? 0;
      const p = room.players.get(id);
      const name = p?.nickname || 'プレイヤー';
      if (deckLen < MIN_DECK) {
        socket.emit('room_error', { message: `${name} のデッキが${MIN_DECK}枚未満です` });
        return;
      }
      if (deckLen > MAX_DECK) {
        socket.emit('room_error', { message: `${name} のデッキが${MAX_DECK}枚を超えています` });
        return;
      }
    }
    const playerDecks = new Map();
    room.joinOrder.forEach(id => {
      const playerSocket = io.sockets.sockets.get(id);
      playerDecks.set(id, playerSocket?.deck || []);
    });
    room.startGame(io, playerDecks);
  });

  socket.on('play_card', ({ cardInstanceId, targetId, useDoubleAttack }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (room) room.handlePlayCard(socket.id, cardInstanceId, targetId, useDoubleAttack);
  });

  socket.on('pass_turn', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (room) room.handlePassTurn(socket.id);
  });

  socket.on('reflect_response', ({ doReflect }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (room) room.handleReflectResponse(socket.id, doReflect);
  });

  socket.on('defense_response', ({ doDefend }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (room) room.handleDefenseResponse(socket.id, doDefend);
  });

  socket.on('heal_target_select', ({ targetId }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (room) room.handleHealTargetSelect(socket.id, targetId);
  });

  socket.on('select_team', ({ team }) => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (!room) return;
    room.handleTeamSelect(socket.id, team);
    io.to(room.roomCode).emit('lobby_update', { lobbyState: room.getLobbyState() });
  });

  socket.on('rematch_vote', () => {
    const room = roomManager.getRoomBySocketId(socket.id);
    if (room) room.handleRematchVote(socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`切断: ${socket.id}`);
    const room = roomManager.removePlayerFromRoom(socket.id);
    if (room && room.players.size > 0) {
      io.to(room.roomCode).emit('lobby_update', { lobbyState: room.getLobbyState() });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`サーバー起動: http://localhost:${PORT}`));
