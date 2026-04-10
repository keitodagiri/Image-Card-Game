export const EFFECTS = [
  { id: 'explosion',         label: '攻撃',     category: 'attack',   hasAttribute: true,  deckLimit: null, description: '即時ダメージ。属性相性でダメージ変動' },
  { id: 'poison',            label: '毒',       category: 'attack',   hasAttribute: false, deckLimit: null, description: '70%で命中。毎ターン8〜20のランダムダメージ（永続）' },
  { id: 'paralysis',         label: '麻痺',     category: 'attack',   hasAttribute: false, deckLimit: null, description: '60%で1ターン行動不能にする' },
  { id: 'heal',              label: '回復',     category: 'heal',     hasAttribute: false, deckLimit: 3,    description: 'ランダム量でHP回復。デッキに3枚まで' },
  { id: 'explosion_null',    label: '攻撃無効', category: 'null',     hasAttribute: false, deckLimit: 1,    description: '次の攻撃を1回自動で防ぐ。デッキに1枚まで' },
  { id: 'poison_null',       label: '毒無効',   category: 'null',     hasAttribute: false, deckLimit: 1,    description: 'ドロー時に毒状態なら手動で毒を治癒できる。デッキに1枚まで' },
  { id: 'paralysis_null',    label: '麻痺無効', category: 'null',     hasAttribute: false, deckLimit: 1,    description: '次の麻痺を1回自動で防ぐ。デッキに1枚まで' },
  { id: 'explosion_reflect', label: '攻撃反射', category: 'reflect',  hasAttribute: false, deckLimit: 1,    description: '攻撃を受けた時、反射するか選択できる。デッキに1枚まで' },
  { id: 'poison_reflect',    label: '毒反射',   category: 'reflect',  hasAttribute: false, deckLimit: 1,    description: '毒を受けた時、反射するか選択できる。デッキに1枚まで' },
  { id: 'paralysis_reflect', label: '麻痺反射', category: 'reflect',  hasAttribute: false, deckLimit: 1,    description: '麻痺を受けた時、反射するか選択できる。デッキに1枚まで' },
  { id: 'invincible',        label: '無敵技',   category: 'special',  hasAttribute: false, deckLimit: 1,    description: '固定大ダメージ。防御・反射無効（絶対防御のみ止められる）' },
  { id: 'absolute_defense',  label: '絶対防御', category: 'special',  hasAttribute: false, deckLimit: 1,    description: 'すべての攻撃を1回防ぐ（無敵技も含む）' },
];

export const ATTRIBUTES = [
  { id: 'fire',  label: '🔥 火', advantage: '草', disadvantage: '水' },
  { id: 'water', label: '💧 水', advantage: '火', disadvantage: '草' },
  { id: 'grass', label: '🌿 草', advantage: '水', disadvantage: '火' },
  { id: 'dark',  label: '🌑 闇', advantage: '光', disadvantage: '光' },
  { id: 'light', label: '✨ 光', advantage: '闇', disadvantage: '闇' },
];

export const EFFECT_MAP = Object.fromEntries(EFFECTS.map(e => [e.id, e]));
export const ATTR_MAP   = Object.fromEntries(ATTRIBUTES.map(a => [a.id, a]));

export const CATEGORY_COLORS = {
  attack:  '#e74c3c',
  heal:    '#2ecc71',
  null:    '#3498db',
  reflect: '#9b59b6',
  special: '#f39c12',
};

export const MODES = [
  { id: '1v1',           label: '1vs1',         description: '1対1の対戦' },
  { id: 'battle_royale', label: 'バトルロワイヤル', description: '最後の1人が勝ち' },
  { id: 'team',          label: 'チーム戦',      description: 'チームに分かれて対戦' },
];
