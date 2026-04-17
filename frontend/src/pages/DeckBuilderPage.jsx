import { useState, useRef } from 'react';
import { EFFECTS, EFFECT_MAP, CATEGORY_COLORS } from '../utils/gameConstants';
import {
  loadAllDecks, getActiveDeck, setActiveDeck,
  createDeck, renameDeck, deleteDeck, saveDeckCards,
  addCard, removeCard, canAddCard,
} from '../utils/deckStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function DeckBuilderPage({ onBack }) {
  const [decks, setDecks] = useState(() => {
    const all = loadAllDecks();
    if (all.length === 0) {
      const d = createDeck('デッキ1');
      return [d];
    }
    return all;
  });
  const activeDeck = getActiveDeck();
  const [selectedDeckId, setSelectedDeckId] = useState(activeDeck?.id || decks[0]?.id || null);

  const currentDeck = decks.find(d => d.id === selectedDeckId) || decks[0] || null;
  const cards = currentDeck?.cards || [];

  const [cardName, setCardName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [selectedEffect, setSelectedEffect] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const [renamingDeckId, setRenamingDeckId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [newDeckName, setNewDeckName] = useState('');
  const [showNewDeck, setShowNewDeck] = useState(false);

  const fileRef = useRef();

  function refreshDecks() {
    setDecks(loadAllDecks());
  }

  function handleSelectDeck(id) {
    setSelectedDeckId(id);
    setActiveDeck(id);
    resetForm();
  }

  function handleCreateDeck() {
    const name = newDeckName.trim() || `デッキ${decks.length + 1}`;
    const deck = createDeck(name);
    refreshDecks();
    setSelectedDeckId(deck.id);
    setActiveDeck(deck.id);
    setNewDeckName('');
    setShowNewDeck(false);
    resetForm();
  }

  function handleStartRename(deck) {
    setRenamingDeckId(deck.id);
    setRenameValue(deck.name);
  }

  function handleFinishRename(id) {
    if (renameValue.trim()) {
      renameDeck(id, renameValue.trim());
      refreshDecks();
    }
    setRenamingDeckId(null);
  }

  function handleDeleteDeck(id) {
    if (decks.length === 1) {
      // 最後の1枚は消せない。中身だけ消す
      saveDeckCards(id, []);
      refreshDecks();
      return;
    }
    const store = deleteDeck(id);
    const remaining = store.decks;
    setDecks(remaining);
    const next = remaining[0]?.id || null;
    setSelectedDeckId(next);
    resetForm();
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) {
        setImageUrl(data.url);
        setImagePreview(data.url);
      } else {
        setError('アップロードに失敗しました');
      }
    } catch {
      setError('サーバーに接続できません');
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setCardName('');
    setImageUrl('');
    setImagePreview('');
    setSelectedEffect(null);
    setError('');
    setEditingId(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleEdit(card) {
    setEditingId(card.id);
    setCardName(card.name || '');
    setImageUrl(card.imageUrl);
    setImagePreview(card.imageUrl);
    setSelectedEffect(card.effect);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleAddCard() {
    if (!imageUrl)       { setError('画像をアップロードしてください'); return; }
    if (!selectedEffect) { setError('効果を選んでください'); return; }
    if (!currentDeck)    return;

    if (editingId) {
      const newCards = cards.map(c =>
        c.id === editingId
          ? { ...c, name: cardName.trim() || null, imageUrl, effect: selectedEffect }
          : c
      );
      saveDeckCards(currentDeck.id, newCards);
      refreshDecks();
      resetForm();
      return;
    }

    if (!canAddCard(cards, selectedEffect)) {
      const lim = EFFECT_MAP[selectedEffect]?.deckLimit;
      setError(lim
        ? `「${EFFECT_MAP[selectedEffect].label}」はデッキに${lim}枚まで`
        : 'デッキが満杯です（15枚）');
      return;
    }
    const newCards = addCard(cards, {
      name: cardName.trim() || null,
      imageUrl,
      effect: selectedEffect,
    });
    saveDeckCards(currentDeck.id, newCards);
    refreshDecks();
    resetForm();
  }

  function handleRemove(cardId) {
    if (editingId === cardId) resetForm();
    if (!currentDeck) return;
    const newCards = removeCard(cards, cardId);
    saveDeckCards(currentDeck.id, newCards);
    refreshDecks();
  }

  const effectByCategory = EFFECTS.reduce((acc, e) => {
    (acc[e.category] = acc[e.category] || []).push(e);
    return acc;
  }, {});
  const CATEGORY_LABELS = { attack: '攻撃系', heal: '回復系', null: '無効系', reflect: '反射系', special: '特殊系' };

  const activeId = getActiveDeck()?.id;

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack}>← 戻る</button>
        <h2>🃏 デッキビルダー</h2>
      </div>

      {/* デッキ選択バー */}
      <div className="deck-tab-bar">
        {decks.map(deck => (
          <div
            key={deck.id}
            className={`deck-tab${deck.id === selectedDeckId ? ' deck-tab-active' : ''}`}
          >
            {renamingDeckId === deck.id ? (
              <input
                className="deck-tab-rename"
                value={renameValue}
                autoFocus
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => handleFinishRename(deck.id)}
                onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(deck.id); if (e.key === 'Escape') setRenamingDeckId(null); }}
              />
            ) : (
              <span className="deck-tab-name" onClick={() => handleSelectDeck(deck.id)}>
                {deck.id === activeId && <span className="deck-active-dot" title="対戦で使用中">●</span>}
                {deck.name}
              </span>
            )}
            {deck.id === selectedDeckId && renamingDeckId !== deck.id && (
              <span className="deck-tab-actions">
                <button className="deck-tab-btn" onClick={() => handleStartRename(deck)} title="名前を変更">✏</button>
                <button className="deck-tab-btn deck-tab-btn-del" onClick={() => handleDeleteDeck(deck.id)} title="削除">✕</button>
              </span>
            )}
          </div>
        ))}

        {showNewDeck ? (
          <div className="deck-tab deck-tab-new-form">
            <input
              className="deck-tab-rename"
              placeholder={`デッキ${decks.length + 1}`}
              value={newDeckName}
              autoFocus
              onChange={e => setNewDeckName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateDeck(); if (e.key === 'Escape') { setShowNewDeck(false); setNewDeckName(''); } }}
            />
            <button className="deck-tab-btn" onClick={handleCreateDeck}>✓</button>
            <button className="deck-tab-btn deck-tab-btn-del" onClick={() => { setShowNewDeck(false); setNewDeckName(''); }}>✕</button>
          </div>
        ) : (
          <button className="deck-tab-add" onClick={() => setShowNewDeck(true)}>＋</button>
        )}
      </div>

      <div className="deck-builder">
        {/* 左: カード作成フォーム */}
        <div className="panel card-form">
          <h3 style={{ marginBottom: 12 }}>{editingId ? '✏ カードを編集' : 'カードを作る'}</h3>

          <div>
            <label>カード名（任意）</label>
            <input
              type="text"
              placeholder="例: 炎の剣"
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              maxLength={20}
            />
          </div>

          <div>
            <label>画像</label>
            {imagePreview
              ? <img src={imagePreview} alt="preview" className="image-preview" onClick={() => fileRef.current.click()} style={{ cursor: 'pointer' }} />
              : <div className="image-placeholder" onClick={() => fileRef.current.click()}>
                  {uploading ? '⏳' : '📷'}
                </div>
            }
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            <button className="btn btn-ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => fileRef.current.click()} disabled={uploading}>
              {uploading ? 'アップロード中...' : '画像を選ぶ'}
            </button>
          </div>

          <div>
            <label>効果を選ぶ</label>
            {selectedEffect ? (
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>選択中（もう一度タップで変更）</div>
                <button
                  className="effect-btn selected"
                  onClick={() => setSelectedEffect(null)}
                  style={{ width: '100%' }}
                >
                  <span style={{ color: CATEGORY_COLORS[EFFECT_MAP[selectedEffect]?.category], fontSize: 14 }}>
                    {EFFECT_MAP[selectedEffect]?.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>
                    {EFFECT_MAP[selectedEffect]?.description}
                  </span>
                </button>
              </div>
            ) : (
              Object.entries(effectByCategory).map(([cat, effects]) => (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: CATEGORY_COLORS[cat], marginBottom: 4, fontWeight: 700 }}>
                    {CATEGORY_LABELS[cat]}
                  </div>
                  <div className="effect-grid">
                    {effects.map(e => {
                      const addable = canAddCard(cards, e.id);
                      return (
                        <button
                          key={e.id}
                          className="effect-btn"
                          onClick={() => addable && setSelectedEffect(e.id)}
                          title={addable ? e.description : `上限に達しました（${e.deckLimit}枚まで）`}
                          style={addable ? {} : { opacity: 0.35, cursor: 'not-allowed' }}
                          disabled={!addable}
                        >
                          <span style={{ color: CATEGORY_COLORS[e.category] }}>{e.label}</span>
                          {e.deckLimit && <span style={{ fontSize: 9, color: 'var(--muted)', display: 'block' }}>各{e.deckLimit}枚まで</span>}
                          {!addable && <span style={{ fontSize: 9, color: '#e74c3c', display: 'block' }}>上限</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button className="btn btn-primary" onClick={handleAddCard} disabled={uploading || !imageUrl}>
            {editingId ? '✏ 保存' : '＋ デッキに追加'}
          </button>
          {editingId && (
            <button className="btn btn-ghost" onClick={resetForm} style={{ marginTop: 4 }}>
              キャンセル
            </button>
          )}
        </div>

        {/* 右: デッキ一覧 */}
        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>{currentDeck?.name || 'デッキ'}（{cards.length}枚）</h3>
          {cards.length === 0
            ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>まだカードがありません</p>
            : <div className="deck-list">
                {cards.map(card => (
                  <div key={card.id} className="deck-card-item">
                    <img src={card.imageUrl} alt="" className="deck-card-img" />
                    <div style={{ flex: 1 }}>
                      {card.name && (
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{card.name}</div>
                      )}
                      <div className="deck-card-effect" style={{ color: CATEGORY_COLORS[EFFECT_MAP[card.effect]?.category] }}>
                        {EFFECT_MAP[card.effect]?.label || card.effect}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleEdit(card)}>
                        編集
                      </button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleRemove(card.id)}>
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}
