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
  BASE_DAMAGE,
  INITIAL_HP,
  HAND_SIZE,
  POISON_HIT_RATE,
  PARALYSIS_HIT_RATE,
  randomHeal,
  randomPoisonDot,
  hitRoll,
};
