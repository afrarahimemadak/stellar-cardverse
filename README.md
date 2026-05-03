# Stellar CardVerse

A limited-supply digital collectible card marketplace built on the **Stellar** blockchain. Each card is a real Stellar asset, ownership lives in your wallet, and trading happens through Stellar's built-in decentralized exchange (DEX).

## Concept

CardVerse is the Web3 version of physical collector packs (Pokémon TCG, K-pop photocards, football trading cards, mobile game cards). Every character exists as four scarcity-tiered editions — **Common · Rare · Epic · Legendary** — minted as separate Stellar assets so they can be held, sold, traded, or speculated on independently.

| Tier | Supply | Price |
| --- | --- | --- |
| Common | 1,000 | 10 XLM |
| Rare | 300 | 50 XLM |
| Epic | 100 | 150 XLM |
| Legendary | 10 | 500 XLM |

Scarcity is enforced on-chain by capping the issuer's mint and (eventually) locking the issuing account.

## Catalog (current state, testnet)

200 cards across 4 categories — 50 characters × 4 editions each.

| Category | Characters | Cards | Sub-groups |
| --- | --- | --- | --- |
| 🎤 K-pop | 28 | 112 | BTS · Stray Kids · ATEEZ · TXT |
| ⚡ Pokémon | 8 | 32 | Gen 1 → Gen 4 |
| ⚽ Football | 5 | 20 | Messi · Ronaldo · Neymar · Haaland · Salah |
| 🎮 Game Cards | 9 | 36 | Brawl Stars (Crow, Leon, Spike, Sandy, Gale, Lola, Emz, Darryl, Nita) |

## Architecture

```
┌──────────────┐     mints/locks supply     ┌──────────────┐
│    Issuer    │ ─────────────────────────▶ │ Distributor  │
│  (CardVerse  │       (changeTrust +       │  (sells via  │
│  Official)   │ ◀──── payment + offer ──── │     DEX)     │
└──────────────┘                            └──────┬───────┘
                                                   │ sell offers (XLM)
                                                   ▼
                                       ┌────────────────────┐
                                       │  Stellar built-in  │
                                       │       DEX          │
                                       └─────────┬──────────┘
                                                 │ manageBuyOffer
                                                 ▼
                                          ┌──────────────┐
                                          │  Buyer wallet│
                                          │  (Freighter) │
                                          └──────────────┘
```

- **Issuer account** — the only account allowed to create the card asset. Once locked, total supply is permanently fixed.
- **Distributor account** — holds the entire initial supply, lists every card on the DEX at a fixed XLM price.
- **Trustline** — each buyer must explicitly opt in to a card asset before they can hold it. Created automatically by the buy flow.
- **manageBuyOffer** — the buy flow places a price-matching buy order on the DEX, which immediately fills against the distributor's open sell offer.

Cards = classic Stellar Assets (no Soroban contract required for the marketplace; the DEX handles matching natively).

## Tech stack

- **Next.js 14** (App Router) — frontend pages + API routes
- **React 18** — client components for wallet flow
- **@stellar/stellar-sdk** — chain interaction (Horizon)
- **@stellar/freighter-api** — browser wallet integration
- **Stellar Testnet** — friendbot-funded issuer + distributor

## Project structure

```
stellar-cardverse/
├── app/
│   ├── layout.jsx              Root layout, nav, wallet provider
│   ├── page.jsx                Landing — hero + category tiles
│   ├── globals.css             Theme (Queen Pink, Jaracta, Middle Purple, Beau Blue)
│   ├── marketplace/page.jsx    Filter grid w/ two-tier groups
│   ├── card/[code]/page.jsx    Detail page — shows all 4 variants
│   ├── collection/page.jsx     Connected wallet's holdings
│   ├── admin/page.jsx          Issuer/distributor + full catalog table
│   └── api/
│       ├── cards/              Catalog + per-card live offers
│       ├── holdings/[address]/ User's card balances on chain
│       └── buy/{prepare,submit} Build + submit DEX buy XDR
├── components/
│   ├── WalletProvider.jsx      Freighter context
│   ├── WalletButton.jsx
│   ├── CardTile.jsx            Marketplace tile (image + rarity badge)
│   └── BuyBox.jsx              Per-variant buy form
├── data/cards.json             Card catalog (source of truth)
├── lib/
│   ├── stellar.js              Server + browser SDK helpers
│   └── freighter.js            Wallet client wrapper
├── scripts/
│   ├── setup-issuer.js         Creates testnet issuer + distributor
│   ├── mint-cards.js           Idempotent: trustline + payment + sell-offer
│   ├── generate-variants.js    Adds C/R/E/L variants for new characters
│   ├── burn-cards.js           Removes specific card codes from chain
│   ├── burn-categories.js      Removes everything in a category (chunked tx)
│   └── e2e-test.js             On-chain smoke test (~400 assertions)
└── public/cards/               Card image assets
```

## Card data model

```json
{
  "code": "JUNGKOOK",
  "characterKey": "jungkook",
  "primary": true,
  "name": "Jungkook",
  "category": "K-pop",
  "series": "BTS",
  "rarity": "Legendary",
  "image": "/cards/jk.jpg",
  "hasImage": true
}
```

