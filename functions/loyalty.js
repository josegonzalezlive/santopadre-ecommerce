const WELCOME_POINTS = 10;
const PURCHASE_POINTS_PER_USD = Number(process.env.PURCHASE_POINTS_PER_USD || 1);
const DEPOSIT_POINTS_PER_USD = Number(process.env.DEPOSIT_POINTS_PER_USD || 100);
const SOLANA_USD_RATE = Number(process.env.SOLANA_USD_RATE || 150);
const SOLANA_TREASURY_WALLET = process.env.SOLANA_TREASURY_WALLET || '7pHnSvY3ki2SZ9YgXUt2ZxeS2F3cS5j2qNwgdHTQLFk3';
const POINTS_TTL_DAYS = Number(process.env.POINTS_TTL_DAYS || 365);

const REWARD_CATALOG = {
  bebida: { name: 'Bebida Refrescante Gratis', cost: 1000 },
  'tacos-pastor': { name: 'Tacos al Pastor Gratis', cost: 2800 },
  nachos: { name: 'Nachos Clásicos Gratis', cost: 3500 },
  'birria-ramen': { name: 'Birria Ramen Gratis', cost: 6500 },
  'tacos-birria': { name: 'Tacos de Birria Gratis', cost: 6500 },
  burritos: { name: 'Burrito El Santo Gratis', cost: 7200 },
  'flautas-pollo': { name: 'Flautas de Pollo Gratis', cost: 7500 },
  'tacos-carne': { name: 'Tacos de Asada Gratis', cost: 8500 },
  'cap-trucker': { name: 'Gorra Trucker La Parroquia', cost: 9000 },
  'tshirt-logo': { name: 'Camiseta Classic SantoPadre', cost: 12500 },
  'gift-card-25': { name: 'Gift Card SantoPadre $25', cost: 12500 },
  'gift-card-50': { name: 'Gift Card SantoPadre $50', cost: 25000 }
};

const DEFAULT_TIER_REWARDS = [
  { level: 1, name: 'El Iniciado', reward: 'Bebida Premium Gratis', emoji: '🥤', color: 'var(--lime)', textColor: 'var(--ink)', cogs: 0.75, active: true },
  { level: 2, name: 'El Fiel', reward: 'Postre Sorpresa del Chef', emoji: '🍰', color: '#ff9900', textColor: 'var(--bone)', cogs: 1.2, active: true },
  { level: 3, name: 'El Discípulo', reward: 'Nachos PEQ + Bebida Gratis', emoji: '🏔️', color: '#00ccff', textColor: 'var(--bone)', cogs: 2.93, active: true },
  { level: 4, name: 'El Profeta', reward: 'Tacos (3U) + Bebida Gratis', emoji: '🌮', color: '#cc33ff', textColor: 'var(--bone)', cogs: 4.2, active: true },
  { level: 5, name: 'El Santo', reward: 'Cena Secreta para 2 + 2 Bebidas', emoji: '👑', color: '#ffcc00', textColor: 'var(--ink)', cogs: 3, active: true }
];

function transactionDocId(type, sourceId) {
  return `${type}_${String(sourceId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)}`;
}

function pointsForPurchase(totalUsd) {
  return Math.max(1, Math.floor(Number(totalUsd) * PURCHASE_POINTS_PER_USD));
}

function pointsForDeposit(amountUsd) {
  return Math.round(Number(amountUsd) * DEPOSIT_POINTS_PER_USD);
}

function requiredLamportsForUsd(amountUsd) {
  return Math.floor((Number(amountUsd) / SOLANA_USD_RATE) * 1000000000);
}

function normalizeSolanaCluster(cluster) {
  return cluster === 'devnet' ? 'devnet' : 'mainnet-beta';
}

function normalizeTierReward(raw = {}) {
  const level = Number(raw.level);
  const defaults = DEFAULT_TIER_REWARDS.find((tier) => tier.level === level);
  if (!defaults) throw new Error('Invalid tier level');
  const cogsValue = Number(raw.cogs ?? defaults.cogs);

  return {
    level,
    name: String(raw.name || defaults.name).trim().slice(0, 80),
    reward: String(raw.reward || defaults.reward).trim().slice(0, 140),
    emoji: String(raw.emoji || defaults.emoji).trim().slice(0, 12),
    color: String(raw.color || defaults.color).trim().slice(0, 40),
    textColor: String(raw.textColor || defaults.textColor).trim().slice(0, 40),
    cogs: Number.isFinite(cogsValue) ? Math.round(Math.max(0, Math.min(100, cogsValue)) * 100) / 100 : defaults.cogs,
    active: typeof raw.active === 'boolean' ? raw.active : defaults.active
  };
}

function mergeTierRewards(overrides = []) {
  const byLevel = new Map(overrides.map((tier) => [Number(tier.level), tier]));
  return DEFAULT_TIER_REWARDS.map((defaults) => normalizeTierReward({
    ...defaults,
    ...(byLevel.get(defaults.level) || {})
  }));
}

function normalizeLoyaltyCampaign(raw = {}) {
  const multiplier = Math.max(1, Math.min(5, Number(raw.pointsMultiplier || 1)));
  return {
    active: Boolean(raw.active),
    name: String(raw.name || '').trim().slice(0, 100),
    pointsMultiplier: Math.round(multiplier * 100) / 100,
    startsAt: raw.startsAt ? String(raw.startsAt).trim().slice(0, 40) : '',
    endsAt: raw.endsAt ? String(raw.endsAt).trim().slice(0, 40) : ''
  };
}

function nextPointsExpiry(now = new Date()) {
  const expiresAt = new Date(now.getTime() + POINTS_TTL_DAYS * 24 * 60 * 60 * 1000);
  return expiresAt;
}

module.exports = {
  WELCOME_POINTS,
  PURCHASE_POINTS_PER_USD,
  DEPOSIT_POINTS_PER_USD,
  SOLANA_USD_RATE,
  SOLANA_TREASURY_WALLET,
  POINTS_TTL_DAYS,
  REWARD_CATALOG,
  DEFAULT_TIER_REWARDS,
  transactionDocId,
  pointsForPurchase,
  pointsForDeposit,
  requiredLamportsForUsd,
  normalizeSolanaCluster,
  normalizeTierReward,
  mergeTierRewards,
  normalizeLoyaltyCampaign,
  nextPointsExpiry
};
