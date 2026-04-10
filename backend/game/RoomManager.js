const GameRoom = require('./GameRoom');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode → GameRoom
  }

  createRoom(roomCode, hostId, hostNickname) {
    if (this.rooms.has(roomCode)) {
      return { ok: false, error: 'その合言葉のルームは既に存在します' };
    }
    const room = new GameRoom(roomCode, hostId, hostNickname);
    this.rooms.set(roomCode, room);
    return { ok: true, room };
  }

  joinRoom(roomCode, socketId, nickname) {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'その合言葉のルームが見つかりません' };
    if (room.status === 'playing') return { ok: false, error: '対戦中のため入室できません' };
    const result = room.addPlayer(socketId, nickname);
    if (!result.ok) return result;
    return { ok: true, room };
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode) || null;
  }

  getRoomBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) return room;
    }
    return null;
  }

  deleteRoom(roomCode) {
    if (this.rooms.has(roomCode)) {
      this.rooms.delete(roomCode);
      console.log(`部屋削除: ${roomCode}`);
    }
  }

  removePlayerFromRoom(socketId) {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return null;
    room.removePlayer(socketId);
    if (room.players.size === 0) {
      this.rooms.delete(room.roomCode);
    }
    return room;
  }
}

module.exports = new RoomManager(); // シングルトン
