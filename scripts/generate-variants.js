#!/usr/bin/env node
/**
 * Adds three missing rarity variants for every character in data/cards.json.
 *
 * Goal: each character has all 4 rarity tiers (Common, Rare, Epic, Legendary)
 *       as distinct asset codes. The original entry stays as the "primary"
 *       (its rarity is unchanged); the missing tiers are appended with
 *       suffixes C / R / E / L.
 *
 * Idempotent: skips characters that already have all 4 tiers.
 */

const fs = require('fs');
const path = require('path');

const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'];
const SUFFIX = { Common: 'C', Rare: 'R', Epic: 'E', Legendary: 'L' };

const CARDS_PATH = path.join(__dirname, '..', 'data', 'cards.json');
const data = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));

const allCodes = new Set(data.cards.map((c) => c.code));

// First pass: assign characterKey + primary flag to existing entries
const charKeyByCode = new Map();
const charVariants = new Map(); // characterKey -> Map<rarity, code>

for (const card of data.cards) {
  let key = card.characterKey;
  if (!key) {
    if (card.primary === false) {
      throw new Error(`Card ${card.code} marked non-primary but has no characterKey`);
    }
    key = card.code.toLowerCase();
    card.characterKey = key;
    card.primary = true;
  }
  charKeyByCode.set(card.code, key);
  if (!charVariants.has(key)) charVariants.set(key, new Map());
  charVariants.get(key).set(card.rarity, card.code);
}

// Second pass: generate missing variants per character
const newCards = [];
for (const [key, variants] of charVariants.entries()) {
  const primary = data.cards.find((c) => c.characterKey === key && c.primary);
  if (!primary) continue;

  for (const rarity of RARITIES) {
    if (variants.has(rarity)) continue;
    const newCode = primary.code + SUFFIX[rarity];
    if (allCodes.has(newCode)) {
      throw new Error(`Code collision: ${newCode} for character ${primary.name} (${key})`);
    }
    if (newCode.length > 12) {
      throw new Error(`Code too long: ${newCode} (${newCode.length} chars > 12)`);
    }
    allCodes.add(newCode);
    variants.set(rarity, newCode);
    const newCard = {
      code: newCode,
      characterKey: key,
      primary: false,
      name: primary.name,
      category: primary.category,
      series: primary.series,
      rarity,
      image: primary.image,
    };
    if (primary.team) newCard.team = primary.team;
    newCards.push(newCard);
  }
}

data.cards = [...data.cards, ...newCards];

console.log(`Existing characters: ${charVariants.size}`);
console.log(`New variants added:  ${newCards.length}`);
console.log(`Total cards now:     ${data.cards.length}`);

fs.writeFileSync(CARDS_PATH, JSON.stringify(data, null, 2));
console.log(`Wrote ${CARDS_PATH}`);
