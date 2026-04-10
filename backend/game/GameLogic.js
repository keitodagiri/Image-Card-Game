// 属性相性テーブル: key が攻撃属性、value が「有利に取れる」防御属性
const ATTRIBUTE_ADVANTAGE = {
  fire: 'grass',
  water: 'fire',
  grass: 'water',
  dark: 'light',
  light: 'dark',
};

/**
 * 属性倍率を返す
 * attackAttr: 攻撃カードの属性
 * defenderAttr: 防御側プレイヤーの現在属性（最後に使った爆発カードの属性）
 */
function getAttributeMultiplier(attackAttr, defenderAttr) {
  if (!attackAttr || !defenderAttr) return 1;
  if (ATTRIBUTE_ADVANTAGE[attackAttr] === defenderAttr) return 2;
  if (ATTRIBUTE_ADVANTAGE[defenderAttr] === attackAttr) return 0.5;
  return 1;
}

const BASE_DAMAGE = {
  explosion: 25,
  invincible: 40,
  poison_dot: 8, // 使用しない（randomPoisonDotで代替）
};

const POISON_DOT_MIN = 8;
const POISON_DOT_MAX = 20;

const HEAL_MIN = 10;
const HEAL_MAX = 25;
const INITIAL_HP = 100;
const HAND_SIZE = 5;
const POISON_HIT_RATE = 0.70;
const PARALYSIS_HIT_RATE = 0.60;

function randomHeal() {
  return Math.floor(Math.random() * (HEAL_MAX - HEAL_MIN + 1)) + HEAL_MIN;
}

function randomPoisonDot() {
  return Math.floor(Math.random() * (POISON_DOT_MAX - POISON_DOT_MIN + 1)) + POISON_DOT_MIN;
}

function hitRoll(rate) {
  return Math.random() < rate;
}

module.exports = {
  getAttributeMultiplier,
  BASE_DAMAGE,
  INITIAL_HP,
  HAND_SIZE,
  POISON_HIT_RATE,
  PARALYSIS_HIT_RATE,
  randomHeal,
  randomPoisonDot,
  hitRoll,
};
