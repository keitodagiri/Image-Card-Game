import { useState, useEffect } from 'react';
import socket from '../socket';
import { loadDeck } from '../utils/deckStorage';
import { MODES } from '../utils/gameConstants';

export default function LobbyPage({ onBack, onBattleStart }) {
  const [step, setStep] = useState('form'); // 'form' | 'waiting'
  const [nickname, setNickname] = useState(() => localStorage.getItem('nickname') || '');
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem('roomCode') || '');
  const [isHost, setIsHost] = useState(false);
  const [lobbyState, setLobbyState] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    socket.connect();

    socket.on('room_joined', ({ isHost: host, lobbyState: ls }) => {
      setIsHost(host);
      setLobbyState(ls);
      setStep('waiting');
      setError('');
    });
    socket.on('lobby_update', ({ lobbyState: ls }) => setLobbyState(ls));
    socket.on('room_error', ({ message }) => setError(message));
    socket.on('game_started', ({ state }) => {
      onBattleStart({ state, myId: socket.id });
    });

    return () => {
      socket.off('room_joined');
      socket.off('lobby_update');
      socket.off('room_error');
      socket.off('game_started');
    };
  }, []);

  function handleCreate() {
    if (!validate()) return;
    if (!socket.connected) socket.connect();
    socket.emit('create_room', { roomCode: roomCode.trim(), nickname: nickname.trim(), deck: loadDeck() });
  }

  function handleJoin() {
    if (!validate()) return;
    if (!socket.connected) socket.connect();
    socket.emit('join_room', { roomCode: roomCode.trim(), nickname: nickname.trim(), deck: loadDeck() });
  }

  function validate() {
    if (!nickname.trim()) { setError('ニックネームを入力してください'); return false; }
    if (!roomCode.trim())  { setError('合言葉を入力してください'); return false; }
    if (loadDeck().length < 1) { setError('先にデッキを作成してください'); return false; }
    localStorage.setItem('nickname', nickname.trim());
    localStorage.setItem('roomCode', roomCode.trim());
    setError('');
    return true;
  }

  function handleModeChange(mode) {
    if (!isHost) return;
    socket.emit('set_mode', { mode });
  }

  function handleLeave() {
    socket.disconnect();
    setStep('form');
    setLobbyState(null);
    setError('');
  }

  if (step === 'waiting' && lobbyState) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn btn-ghost" onClick={handleLeave}>← 退室</button>
          <h2>🚪 ルーム: {lobbyState.roomCode}</h2>
        </div>

        <div className="lobby-content">
          <div className="panel">
            <h3 style={{ marginBottom: 10 }}>参加者 ({lobbyState.players.length}人)</h3>
            <div className="player-list">
              {lobbyState.players.map(p => (
                <div key={p.id} className="player-item">
                  {p.id === lobbyState.hostId && <span className="host-badge">HOST</span>}
                  <span>{p.nickname}</span>
                  {p.id === socket.id && <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 'auto' }}>あなた</span>}
                </div>
              ))}
            </div>
          </div>

          {lobbyState.mode === 'team' && (
            <div className="panel">
              <h3 style={{ marginBottom: 10 }}>チーム選択</h3>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#3498db', marginBottom: 6 }}>チーム1</div>
                  {lobbyState.players.filter(p => p.lobbyTeam === 0).map(p => (
                    <div key={p.id} style={{ fontSize: 13, padding: '4px 0' }}>
                      {p.id === lobbyState.hostId && <span className="host-badge">HOST</span>}
                      {p.nickname}{p.id === socket.id && <span style={{ color: 'var(--accent)', fontSize: 11 }}> (あなた)</span>}
                    </div>
                  ))}
                  {lobbyState.players.filter(p => p.lobbyTeam === 0).length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>なし</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e74c3c', marginBottom: 6 }}>チーム2</div>
                  {lobbyState.players.filter(p => p.lobbyTeam === 1).map(p => (
                    <div key={p.id} style={{ fontSize: 13, padding: '4px 0' }}>
                      {p.id === lobbyState.hostId && <span className="host-badge">HOST</span>}
                      {p.nickname}{p.id === socket.id && <span style={{ color: 'var(--accent)', fontSize: 11 }}> (あなた)</span>}
                    </div>
                  ))}
                  {lobbyState.players.filter(p => p.lobbyTeam === 1).length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>なし</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${lobbyState.players.find(p => p.id === socket.id)?.lobbyTeam === 0 ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => socket.emit('select_team', { team: 0 })}
                >
                  チーム1に参加
                </button>
                <button
                  className={`btn ${lobbyState.players.find(p => p.id === socket.id)?.lobbyTeam === 1 ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => socket.emit('select_team', { team: 1 })}
                >
                  チーム2に参加
                </button>
              </div>
            </div>
          )}

          <div className="panel">
            <h3 style={{ marginBottom: 10 }}>対戦モード {!isHost && <span style={{ fontSize: 11, color: 'var(--muted)' }}>(ホストが選択)</span>}</h3>
            <div className="mode-selector">
              {MODES.filter(m => {
                if (lobbyState.players.length < 3) return m.id === '1v1';
                return m.id !== '1v1';
              }).map(m => (
                <div
                  key={m.id}
                  className={`mode-option ${lobbyState.mode === m.id ? 'selected' : ''}`}
                  onClick={() => isHost && handleModeChange(m.id)}
                  style={{ cursor: isHost ? 'pointer' : 'default', opacity: isHost ? 1 : 0.6 }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          {isHost
            ? <button className="btn btn-primary btn-large" onClick={() => socket.emit('start_game')} disabled={lobbyState.players.length < 2}>
                ▶ 対戦開始
              </button>
            : <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ホストが開始するまで待機中...</p>
          }
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack}>← 戻る</button>
        <h2>🚪 ロビー</h2>
      </div>

      <div className="lobby-content">
        <div className="panel card-form">
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>ニックネーム</label>
            <input type="text" placeholder="例: さくら" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={16} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>合言葉</label>
            <input
              type="text"
              placeholder="例: battle123"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value)}
              maxLength={32}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate}>＋ ルームを作る</button>
            <button className="btn btn-success" style={{ flex: 1 }} onClick={handleJoin}>→ ルームに入る</button>
          </div>

          <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
            ※ 入室前にデッキを作成してください
          </p>
        </div>
      </div>
    </div>
  );
}
