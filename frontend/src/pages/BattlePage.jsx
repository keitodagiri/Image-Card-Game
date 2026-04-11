import { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { EFFECT_MAP, ATTRIBUTES, CATEGORY_COLORS } from '../utils/gameConstants';

const ATTR_LABEL = Object.fromEntries(ATTRIBUTES.map(a => [a.id, a.label]));
const PLAYABLE = new Set(['explosion', 'poison', 'paralysis', 'heal', 'invincible', 'absolute_defense']);

// エフェクト設定
const EFFECT_CONFIG = {
  explosion: {
    fire:  { emoji: '🔥', label: '攻撃', bg: 'linear-gradient(135deg,#ff6b35,#f7c948)', color: '#000', glow: '#ff6b35' },
    water: { emoji: '💧', label: '攻撃', bg: 'linear-gradient(135deg,#2196f3,#00e5ff)', color: '#000', glow: '#2196f3' },
    grass: { emoji: '🌿', label: '攻撃', bg: 'linear-gradient(135deg,#00e676,#76ff03)', color: '#000', glow: '#00e676' },
    dark:  { emoji: '🌑', label: '攻撃', bg: 'linear-gradient(135deg,#9c27b0,#4a148c)', color: '#fff', glow: '#9c27b0' },
    light: { emoji: '✨', label: '攻撃', bg: 'linear-gradient(135deg,#ffd600,#fff9c4)', color: '#000', glow: '#ffd600' },
    default: { emoji: '💥', label: '攻撃', bg: 'linear-gradient(135deg,#e94560,#ff6b8a)', color: '#fff', glow: '#e94560' },
  },
  invincible: { emoji: '⚡', label: '無敵技！', bg: 'linear-gradient(135deg,#ffd600,#ff6d00)', color: '#000', glow: '#ffd600' },
  poison:     { emoji: '☠️', label: '毒！', bg: 'linear-gradient(135deg,#9c27b0,#6a1b9a)', color: '#fff', glow: '#9c27b0' },
  poison_dot: { emoji: '☠️', label: '毒ダメージ', bg: 'linear-gradient(135deg,#7b1fa2,#4a148c)', color: '#fff', glow: '#7b1fa2' },
  paralysis:  { emoji: '⚡', label: '麻痺！', bg: 'linear-gradient(135deg,#ffd600,#ff9800)', color: '#000', glow: '#ffd600' },
  heal:             { emoji: '💚', label: '回復！',    bg: 'linear-gradient(135deg,#00e676,#1b5e20)', color: '#fff', glow: '#00e676' },
  absolute_defense:  { emoji: '🛡️', label: '絶対防御！', bg: 'linear-gradient(135deg,#1565c0,#0d47a1)', color: '#fff', glow: '#1e88e5' },
  explosion_reflect: { emoji: '🔄', label: '攻撃反射！', bg: 'linear-gradient(135deg,#e94560,#9c27b0)', color: '#fff', glow: '#e94560' },
  poison_reflect:    { emoji: '🔄', label: '毒反射！',   bg: 'linear-gradient(135deg,#9c27b0,#4a148c)', color: '#fff', glow: '#9c27b0' },
  paralysis_reflect: { emoji: '🔄', label: '麻痺反射！', bg: 'linear-gradient(135deg,#ffd600,#ff6d00)', color: '#000', glow: '#ffd600' },
  miss:              { emoji: '💨', label: 'ミス！',     bg: 'linear-gradient(135deg,#455a64,#263238)', color: '#fff', glow: '#607d8b' },
};

function getEffectConfig(type, attribute) {
  if (type === 'explosion') return EFFECT_CONFIG.explosion[attribute] || EFFECT_CONFIG.explosion.default;
  return EFFECT_CONFIG[type] || EFFECT_CONFIG.miss;
}

let effectCounter = 0;

function BattleEffectLayer({ effects }) {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200 }}>
      {effects.map(ef => {
        const cfg = getEffectConfig(ef.type, ef.attribute);
        return (
          <div key={ef.id} style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            animation: 'effectPop 2.8s ease forwards',
            background: `radial-gradient(ellipse at center, ${cfg.glow}33 0%, transparent 70%)`,
          }}>
            {/* アナウンステキスト */}
            {ef.announcement && (
              <div style={{
                fontSize: 'clamp(22px, 5vw, 40px)',
                fontWeight: 900,
                color: '#fff',
                textShadow: `0 0 24px ${cfg.glow}, 0 0 48px ${cfg.glow}`,
                animation: 'announcePop 2.8s ease forwards',
                textAlign: 'center',
                padding: '0 20px',
                letterSpacing: '0.04em',
              }}>
                {ef.announcement}
              </div>
            )}

            {/* カード画像・名前 */}
            {ef.card?.imageUrl && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                animation: 'cardRevealDelayed 2.8s ease forwards',
              }}>
                <img
                  src={ef.card.imageUrl}
                  alt=""
                  style={{
                    width: 'min(70vw, 340px)',
                    height: 'min(70vw, 340px)',
                    objectFit: 'cover',
                    borderRadius: 24,
                    border: `4px solid ${cfg.glow}`,
                    boxShadow: `0 0 60px ${cfg.glow}, 0 0 120px ${cfg.glow}88, 0 0 200px ${cfg.glow}44`,
                  }}
                />
                {ef.card.name && (
                  <div style={{
                    fontSize: 'clamp(20px, 5vw, 32px)',
                    fontWeight: 900,
                    color: '#fff',
                    textShadow: `0 0 24px ${cfg.glow}, 0 0 48px ${cfg.glow}`,
                    letterSpacing: '0.08em',
                  }}>
                    {ef.card.name}
                  </div>
                )}
              </div>
            )}

            {/* エフェクト情報 */}
            <div style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              background: cfg.bg,
              color: cfg.color,
              padding: '16px 40px',
              borderRadius: 20,
              boxShadow: `0 0 40px ${cfg.glow}, 0 0 80px ${cfg.glow}66`,
              fontWeight: 900,
              fontFamily: 'inherit',
              animation: ef.announcement ? 'cardRevealDelayed 2.8s ease forwards' : undefined,
            }}>
              <span style={{ fontSize: 48 }}>{cfg.emoji}</span>
              <span style={{ fontSize: 'clamp(18px, 4vw, 26px)', letterSpacing: '0.06em' }}>{cfg.label}</span>
              {ef.damage != null && (
                <span style={{ fontSize: 'clamp(36px, 8vw, 56px)', lineHeight: 1 }}>-{ef.damage}</span>
              )}
              {ef.amount != null && (
                <span style={{ fontSize: 'clamp(36px, 8vw, 56px)', lineHeight: 1 }}>+{ef.amount}</span>
              )}
              {ef.multiplier === 2 && (
                <span style={{ fontSize: 16, background: 'rgba(0,0,0,0.35)', padding: '4px 12px', borderRadius: 10 }}>属性有利 ×2!</span>
              )}
              {ef.multiplier === 0.5 && (
                <span style={{ fontSize: 16, background: 'rgba(0,0,0,0.35)', padding: '4px 12px', borderRadius: 10 }}>属性不利 ×0.5</span>
              )}
              {ef.hit === false && (
                <span style={{ fontSize: 16 }}>外れた！</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BattlePage({ initData, onExit }) {
  function handleExit() {
    socket.disconnect();
    onExit();
  }
  const { state: initState, myId } = initData;

  const [gameState, setGameState]       = useState(initState);
  const [myHand, setMyHand]             = useState([]);
  const [isMyTurn, setIsMyTurn]         = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [prompt, setPrompt]             = useState(null);
  const [battleLog, setBattleLog]       = useState([]);
  const [effects, setEffects]           = useState([]);
  const [timer, setTimer]               = useState(100);
  const [rematchVotes, setRematchVotes] = useState({ votes: 0, total: 0 });
  const [myRematchVoted, setMyRematchVoted] = useState(false);
  const [canPass, setCanPass] = useState(false);
  const logRef  = useRef();
  const timerRef = useRef();

  // ─── ソケットイベント ──────────────────────────────────────

  useEffect(() => {
    socket.on('hand_update', ({ hand }) => setMyHand(hand));

    socket.on('turn_start', ({ state, log, canPass: cp }) => {
      setGameState(state);
      if (log) addLog(log);
      setSelectedCard(null);
      setSelectedTarget(null);
      setIsMyTurn(false);
      setCanPass(cp || false);
      // タイムアウト等でサーバーが自動処理した場合、残っているプロンプトを閉じる
      setPrompt(prev =>
        prev && ['reflect', 'heal_target'].includes(prev.type) ? null : prev
      );
      clearInterval(timerRef.current);
    });

    socket.on('game_update', ({ state, log }) => {
      if (state) setGameState(state);
      if (log) addLog(log);
    });

    socket.on('your_turn', () => {
      setIsMyTurn(true);
    });

    socket.on('reflect_prompt', ({ effectType, attribute, attackerId, attackerNickname }) => {
      setPrompt({ type: 'reflect', effectType, attribute, attackerId, attackerNickname });
      startTimer(20);
    });

    socket.on('heal_target_prompt', ({ teammates }) => {
      setPrompt({ type: 'heal_target', teammates });
    });

    socket.on('game_over', ({ winnerId, winnerNickname, winnerTeam, log }) => {
      if (log) addLog(log);
      setIsMyTurn(false);
      setSelectedCard(null);
      setMyRematchVoted(false);
      setRematchVotes({ votes: 0, total: 0 });
      setPrompt({ type: 'game_over', winnerId, winnerNickname, winnerTeam, isMe: winnerId === myId });
    });

    socket.on('rematch_vote_update', ({ votes, total }) => {
      setRematchVotes({ votes, total });
    });

    socket.on('rematch_cancelled', ({ nickname }) => {
      setPrompt({ type: 'rematch_cancelled', nickname });
    });

    socket.on('game_started', ({ state }) => {
      setGameState(state);
      setMyHand([]);
      setBattleLog([]);
      setEffects([]);
      setPrompt(null);
      setIsMyTurn(false);
      setSelectedCard(null);
      setSelectedTarget(null);
      setMyRematchVoted(false);
      setRematchVotes({ votes: 0, total: 0 });
    });

    socket.on('battle_effect', (ef) => {
      const id = ++effectCounter;
      setEffects(prev => [...prev, { ...ef, id }]);
      setTimeout(() => setEffects(prev => prev.filter(e => e.id !== id)), 2800);
    });

    socket.on('player_disconnected', ({ nickname }) => {
      setIsMyTurn(false);
      setSelectedCard(null);
      setPrompt({ type: 'disconnected', nickname });
    });

    return () => {
      ['hand_update','turn_start','game_update','your_turn','reflect_prompt',
       'heal_target_prompt','game_over','battle_effect',
       'player_disconnected','rematch_vote_update','rematch_cancelled','game_started'].forEach(e => socket.off(e));
    };
  }, [myId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [battleLog]);

  function addLog(msg) {
    setBattleLog(prev => [...prev.slice(-80), msg]);
  }

  function startTimer(seconds) {
    setTimer(100);
    clearInterval(timerRef.current);
    let remaining = seconds;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimer(Math.round((remaining / seconds) * 100));
      if (remaining <= 0) clearInterval(timerRef.current);
    }, 1000);
  }

  // ─── アクション ────────────────────────────────────────────

  function handleCardSelect(card) {
    if (!isMyTurn || !PLAYABLE.has(card.effect)) return;
    if (selectedCard?.instanceId === card.instanceId) {
      setSelectedCard(null);
      setSelectedTarget(null);
      return;
    }
    setSelectedCard(card);
    // heal / absolute_defense は自動自己ターゲット
    if (card.effect === 'heal' || card.effect === 'absolute_defense') {
      setSelectedTarget(myId);
    } else {
      // デフォルトターゲット: 最初の攻撃可能な相手
      const targets = getAttackTargets(card);
      setSelectedTarget(targets[0] || null);
    }
  }

  function handleTargetSelect(targetId) {
    if (!isMyTurn || !selectedCard) return;
    setSelectedTarget(targetId);
  }

  function handleConfirm() {
    if (!selectedCard || !selectedTarget) return;
    socket.emit('play_card', { cardInstanceId: selectedCard.instanceId, targetId: selectedTarget });
    setIsMyTurn(false);
    setSelectedCard(null);
    setSelectedTarget(null);
  }

  function handleReflect(doReflect) {
    clearInterval(timerRef.current);
    socket.emit('reflect_response', { doReflect });
    setPrompt(null);
  }

  function handleHealTarget(targetId) {
    socket.emit('heal_target_select', { targetId });
    setPrompt(null);
  }

  // ─── ターゲット計算 ────────────────────────────────────────

  const players = gameState?.players || {};
  const playerOrder = gameState?.playerOrder || [];
  const mode = gameState?.mode;
  const me = players[myId];

  function getAttackTargets(card) {
    if (!card || card.effect === 'heal') return [];
    return playerOrder.filter(id => {
      if (id === myId) return false;
      const p = players[id];
      if (!p || p.isEliminated) return false;
      return true;
    });
  }

  function isTeamAttack(id) {
    if (mode !== 'team' || !me) return false;
    const p = players[id];
    return p && p.team === me.team && id !== myId;
  }

  function getHealTargets() {
    if (mode === 'team') {
      return playerOrder.filter(id => {
        const p = players[id];
        return p && !p.isEliminated && me && p.team === me.team;
      });
    }
    return [myId];
  }

  function isTargetable(id) {
    if (!isMyTurn || !selectedCard) return false;
    if (selectedCard.effect === 'heal') return getHealTargets().includes(id);
    return getAttackTargets(selectedCard).includes(id);
  }

  // ─── ユーティリティ ───────────────────────────────────────

  function getEffectLabel(card) {
    const e = EFFECT_MAP[card.effect];
    let label = e?.label || card.effect;
    if (card.attribute) label += ` ${ATTR_LABEL[card.attribute] || card.attribute}`;
    return label;
  }

  function getHpColor(hp) {
    const ratio = Math.max(0, Math.min(1, hp / 100));
    const hue = ratio * 120; // 0=red, 120=green
    return `hsl(${hue}, 70%, 45%)`;
  }

  const currentPlayerId = gameState?.currentPlayerId;

  return (
    <div className="battle-layout">
      <BattleEffectLayer effects={effects} />
      {/* プレイヤーエリア（全員表示） */}
      <div className="opponents-area">
        {playerOrder.map(id => {
          const p = players[id];
          if (!p) return null;
          const isCurrent = id === currentPlayerId;
          const targetable = isTargetable(id);
          const isSelected = selectedTarget === id;
          const isWarn = isSelected && isTeamAttack(id);
          const hpRatio = Math.max(0, p.hp) / 100;
          const teamClass = mode === 'team' ? (p.team === 0 ? 'team0' : 'team1') : '';

          return (
            <div
              key={id}
              className={[
                'player-card',
                isCurrent    ? 'current-turn'       : '',
                targetable   ? 'targetable'          : '',
                isSelected && !isWarn ? 'selected-target' : '',
                isWarn       ? 'selected-target-warn': '',
                p.isEliminated ? 'eliminated'        : '',
                teamClass,
              ].filter(Boolean).join(' ')}
              onClick={() => targetable && handleTargetSelect(id)}
            >
              {isSelected && !isWarn && (
                <div className="reticle">
                  <div className="reticle-ring" />
                  <div className="reticle-dot" />
                </div>
              )}
              {isWarn && (
                <div className="reticle reticle-warn">
                  <div className="reticle-ring" />
                  <div className="reticle-dot" />
                </div>
              )}
              <div className="player-name">
                {p.nickname}{id === myId ? ' 👤' : ''}
              </div>
              <div className="hp-bar-wrap">
                <div className="hp-bar" style={{ width: `${Math.max(0, hpRatio) * 100}%`, background: getHpColor(p.hp) }} />
              </div>
              <div className="hp-text">HP: {Math.max(0, p.hp)}</div>
              <div className="status-badges">
                {isCurrent         && <span className="badge badge-turn">ターン中</span>}
                {p.isPoisoned      && <span className="badge badge-poison">☠毒</span>}
                {p.isParalyzed     && <span className="badge badge-paralysis">⚡麻痺</span>}
                {p.isShielded      && <span className="badge" style={{ background: '#1565c0', color: '#fff' }}>🛡防御中</span>}
                {p.isEliminated    && <span className="badge" style={{ background: '#555', color: '#fff' }}>脱落</span>}
                {mode === 'team'   && <span className={`badge ${p.team === 0 ? 'badge-team0' : 'badge-team1'}`}>チーム{p.team + 1}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* 手札 */}
      <div className="hand-area panel">
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          手札 ({myHand.length}枚)
          {isMyTurn && <span style={{ color: 'var(--yellow)', fontWeight: 700, marginLeft: 8 }}>▶ あなたのターン！</span>}
        </div>
        <div className="hand-grid">
          {myHand.map(card => {
            const playable = PLAYABLE.has(card.effect);
            const isSelected = selectedCard?.instanceId === card.instanceId;
            const color = CATEGORY_COLORS[EFFECT_MAP[card.effect]?.category] || '#888';
            return (
              <div
                key={card.instanceId}
                className={['hand-card', isSelected ? 'selected' : '', (!isMyTurn || !playable) ? 'unplayable' : ''].filter(Boolean).join(' ')}
                onClick={() => handleCardSelect(card)}
                title={EFFECT_MAP[card.effect]?.description || ''}
              >
                <img src={card.imageUrl} alt="" />
                {card.name && <div className="hand-card-label" style={{ color: 'var(--text)', fontSize: 9 }}>{card.name}</div>}
                <div className="hand-card-label" style={{ color }}>{EFFECT_MAP[card.effect]?.label || card.effect}</div>
                {card.attribute && <div className="hand-card-attr">{ATTR_LABEL[card.attribute]}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* アクションバー */}
      <div className="my-area">
        <div className="action-bar">
          {isMyTurn ? (
            <>
              <div style={{ flex: 1 }}>
                <div className="info">
                  {selectedCard
                    ? `「${getEffectLabel(selectedCard)}」→ ${selectedTarget && players[selectedTarget] ? players[selectedTarget].nickname : '対象を選択'}`
                    : 'カードを選んでください'}
                </div>
                {selectedTarget && isTeamAttack(selectedTarget) && (
                  <div style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 2 }}>
                    ⚠️ 仲間への攻撃です
                  </div>
                )}
              </div>
              <button className="btn btn-primary" disabled={!selectedCard || !selectedTarget} onClick={handleConfirm}>
                使用
              </button>
              {canPass && (
                <button className="btn btn-ghost" onClick={() => socket.emit('pass_turn')} style={{ marginLeft: 4 }}>
                  パス
                </button>
              )}
            </>
          ) : (
            <div className="info" style={{ textAlign: 'center', width: '100%' }}>
              {currentPlayerId && players[currentPlayerId]
                ? `${players[currentPlayerId].nickname} のターン...`
                : '処理中...'}
            </div>
          )}
        </div>
      </div>

      {/* バトルログ */}
      <div className="log-panel panel">
        <h3>バトルログ</h3>
        <div className="log-list" ref={logRef}>
          {battleLog.map((entry, i) => (
            <div key={i} className="log-entry">{entry}</div>
          ))}
        </div>
      </div>

      {/* プロンプトオーバーレイ */}
      {prompt && (
        <div className="overlay">
          <div className="prompt-box">
            {prompt.type === 'reflect' && (
              <>
                <h3>⚡ 反射できます！</h3>
                <p>
                  {prompt.attackerNickname} の「{EFFECT_MAP[prompt.effectType]?.label}
                  {prompt.attribute ? ` ${ATTR_LABEL[prompt.attribute]}` : ''}」を反射しますか？
                </p>
                <div className="prompt-buttons">
                  <button className="btn btn-primary" onClick={() => handleReflect(true)}>反射する</button>
                  <button className="btn btn-ghost" onClick={() => handleReflect(false)}>受ける</button>
                </div>
                <div className="timer-bar"><div className="timer-fill" style={{ width: `${timer}%` }} /></div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>20秒以内に選択（未選択→受ける）</p>
              </>
            )}

            {prompt.type === 'heal_target' && (
              <>
                <h3>💚 回復対象を選択</h3>
                <p>誰を回復しますか？</p>
                <div className="prompt-buttons">
                  {(prompt.teammates || []).map(t => (
                    <button key={t.id} className="btn btn-success" onClick={() => handleHealTarget(t.id)}>
                      {t.nickname}{t.id === myId ? '（自分）' : ''}
                    </button>
                  ))}
                </div>
              </>
            )}

            {prompt.type === 'disconnected' && (
              <div className="game-over-box">
                <h2>🔌 接続が切断されました</h2>
                <p style={{ fontSize: 16, color: 'var(--muted)', margin: '12px 0' }}>
                  {prompt.nickname} が切断しました
                </p>
                <button className="btn btn-primary" onClick={handleExit}>ホームへ戻る</button>
              </div>
            )}

            {prompt.type === 'game_over' && (
              <div className="game-over-box">
                <h2>🏆 ゲーム終了</h2>
                {prompt.winnerNickname && (
                  <p style={{ fontSize: 20, fontWeight: 700, color: prompt.isMe ? 'var(--yellow)' : 'var(--muted)', margin: '12px 0' }}>
                    {prompt.isMe ? '🎉 あなたの勝利！' : `${prompt.winnerNickname} の勝利！`}
                  </p>
                )}
                {prompt.winnerTeam != null && !prompt.winnerNickname && (
                  <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--yellow)', margin: '12px 0' }}>
                    チーム{prompt.winnerTeam + 1} の勝利！
                  </p>
                )}
                {!prompt.winnerNickname && prompt.winnerTeam == null && (
                  <p style={{ fontSize: 18, margin: '12px 0' }}>引き分け</p>
                )}
                <p style={{ color: 'var(--muted)', marginBottom: 16 }}>お疲れ様でした！</p>

                {rematchVotes.total > 0 && (
                  <p style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 12 }}>
                    再戦投票中... {rematchVotes.votes} / {rematchVotes.total} 人
                  </p>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => { setMyRematchVoted(true); socket.emit('rematch_vote'); }}
                    disabled={myRematchVoted}
                  >
                    {myRematchVoted ? '✅ 再戦投票済み' : '🔄 再戦'}
                  </button>
                  <button className="btn btn-ghost" onClick={handleExit}>
                    ロビーへ戻る
                  </button>
                </div>
              </div>
            )}

            {prompt.type === 'rematch_cancelled' && (
              <div className="game-over-box">
                <h2>❌ 再戦キャンセル</h2>
                <p style={{ fontSize: 16, color: 'var(--muted)', margin: '12px 0' }}>
                  {prompt.nickname} がロビーへ戻りました
                </p>
                <button className="btn btn-primary" onClick={handleExit}>ロビーへ戻る</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
