const KEY = 'card_battle_deck';

export function loadDeck() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
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
  const LIMITED = ['invincible', 'absolute_defense'];
  if (LIMITED.includes(effect)) {
    return !deck.some(c => c.effect === effect);
  }
  return true;
}
