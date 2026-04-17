import { EFFECT_MAP } from './gameConstants';

const KEY = 'card_battle_decks';
const LEGACY_KEY = 'card_battle_deck';

export const MAX_DECK_SIZE = 15;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const store = JSON.parse(raw);
      if (store.decks && Array.isArray(store.decks)) return store;
    }
    // 旧フォーマットからマイグレーション
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const cards = JSON.parse(legacy);
      if (Array.isArray(cards) && cards.length > 0) {
        const deck = { id: generateId(), name: 'デッキ1', cards };
        const store = { decks: [deck], activeDeckId: deck.id };
        localStorage.setItem(KEY, JSON.stringify(store));
        localStorage.removeItem(LEGACY_KEY);
        return store;
      }
    }
  } catch {}
  return { decks: [], activeDeckId: null };
}

function saveStore(store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function loadAllDecks() {
  return getStore().decks;
}

export function getActiveDeck() {
  const store = getStore();
  const found = store.decks.find(d => d.id === store.activeDeckId);
  return found || store.decks[0] || null;
}

export function setActiveDeck(id) {
  const store = getStore();
  store.activeDeckId = id;
  saveStore(store);
}

export function createDeck(name) {
  const store = getStore();
  const deck = { id: generateId(), name: name || `デッキ${store.decks.length + 1}`, cards: [] };
  store.decks.push(deck);
  if (!store.activeDeckId) store.activeDeckId = deck.id;
  saveStore(store);
  return deck;
}

export function renameDeck(id, name) {
  const store = getStore();
  const deck = store.decks.find(d => d.id === id);
  if (deck && name.trim()) {
    deck.name = name.trim();
    saveStore(store);
  }
}

export function deleteDeck(id) {
  const store = getStore();
  store.decks = store.decks.filter(d => d.id !== id);
  if (store.activeDeckId === id) {
    store.activeDeckId = store.decks[0]?.id || null;
  }
  saveStore(store);
  return store;
}

export function saveDeckCards(deckId, cards) {
  const store = getStore();
  const deck = store.decks.find(d => d.id === deckId);
  if (deck) {
    deck.cards = cards;
    saveStore(store);
  }
}

function cleanCards(cards) {
  return cards.filter(c => EFFECT_MAP[c.effect] && c.imageUrl);
}

export function addCard(cards, card) {
  return [...cards, { ...card, id: generateId() }];
}

export function removeCard(cards, cardId) {
  return cards.filter(c => c.id !== cardId);
}

export function canAddCard(cards, effect) {
  if (cards.length >= MAX_DECK_SIZE) return false;
  const limit = EFFECT_MAP[effect]?.deckLimit;
  if (limit == null) return true;
  return cards.filter(c => c.effect === effect).length < limit;
}

// LobbyPage用: アクティブデッキのカード配列を返す
export function loadDeck() {
  const deck = getActiveDeck();
  if (!deck) return [];
  return cleanCards(deck.cards);
}
