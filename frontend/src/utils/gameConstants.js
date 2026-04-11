export const EFFECTS = [
  { id: 'explosion',         label: '攻撃',     category: 'attack',  deckLimit: null, description: '即時25ダメージ' },
  { id: 'poison',            label: '毒',       category: 'attack',  deckLimit: null, description: '70%で命中。毎ターン5〜12のランダムダメージ（永続）' },
  { id: 'paralysis',         label: '麻痺',     category: 'attack',  deckLimit: null, description: '60%で1ターン行動不能にする' },
  { id: 'heal',              label: '回復',     category: 'heal',    deckLimit: 3,    description: 'ランダム量でHP回復（上限100）。デッキに3枚まで' },
  { id: 'explosion_reflect', label: '攻撃反射', category: 'reflect', deckLimit: 1,    description: '攻撃を受けた時、反射するか選択できる。デッキに1枚まで' },
  { id: 'poison_reflect',    label: '毒反射',   category: 'reflect', deckLimit: 1,    description: '毒を受けた時、反射するか選択できる。デッキに1枚まで' },
  { id: 'paralysis_reflect', label: '麻痺反射', category: 'reflect', deckLimit: 1,    description: '麻痺を受けた時、反射するか選択できる。デッキに1枚まで' },
  { id: 'invincible',        label: '無敵技',   category: 'special', deckLimit: 1,    description: '40固定ダメージ。反射無効（絶対防御のみ止められる）。デッキに1枚まで' },
  { id: 'absolute_defense',  label: '絶対防御', category: 'special', deckLimit: 1,    description: '自分のターンに使用。次の攻撃を1回完全に防ぐ（無敵技も含む）。デッキに1枚まで' },
];

export const EFFECT_MAP = Object.fromEntries(EFFECTS.map(e => [e.id, e]));

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
