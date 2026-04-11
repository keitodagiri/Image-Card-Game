const { v4: uuidv4 } = require('uuid');
const {
  getAttributeMultiplier,
  BASE_DAMAGE,
  INITIAL_HP,
  HAND_SIZE,
  POISON_HIT_RATE,
  PARALYSIS_HIT_RATE,
  randomHeal,
  randomPoisonDot,
  hitRoll,
} = require('./GameLogic');

const REFLECT_TIMEOUT_MS = 20000;
const HEAL_TARGET_TIMEOUT_MS = 15000;

const CARD_NAMES = {
  explosion: '攻撃', poison: '毒', paralysis: '麻痺', heal: '回復',
  explosion_reflect: '攻撃反射', poison_reflect: '毒反射', paralysis_reflect: '麻痺反射',
  invincible: '無敵技', absolute_defense: '絶対防御',
};
const ATTR_NAMES = { fire: '🔥火', water: '💧水', grass: '🌿草', dark: '🌑闇', light: '✨光' };

// プレイヤーがアクションで直接使えるカード
const ACTIVE_EFFECTS = new Set(['explosion', 'poison', 'paralysis', 'heal', 'invincible', 'absolute_defense']);

class GameRoom {
  constructor(roomCode, hostId, hostNickname) {
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.mode = '1v1';
    this.status = 'waiting'; // 'waiting' | 'playing' | 'finished'
    this.players = new Map(); // socketId → playerState
    this.joinOrder = [];      // 入室順のsocketId配列
    this.currentTurnIndex = 0;
    this.phase = 'waiting';
    this.pendingAction = null;
    this.io = null;
    this.rematchVotes = new Set();

    this._addPlayer(hostId, hostNickname);
  }

  // ─── プレイヤー管理 ───────────────────────────────────────

  _addPlayer(id, nickname) {
    this.players.set(id, {
      id,
      nickname,
      hp: INITIAL_HP,
      hand: [],
      deck: [],
      isPoisoned: false,
      isParalyzed: false,
      isEliminated: false,
      isShielded: false,
      shieldCardImage: null,
      shieldCardName: null,
      team: -1,
      lobbyTeam: -1,
      currentAttribute: null,
    });
    this.joinOrder.push(id);
  }

  addPlayer(id, nickname) {
    if (this.status === 'playing') return { ok: false, error: '対戦中のため入室できません' };
    if (this.players.has(id)) return { ok: false, error: '既に入室済みです' };
    this._addPlayer(id, nickname);
    return { ok: true };
  }

  removePlayer(id) {
    const wasPlaying = this.status === 'playing';
    const player = this.players.get(id);
    this.players.delete(id);
    this.joinOrder = this.joinOrder.filter(x => x !== id);
    if (this.hostId === id && this.joinOrder.length > 0) {
      this.hostId = this.joinOrder[0];
    }
    // 対戦中に切断された場合、残りのプレイヤーに通知
    if (wasPlaying && player && this.io) {
      this._emitAll('player_disconnected', { nickname: player.nickname });
    }
    // 再戦投票中に退出した場合、再戦キャンセルを通知
    if (this.status === 'finished' && player && this.io) {
      this.rematchVotes.delete(id);
      this._emitAll('rematch_cancelled', { nickname: player.nickname });
    }
  }

  setMode(mode) {
    if (['1v1', 'battle_royale', 'team'].includes(mode)) {
      this.mode = mode;
      return true;
    }
    return false;
  }

