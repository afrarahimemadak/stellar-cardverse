/**
 * CardVerse Soroban Contract deployment script.
 * Deploys, initializes and configures the contract on Stellar testnet.
 *
 * Usage: node scripts/deploy-contract.mjs
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Use cargo-installed stellar CLI v26
const STELLAR = process.env.STELLAR_CLI || 'stellar';
const NETWORK = 'testnet';
const SOURCE_KEY = 'mykey';

function run(cmd) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { stdio: 'pipe' }).toString().trim();
}

function stellarInvoke(contractId, fn, args = '') {
  return run(
    `"${STELLAR}" contract invoke --id "${contractId}" --source ${SOURCE_KEY} --network ${NETWORK} -- ${fn} ${args}`
  );
}

console.log('=== CardVerse Contract Deployer ===\n');

// 1. Fund the source account
console.log('1. Funding source account…');
run(`"${STELLAR}" keys fund ${SOURCE_KEY} --network ${NETWORK}`);

// 2. Build contract
console.log('2. Building contract…');
run(`cd "${ROOT}/contracts" && "${STELLAR}" contract build`);

// 3. Deploy
console.log('3. Deploying contract to testnet…');
const deployOut = run(
  `cd "${ROOT}/contracts" && "${STELLAR}" contract deploy ` +
  `--wasm "target/wasm32v1-none/release/cardverse.wasm" ` +
  `--source ${SOURCE_KEY} --network ${NETWORK}`
);
const CONTRACT_ID = deployOut.split('\n').pop().trim();
console.log(`   Contract ID: ${CONTRACT_ID}`);

// 4. Get XLM SAC address
console.log('4. Getting native XLM SAC address…');
const XLM_SAC = run(`"${STELLAR}" contract id asset --asset native --network ${NETWORK}`);
console.log(`   XLM SAC: ${XLM_SAC}`);

// 5. Get admin public key
const ADMIN_PUBLIC = run(`"${STELLAR}" keys address ${SOURCE_KEY}`);

// 6. Initialize contract
console.log('5. Initializing contract…');
stellarInvoke(CONTRACT_ID, 'initialize', `--admin "${ADMIN_PUBLIC}" --treasury "${ADMIN_PUBLIC}" --xlm_token "${XLM_SAC}"`);

// 7. Set rarity prices (in stroops: 1 XLM = 10_000_000)
console.log('6. Setting rarity prices…');
const prices = {
  Common: 100_000_000,       // 10 XLM
  Rare: 500_000_000,         // 50 XLM
  Epic: 1_500_000_000,       // 150 XLM
  Legendary: 5_000_000_000,  // 500 XLM
};
for (const [rarity, price] of Object.entries(prices)) {
  console.log(`   ${rarity}: ${price} stroops (${price / 10_000_000} XLM)`);
  stellarInvoke(CONTRACT_ID, 'set_price', `--rarity "${rarity}" --price "${price}"`);
}

// 8. Write .env
console.log('7. Writing .env…');
const envPath = path.join(ROOT, '.env');
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

function setEnvVar(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (regex.test(content)) return content.replace(regex, line);
  return content + `\n${line}`;
}

envContent = setEnvVar(envContent, 'NEXT_PUBLIC_CARDVERSE_CONTRACT_ID', CONTRACT_ID);
envContent = setEnvVar(envContent, 'NEXT_PUBLIC_XLM_SAC', XLM_SAC);
envContent = setEnvVar(envContent, 'NEXT_PUBLIC_SOROBAN_RPC_URL', 'https://soroban-testnet.stellar.org');
fs.writeFileSync(envPath, envContent);

console.log('\n✅ Deployment complete!\n');
console.log(`Contract ID:  ${CONTRACT_ID}`);
console.log(`XLM SAC:      ${XLM_SAC}`);
console.log(`Admin:        ${ADMIN_PUBLIC}`);
console.log('\nAdd to .env:');
console.log(`NEXT_PUBLIC_CARDVERSE_CONTRACT_ID=${CONTRACT_ID}`);
