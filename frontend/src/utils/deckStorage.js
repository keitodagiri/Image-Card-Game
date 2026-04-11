import { EFFECT_MAP } from './gameConstants';

const KEY = 'card_battle_deck';

export function loadDeck() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const deck = JSON.parse(raw);
    // 無効なエフェクト（削除済み）や画像なしのカードを自動除去
    const cleaned = deck.filter(c => EFFECT_MAP[c.effect] && c.imageUrl);
    if (cleaned.length !== deck.length) {
      localStorage.setItem(KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveDeck(deck) {
  localStorage.setItem(KEY, JSON.stringify(deck));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function addCard(deck, card) {
  return [...deck, { ...card, id: generateId() }];
}

export function removeCard(deck, cardId) {
  return deck.filter(c => c.id !== cardId);
}

/** デッキに追加できるか検証 */
export function canAddCard(deck, effect) {
  const limit = EFFECT_MAP[effect]?.deckLimit;
  if (limit == null) return true;
  const count = deck.filter(c => c.effect === effect).length;
  return count < limit;
}