  getLobbyState() {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      mode: this.mode,
      status: this.status,
      players: this.joinOrder.map(id => {
        const p = this.players.get(id);
        return p ? { id, nickname: p.nickname, lobbyTeam: p.lobbyTeam } : null;
      }).filter(Boolean),
    };
  }

  handleTeamSelect(socketId, team) {
    const p = this.players.get(socketId);
    if (!p || this.status !== 'waiting') return;
    p.lobbyTeam = team;
  }

  // ─── ゲーム開始 ────────────────────────────────────────────

  startGame(io, playerDecks) {
    this.io = io;
    this.status = 'playing';

    this.joinOrder.forEach((id, idx) => {
      const p = this.players.get(id);
      if (!p) return;
      p.hp = INITIAL_HP;
      p.isPoisoned = false;
      p.isParalyzed = false;
      p.isEliminated = false;
      p.isShielded = false;
      p.shieldCardImage = null;
      p.shieldCardName = null;
      p.currentAttribute = null;
      p.team = this.mode === 'team' ? (p.lobbyTeam !== -1 ? p.lobbyTeam : idx % 2) : -1;

      const rawDeck = playerDecks.get(id) || [];
      p.deckTemplate = rawDeck.map(c => ({ ...c })); // 再補充用に保存
      p.deck = this._shuffle([...p.deckTemplate]);
      p.hand = [];
      for (let i = 0; i < HAND_SIZE; i++) this._drawCard(id);
    });

    this.currentTurnIndex = 0;
    // 各プレイヤーに初期手札を送る
    this.joinOrder.forEach(id => {
      const p = this.players.get(id);
      if (p) this._emitTo(id, 'hand_update', { hand: p.hand });
    });
    this._emitAll('game_started', { state: this.getPublicState() });
    setTimeout(() => this._startTurn(), 500);
  }

  // ─── ターン進行 ────────────────────────────────────────────

  _startTurn() {
    const currentId = this._getCurrentPlayerId();
    if (!currentId) return;
    const p = this.players.get(currentId);

    // 毎ターン1枚ドロー
    this._drawCard(currentId);

    // 使用可能なカードがなければ追加で1枚ドロー
    const hasPlayable = p.hand.some(c => ACTIVE_EFFECTS.has(c.effect));
    if (!hasPlayable) this._drawCard(currentId);

    this._emitTo(currentId, 'hand_update', { hand: p.hand });
    const noPlayable = !p.hand.some(c => ACTIVE_EFFECTS.has(c.effect));
    this._emitAll('turn_start', {
      state: this.getPublicState(),
      currentPlayerId: currentId,
      log: `${p.nickname} のターン${noPlayable ? '（使用可能なカードなし）' : ''}`,
      canPass: noPlayable && !p.isParalyzed,
    });

    this._processPoisonAndParalysis(currentId, false);
  }

  _processPoisonAndParalysis(playerId, poisonCured) {
    const p = this.players.get(playerId);

    if (p.isPoisoned && !poisonCured) {
      const dmg = randomPoisonDot();
      p.hp -= dmg;
      this._emitAll('game_update', {
        state: this.getPublicState(),
        log: `${p.nickname} が毒ダメージ ${dmg} を受けた！ (HP: ${Math.max(0, p.hp)})`,
      });
      this._emitAll('battle_effect', { type: 'poison_dot', targetId: playerId, damage: dmg, announcement: `${p.nickname}が毒ダメージ！` });
      if (p.hp <= 0) {
        this._eliminatePlayer(playerId, '毒ダメージ');
        if (this._checkGameOver()) return;
        this._advanceTurn();
        return;
      }
    }

    if (p.isParalyzed) {
      p.isParalyzed = false;
      this._emitAll('game_update', {
        state: this.getPublicState(),
        log: `${p.nickname} は麻痺で行動不能！ターンをスキップ`,
      });
      this._advanceTurn();
      return;
    }

    this.phase = 'action';
    this._emitAll('game_update', { state: this.getPublicState(), log: null });
    this._emitTo(playerId, 'your_turn', {});
  }

  // ─── カード使用 ────────────────────────────────────────────

  handlePlayCard(socketId, cardInstanceId, targetId) {
    if (this.phase !== 'action') {
      console.log(`[handlePlayCard] rejected: phase=${this.phase} (not action)`);
      return;
    }
    if (this._getCurrentPlayerId() !== socketId) {
      console.log(`[handlePlayCard] rejected: not current player`);
      return;
    }

    const player = this.players.get(socketId);
    if (!player) return;

    const cardIdx = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIdx === -1) {
      console.log(`[handlePlayCard] rejected: card not in hand`);
      return;
    }
    const card = player.hand[cardIdx];

    // アクション可能なカードのみ使用可
    if (!ACTIVE_EFFECTS.has(card.effect)) {
      console.log(`[handlePlayCard] rejected: effect not active ${card.effect}`);
      return;
    }

    // heal / absolute_defense は強制自己対象、それ以外はtargetId使用
    const isSelfTarget = card.effect === 'heal' || card.effect === 'absolute_defense';
    const effectiveTargetId = isSelfTarget
      ? socketId
      : (targetId === undefined || targetId === null || targetId === '') ? socketId : targetId;

    const target = this.players.get(effectiveTargetId);
    if (!target || (!isSelfTarget && target.isEliminated)) {
      console.log(`[handlePlayCard] rejected: target=${!!target} elim=${target?.isEliminated} targetId=${effectiveTargetId}`);
      return;
    }

    // 攻撃系は自分をターゲットにできない
    if (!isSelfTarget && socketId === effectiveTargetId) {
      console.log(`[handlePlayCard] rejected: non-self card targeting self`);
      return;
    }

    // チーム戦でhealは自チームのみ
    if (card.effect === 'heal' && this.mode === 'team') {
      if (target.team !== player.team) {
        console.log(`[handlePlayCard] rejected: heal wrong team`);
        return;
      }
    }

    console.log(`[handlePlayCard] OK effect=${card.effect} mode=${this.mode} target=${effectiveTargetId}`);

    player.hand.splice(cardIdx, 1);
    this._emitTo(socketId, 'hand_update', { hand: player.hand });
    this.phase = 'processing';

    this._emitAll('game_update', {
      state: this.getPublicState(),
      log: `${player.nickname} が「${this._cardLabel(card)}」を使用 → ${target.nickname}`,
    });

    // エフェクト表示用データを事前計算
    const preCalc = {};
    if (card.effect === 'explosion') {
      preCalc.mult   = getAttributeMultiplier(card.attribute, target.currentAttribute);
      preCalc.damage = Math.round(BASE_DAMAGE.explosion * preCalc.mult);
    } else if (card.effect === 'invincible') {
      preCalc.damage = BASE_DAMAGE.invincible;
    } else if (card.effect === 'poison') {
      preCalc.hit = hitRoll(POISON_HIT_RATE);
    } else if (card.effect === 'paralysis') {
      preCalc.hit = hitRoll(PARALYSIS_HIT_RATE);
    } else if (card.effect === 'heal') {
      preCalc.amount = randomHeal();
    }

    // カード使用時に即エフェクト表示（反射待ちの場合も含む）
    const effectAnnouncements = {
      explosion:        `${player.nickname}が${target.nickname}を攻撃！`,
      invincible:       `${player.nickname}が${target.nickname}に無敵技！`,
      poison:           `${player.nickname}が${target.nickname}に毒！`,
      paralysis:        `${player.nickname}が${target.nickname}に麻痺！`,
      heal:             `${player.nickname}がHPを回復！`,
      absolute_defense: `${player.nickname}が絶対防御を構えた！`,
    };
    this._emitAll('battle_effect', {
      type: card.effect,
      attribute: card.attribute || null,
      targetId: effectiveTargetId,
      card: { imageUrl: card.imageUrl, name: card.name || null },
      announcement: effectAnnouncements[card.effect] || '',
      damage:     preCalc.damage,
      multiplier: preCalc.mult,
      hit:        preCalc.hit,
      amount:     preCalc.amount,
    });

    // 反射チェック（爆発・毒・麻痺のみ）
    const reflectMap = { explosion: 'explosion_reflect', poison: 'poison_reflect', paralysis: 'paralysis_reflect' };
    const reflectEffect = reflectMap[card.effect];
    const hasReflectCard = target.hand.some(c => c.effect === reflectEffect);
    const canReflect = !!reflectEffect && !target.isEliminated && hasReflectCard;
    if (reflectEffect && !canReflect) {
      console.log(`[handlePlayCard] canReflect=false: effect=${card.effect} reflectCard=${hasReflectCard} targetElim=${target.isEliminated}`);
    }

    if (canReflect) {
      this.phase = 'reflect_choice';
      this._emitTo(effectiveTargetId, 'reflect_prompt', {
        effectType: card.effect,
        attribute: card.attribute || null,
        attackerId: socketId,
        attackerNickname: player.nickname,
      });
      this.pendingAction = {
        type: 'reflect_choice',
        card,
        attackerId: socketId,
        targetId: effectiveTargetId,
        preCalc,
        timeout: setTimeout(() => {
          if (this.pendingAction?.type === 'reflect_choice') {
            const pa = this.pendingAction;
            this.pendingAction = null;
            this._resolveReflect(false, pa.card, pa.attackerId, pa.targetId, pa.preCalc);
          }
        }, REFLECT_TIMEOUT_MS),
      };
    } else if (card.effect === 'heal' && this.mode === 'team') {
      this._promptHealTarget(socketId, card, preCalc);
    } else {
      this._applyEffect(card, socketId, effectiveTargetId, preCalc);
    }
  }

  handlePassTurn(socketId) {
    if (this.phase !== 'action') return;
    if (this._getCurrentPlayerId() !== socketId) return;
    const p = this.players.get(socketId);
    if (!p) return;
    // 使用可能なカードがある場合はパス不可
    if (p.hand.some(c => ACTIVE_EFFECTS.has(c.effect))) return;
    this._emitAll('game_update', {
      state: this.getPublicState(),
      log: `${p.nickname} はパスした`,
    });
    this._advanceTurn();
  }

  handleReflectResponse(socketId, doReflect) {
    console.log(`[handleReflectResponse] socketId=${socketId} doReflect=${doReflect} pendingType=${this.pendingAction?.type} pendingTarget=${this.pendingAction?.targetId}`);
    if (this.pendingAction?.type !== 'reflect_choice') return;
    if (this.pendingAction.targetId !== socketId) return;
    clearTimeout(this.pendingAction.timeout);
    const { card, attackerId, targetId, preCalc } = this.pendingAction;
    this.pendingAction = null;
    this._resolveReflect(doReflect, card, attackerId, targetId, preCalc);
  }

  _resolveReflect(doReflect, card, attackerId, targetId, preCalc = {}) {
    const target = this.players.get(targetId);
    const attacker = this.players.get(attackerId);
    console.log(`[_resolveReflect] doReflect=${doReflect} card=${card.effect} attacker=${attackerId} target=${targetId}`);

    if (doReflect) {
      const reflectEffectMap = { explosion: 'explosion_reflect', poison: 'poison_reflect', paralysis: 'paralysis_reflect' };
      const reflectEffectName = reflectEffectMap[card.effect];
      const idx = target.hand.findIndex(c => c.effect === reflectEffectName);
      let defCard = null;
      if (idx !== -1) {
        defCard = target.hand[idx];
        target.hand.splice(idx, 1);
      } else {
        console.warn(`[_resolveReflect] reflect card not found in hand! effect=${reflectEffectName}`);
      }
      this._emitTo(targetId, 'hand_update', { hand: target.hand });

      // 攻撃エフェクト（2800ms）の後：反射カードを表示
      setTimeout(() => {
        this._emitAll('game_update', {
          state: this.getPublicState(),
          log: `${target.nickname} が反射！効果が ${attacker.nickname} に返った！`,
        });
        if (defCard) {
          this._emitAll('battle_effect', {
            type: reflectEffectName,
            targetId,
            card: { imageUrl: defCard.imageUrl, name: defCard.name || null },
            announcement: `${target.nickname}が${attacker.nickname}の攻撃を反射！`,
          });
        }
        // 反射カード表示（2800ms）の後：効果を適用（攻撃者が対象になる）
        setTimeout(() => {
          this._applyEffect(card, targetId, attackerId, preCalc);
        }, 2800);
      }, 2800);
    } else {
      this._applyEffect(card, attackerId, targetId, preCalc);
    }
  }

  _promptHealTarget(healerId, card, preCalc = {}) {
    const healer = this.players.get(healerId);
    const teammates = this.joinOrder
      .filter(id => {
        const p = this.players.get(id);
        return p && !p.isEliminated && p.team === healer.team;
      })
      .map(id => ({ id, nickname: this.players.get(id).nickname }));

    this.phase = 'heal_target_choice';
    this._emitTo(healerId, 'heal_target_prompt', { teammates });

    this.pendingAction = {
      type: 'heal_target_choice',
      healerId,
      card,
      preCalc,
      timeout: setTimeout(() => {
        if (this.pendingAction?.type === 'heal_target_choice') {
          const pa = this.pendingAction;
          this.pendingAction = null;
          this._applyEffect(pa.card, pa.healerId, pa.healerId, pa.preCalc);
        }
      }, HEAL_TARGET_TIMEOUT_MS),
    };
  }

  handleHealTargetSelect(socketId, targetId) {
    if (this.pendingAction?.type !== 'heal_target_choice') return;
    if (this.pendingAction.healerId !== socketId) return;
    const healer = this.players.get(socketId);
    const target = this.players.get(targetId);
    // 自チームのみヒール可能（脱落済み・敵チームは無効）
    if (!target || target.isEliminated) return;
    if (this.mode === 'team' && healer && target.team !== healer.team) return;
    clearTimeout(this.pendingAction.timeout);
    const { card, healerId, preCalc } = this.pendingAction;
    this.pendingAction = null;
    this._applyEffect(card, healerId, targetId, preCalc);
  }

  // ─── 効果処理 ──────────────────────────────────────────────

  _applyEffect(card, sourceId, targetId, preCalc = {}) {
    const target = this.players.get(targetId);
    const source = this.players.get(sourceId);
    if (!target || !source) {
      console.error(`[_applyEffect] null player: source=${sourceId} target=${targetId} effect=${card.effect}`);
      this._advanceTurn();
      return;
    }

    if (card.effect === 'explosion' && card.attribute) {
      source.currentAttribute = card.attribute;
    }

    let defenseTookOver = false;

    switch (card.effect) {
      case 'explosion': {
        if (this._tryAbsoluteDefense(targetId)) { defenseTookOver = true; break; }
        const mult = preCalc.mult ?? getAttributeMultiplier(card.attribute, target.currentAttribute);
        const dmg  = preCalc.damage ?? Math.round(BASE_DAMAGE.explosion * mult);
        target.hp -= dmg;
        let msg = `${target.nickname} に攻撃 ${dmg} ダメージ！`;
        if (mult === 2)   msg += ' (属性有利 ×2)';
        if (mult === 0.5) msg += ' (属性不利 ×0.5)';
        msg += ` (HP: ${Math.max(0, target.hp)})`;
        this._emitAll('game_update', { state: this.getPublicState(), log: msg });
        break;
      }

      case 'invincible': {
        if (this._tryAbsoluteDefense(targetId)) { defenseTookOver = true; break; }
        const dmg = preCalc.damage ?? BASE_DAMAGE.invincible;
        target.hp -= dmg;
        this._emitAll('game_update', {
          state: this.getPublicState(),
          log: `無敵技！${target.nickname} に ${dmg} の固定ダメージ！ (HP: ${Math.max(0, target.hp)})`,
        });
        break;
      }

      case 'poison': {
        if (this._tryAbsoluteDefense(targetId)) { defenseTookOver = true; break; }
        const hit = preCalc.hit ?? hitRoll(POISON_HIT_RATE);
        if (hit) {
          target.isPoisoned = true;
          this._emitAll('game_update', {
            state: this.getPublicState(),
            log: `${target.nickname} が毒状態に！毎ターン ${BASE_DAMAGE.poison_dot} ダメージ`,
          });
        } else {
          this._emitAll('game_update', { state: this.getPublicState(), log: '毒が外れた！(命中率70%)' });
        }
        break;
      }

      case 'paralysis': {
        if (this._tryAbsoluteDefense(targetId)) { defenseTookOver = true; break; }
        const hit = preCalc.hit ?? hitRoll(PARALYSIS_HIT_RATE);
        if (hit) {
          target.isParalyzed = true;
          this._emitAll('game_update', {
            state: this.getPublicState(),
            log: `${target.nickname} が麻痺！次のターン行動不能`,
          });
        } else {
          this._emitAll('game_update', { state: this.getPublicState(), log: '麻痺が外れた！(命中率60%)' });
        }
        break;
      }

      case 'heal': {
        const amount = preCalc.amount ?? randomHeal();
        target.hp = Math.min(INITIAL_HP, target.hp + amount);
        this._emitAll('game_update', {
          state: this.getPublicState(),
          log: `${target.nickname} が HP ${amount} 回復！ (HP: ${target.hp})`,
        });
        break;
      }

      case 'absolute_defense': {
        // 自分のターンに使用 → シールド状態をセット
        source.isShielded = true;
        source.shieldCardImage = card.imageUrl || null;
        source.shieldCardName  = card.name || null;
        this._emitAll('game_update', {
          state: this.getPublicState(),
          log: `${source.nickname} が絶対防御を構えた！次の攻撃を1回防ぐ`,
        });
        break;
      }
    }

    if (defenseTookOver) return; // _tryAbsoluteDefense がタイマーで _advanceTurn を呼ぶ
    this._checkEliminations();
    if (this._checkGameOver()) return;
    this._advanceTurn();
  }

  // ─── 防御チェック ─────────────────────────────────────────

  _tryAbsoluteDefense(targetId) {
    const target = this.players.get(targetId);
    if (!target.isShielded) return false;
    // シールド解除
    target.isShielded = false;
    const shieldImg  = target.shieldCardImage;
    const shieldName = target.shieldCardName;
    target.shieldCardImage = null;
    target.shieldCardName  = null;
    this._emitAll('game_update', {
      state: this.getPublicState(),
      log: `${target.nickname} の絶対防御が発動！攻撃を完全に防いだ！`,
    });
    // 攻撃エフェクト（2800ms）後に防御エフェクト表示、さらに2800ms後にターン進行
    setTimeout(() => {
      this._emitAll('battle_effect', {
        type: 'absolute_defense',
        targetId,
        card: shieldImg ? { imageUrl: shieldImg, name: shieldName } : null,
        announcement: `${target.nickname}が絶対防御！`,
      });
      setTimeout(() => {
        this._checkEliminations();
        if (!this._checkGameOver()) this._advanceTurn();
      }, 2800);
    }, 2800);
    return true;
  }

  // ─── 脱落・勝敗 ───────────────────────────────────────────

  _checkEliminations() {
    this.joinOrder.forEach(id => {
      const p = this.players.get(id);
      if (p && !p.isEliminated && p.hp <= 0) this._eliminatePlayer(id, 'HP0');
    });
  }

  _eliminatePlayer(playerId, reason) {
    const p = this.players.get(playerId);
    if (!p || p.isEliminated) return;
    p.isEliminated = true;
    p.hp = 0;
    this._emitAll('game_update', {
      state: this.getPublicState(),
      log: `💀 ${p.nickname} が脱落！(${reason})`,
    });
  }

  _checkGameOver() {
    const active = this._getActivePlayers();

    if (this.mode === '1v1' || this.mode === 'battle_royale') {
      if (active.length <= 1) {
        const winner = active[0] ? this.players.get(active[0]) : null;
        this._emitAll('game_over', {
          winnerId: active[0] || null,
          winnerNickname: winner?.nickname || null,
          log: winner ? `🏆 ${winner.nickname} の勝利！` : '引き分け！',
        });
        this.status = 'finished';
        this._scheduleRoomCleanup();
        return true;
      }
    } else if (this.mode === 'team') {
      for (const team of [0, 1]) {
        const teamActive = active.filter(id => this.players.get(id)?.team === team);
        if (teamActive.length === 0) {
          const winTeam = 1 - team;
          this._emitAll('game_over', {
            winnerTeam: winTeam,
            log: `🏆 チーム${winTeam + 1} の勝利！`,
          });
          this.status = 'finished';
          this._scheduleRoomCleanup();
          return true;
        }
      }
    }
    return false;
  }

  _scheduleRoomCleanup() {
    // ゲーム終了60秒後に部屋を自動削除（再戦投票の猶予）
    this._cleanupTimer = setTimeout(() => {
      const roomManager = require('./RoomManager');
      roomManager.deleteRoom(this.roomCode);
    }, 60000);
  }

  handleRematchVote(socketId) {
    if (this.status !== 'finished') return;
    this.rematchVotes.add(socketId);
    const total = this.joinOrder.length;
    const votes = this.rematchVotes.size;
    this._emitAll('rematch_vote_update', { votes, total });
    if (votes >= total) {
      clearTimeout(this._cleanupTimer);
      this._restartGame();
    }
  }

  cancelRematch(socketId) {
    if (this.status !== 'finished') return;
    const p = this.players.get(socketId);
    if (!p) return;
    this._emitAll('rematch_cancelled', { nickname: p.nickname });
  }

  _restartGame() {
    this.rematchVotes = new Set();
    this.status = 'playing';
    this.currentTurnIndex = 0;
    this.phase = 'playing';
    this.pendingAction = null;

    this.joinOrder.forEach((id, idx) => {
      const p = this.players.get(id);
      if (!p) return;
      p.hp = INITIAL_HP;
      p.isPoisoned = false;
      p.isParalyzed = false;
      p.isEliminated = false;
      p.isShielded = false;
      p.shieldCardImage = null;
      p.shieldCardName = null;
      p.currentAttribute = null;
      p.team = this.mode === 'team' ? (p.lobbyTeam !== -1 ? p.lobbyTeam : idx % 2) : -1;
      p.deck = this._shuffle([...p.deckTemplate]);
      p.hand = [];
      for (let i = 0; i < HAND_SIZE; i++) this._drawCard(id);
    });

    this.joinOrder.forEach(id => {
      const p = this.players.get(id);
      if (p) this._emitTo(id, 'hand_update', { hand: p.hand });
    });
    this._emitAll('game_started', { state: this.getPublicState() });
    setTimeout(() => this._startTurn(), 500);
  }

  _advanceTurn() {
    const n = this.joinOrder.length;
    if (n === 0) return;
    let next = (this.currentTurnIndex + 1) % n;
    for (let i = 0; i < n; i++) {
      const p = this.players.get(this.joinOrder[next]);
      if (p && !p.isEliminated) { this.currentTurnIndex = next; break; }
      next = (next + 1) % n;
    }
    this.phase = 'idle';
    setTimeout(() => this._startTurn(), 600);
  }

  // ─── ユーティリティ ───────────────────────────────────────

  _getCurrentPlayerId() {
    const n = this.joinOrder.length;
    for (let i = 0; i < n; i++) {
      const id = this.joinOrder[(this.currentTurnIndex + i) % n];
      const p = this.players.get(id);
      if (p && !p.isEliminated) return id;
    }
    return null;
  }

  _getActivePlayers() {
    return this.joinOrder.filter(id => {
      const p = this.players.get(id);
      return p && !p.isEliminated;
    });
  }

  getPublicState() {
    const players = {};
    this.joinOrder.forEach(id => {
      const p = this.players.get(id);
      if (p) {
        players[id] = {
          id,
          nickname: p.nickname,
          hp: p.hp,
          handSize: p.hand.length,
          isPoisoned: p.isPoisoned,
          isParalyzed: p.isParalyzed,
          isEliminated: p.isEliminated,
          isShielded: p.isShielded,
          team: p.team,
          currentAttribute: p.currentAttribute,
        };
      }
    });
    return {
      roomCode: this.roomCode,
      mode: this.mode,
      players,
      playerOrder: this.joinOrder,
      currentPlayerId: this._getCurrentPlayerId(),
      phase: this.phase,
    };
  }

  _drawCard(playerId) {
    const p = this.players.get(playerId);
    if (!p) return null;
    // デッキが空なら再シャッフルして補充
    if (p.deck.length === 0) {
      if (!p.deckTemplate || p.deckTemplate.length === 0) return null;
      p.deck = this._shuffle(p.deckTemplate.map(c => ({ ...c })));
    }
    const card = { ...p.deck.shift(), instanceId: uuidv4() };
    p.hand.push(card);
    return card;
  }

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  _cardLabel(card) {
    let label = CARD_NAMES[card.effect] || card.effect;
    if (card.attribute) label += `(${ATTR_NAMES[card.attribute] || card.attribute})`;
    return label;
  }

  _emitAll(event, data) {
    if (this.io) this.io.to(this.roomCode).emit(event, data);
  }

  _emitTo(socketId, event, data) {
    if (this.io) this.io.to(socketId).emit(event, data);
  }
}

module.exports = GameRoom;