- `code` — Stellar asset code (1–12 alphanum). Variant suffixes: `C` (Common), `R` (Rare), `E` (Epic), `L` (Legendary). Whichever rarity the character was originally created at keeps the unsuffixed code.
- `characterKey` — groups the four variants of a single character.
- `primary: true` — marks the headline tile shown in marketplace listings.
- `team` (Haikyuu-style three-tier categories) — optional sub-grouping below `series`.
- `hasImage` — when `true`, the UI renders the JPG; when `false`, falls back to a name-on-gradient placeholder.

## Running locally

### Prerequisites

- Node 18.18+
- [Freighter](https://www.freighter.app) browser extension, set to **Testnet**

### First-time setup

```powershell
npm install
copy .env.example .env

# Create issuer + distributor on testnet (Friendbot funds them with 10,000 XLM each)
npm run setup

# Mint every card defined in data/cards.json
npm run mint

# Start the app
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000), connect Freighter, browse the marketplace, and buy a card.

### Iterating on the catalog

1. Add new characters as primary entries in `data/cards.json` (one entry per character).
2. Run `node scripts/generate-variants.js` to fill in the missing C/R/E/L variants.
3. Run `npm run mint` again — the script is idempotent and only mints the new ones.
4. Drop image files into `public/cards/` and update the `image` + `hasImage` fields on the card entries.

### Removing cards

```powershell
# Specific codes
node scripts/burn-cards.js MESSI RONALDO

# An entire category (chunks ops into multiple transactions)
node scripts/burn-categories.js Anime LoL
```

The burn flow cancels open sell offers, returns all balance to the issuer (effective burn), and closes the trustline so the distributor reclaims its 0.5 XLM reserve.

### End-to-end test

```powershell
npm run test:e2e
```

Validates that for every card in `data/cards.json`:

- Issuer + distributor accounts exist on chain
- Distributor balance equals the rarity's full supply
- A live sell offer exists on the DEX at the correct price
- A synthetic Friendbot-funded buyer can complete a real `changeTrust + manageBuyOffer` flow

## Buy flow (what actually happens when a user clicks "Satın Al")

1. **`/api/buy/prepare`** loads the buyer's account, builds a Stellar transaction with:
   - `changeTrust` (only if the buyer hasn't trusted this asset yet)
   - `manageBuyOffer` priced at the rarity's XLM rate
2. The XDR is returned to the browser.
3. **Freighter** signs the XDR with the user's private key.
4. **`/api/buy/submit`** posts the signed XDR to Horizon.
5. The DEX matches the buy offer against the distributor's standing sell offer — funds and the card asset move atomically.
6. Stellar Expert link in the success toast lets the user verify the transaction.

## Theme

| Variable | Hex | Used for |
| --- | --- | --- |
| `--color-bg` | `#F3C8DD` Queen Pink | Page background |
| `--color-card` | `#3A345B` Jaracta | Card body, navbar, primary buttons |
| `--color-line` | `#D1839A` Middle Purple | Borders, dividers |
| `--color-accent` | `#B9CDEE` Beau Blue | Hover, common badge |

Rarity colors: Beau Blue (Common) · Middle Purple (Rare) · Lifted Jaracta (Epic) · Warm Gold (Legendary).

## Known limits

- **Stellar subentry cap (1,000)** — the distributor account can hold at most 1,000 trustlines + sell offers combined. The current catalog (200 cards = 400 subentries) leaves headroom, but pushing past ~500 cards requires either splitting across multiple distributors or burning unused assets first.
- **Issuer is not yet locked** — the master key still has signing weight, meaning the supply is theoretically expandable. Before any production / mainnet move, the issuer should be locked with `setOptions { masterWeight: 0 }`. A helper exists in `lib/stellar.js` (`lockIssuerOp`).
- **Images for non-primary variants are optional** — many characters only have a real image on the primary tier; the other tiers fall back to gradient placeholders.

## Resources

- Issuer (testnet): [GDPTOW4M…IAYI](https://stellar.expert/explorer/testnet/account/GDPTOW4MGDEQ473GJAMR4W6ISQ2WQASWJVK3QFRC5R6QTTYPPZNYIAYI)
- Distributor (testnet): [GC6BICNK…ZM3P](https://stellar.expert/explorer/testnet/account/GC6BICNKO26WUE3YKNR3L625OQDONCGHTPGENJIKAHULLGEZR6R3ZM3P)
- Stellar docs: <https://developers.stellar.org>
- Freighter wallet: <https://www.freighter.app>

## Transaction Example

This project includes transaction tracking for collectible card purchases and ownership updates.

### Sample Transaction Record

```json
{
  "transactionHash": "20e33fb166652ede3053f5e019f0740eee7bc2937a5f18d85d4de1aee79e9973",
  "userName": "Afra",
  "project": "Stellar Cardverse",
  "transactionType": "Card Purchase",
  "cardName": "Legendary Collection Card",
  "status": "Completed",
  "network": "Stellar",
  "date": "2026-05-03"
}
```

### Description

This transaction represents a successful collectible card purchase recorded on the Stellar Cardverse platform. Each transaction is stored with a unique transaction hash to ensure transparency, ownership verification, and secure history tracking.

### Why Transactions Matter

* Tracks card ownership history
* Confirms successful purchases
* Provides secure and transparent records
* Helps users view transaction history
* Supports blockchain-based verification

## License

Private / educational project. Not yet deployed to mainnet.
