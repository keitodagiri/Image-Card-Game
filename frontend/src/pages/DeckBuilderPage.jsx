import { useState, useRef } from 'react';
import { EFFECTS, EFFECT_MAP, CATEGORY_COLORS } from '../utils/gameConstants';
import { loadDeck, saveDeck, addCard, removeCard, canAddCard } from '../utils/deckStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function DeckBuilderPage({ onBack }) {
  const [deck, setDeck] = useState(loadDeck);
  const [cardName, setCardName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [selectedEffect, setSelectedEffect] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef();

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
    fileRef.current.value = '';
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
    if (!imageUrl)        { setError('画像をアップロードしてください'); return; }
    if (!selectedEffect)  { setError('効果を選んでください'); return; }

    if (editingId) {
      // 編集モード: 既存カードを更新
      const newDeck = deck.map(c =>
        c.id === editingId
          ? { ...c, name: cardName.trim() || null, imageUrl, effect: selectedEffect }
          : c
      );
      setDeck(newDeck);
      saveDeck(newDeck);
      resetForm();
      return;
    }

    if (!canAddCard(deck, selectedEffect)) {
      setError(`「${EFFECT_MAP[selectedEffect].label}」はデッキに1枚まで`);
      return;
    }
    const newDeck = addCard(deck, {
      name: cardName.trim() || null,
      imageUrl,
      effect: selectedEffect,
    });
    setDeck(newDeck);
    saveDeck(newDeck);
    resetForm();
  }

  function handleRemove(cardId) {
    if (editingId === cardId) resetForm();
    const newDeck = removeCard(deck, cardId);
    setDeck(newDeck);
    saveDeck(newDeck);
  }

  const effectByCategory = EFFECTS.reduce((acc, e) => {
    (acc[e.category] = acc[e.category] || []).push(e);
    return acc;
  }, {});
  const CATEGORY_LABELS = { attack: '攻撃系', heal: '回復系', null: '無効系', reflect: '反射系', special: '特殊系' };

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack}>← 戻る</button>
        <h2>🃏 デッキビルダー</h2>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--muted)' }}>
          {deck.length} 枚（推奨 10〜20）
        </span>
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
              // 選択済み: 選んだ効果だけ表示。タップで選択解除
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
              // 未選択: 追加可能な効果のみ表示
              Object.entries(effectByCategory).map(([cat, effects]) => {
                const available = effects.filter(e => canAddCard(deck, e.id));
                if (available.length === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: CATEGORY_COLORS[cat], marginBottom: 4, fontWeight: 700 }}>
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div className="effect-grid">
                      {available.map(e => (
                        <button
                          key={e.id}
                          className="effect-btn"
                          onClick={() => setSelectedEffect(e.id)}
                          title={e.description}
                        >
                          <span style={{ color: CATEGORY_COLORS[e.category] }}>{e.label}</span>
                          {e.deckLimit && <span style={{ fontSize: 9, color: 'var(--muted)', display: 'block' }}>各1枚まで</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
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
          <h3 style={{ marginBottom: 12 }}>デッキ（{deck.length}枚）</h3>
          {deck.length === 0
            ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>まだカードがありません</p>
            : <div className="deck-list">
                {deck.map(card => (
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
