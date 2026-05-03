#!/usr/bin/env node
/**
 * Creates issuer + distributor testnet accounts with Friendbot,
 * then writes their keys into .env so the rest of the pipeline can use them.
 *
 * Idempotent: if .env already has keys, they are reused.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { StellarSdk, fundWithFriendbot, getServer } = require('../lib/stellar');

const ENV_PATH = path.join(__dirname, '..', '.env');
const ENV_EXAMPLE = path.join(__dirname, '..', '.env.example');

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    if (fs.existsSync(ENV_EXAMPLE)) {
      fs.copyFileSync(ENV_EXAMPLE, ENV_PATH);
      console.log('Created .env from .env.example');
    } else {
      fs.writeFileSync(ENV_PATH, '');
    }
  }
  return fs.readFileSync(ENV_PATH, 'utf8');
}

function setEnvVar(envText, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(envText)) return envText.replace(re, line);
  return envText + (envText.endsWith('\n') || envText.length === 0 ? '' : '\n') + line + '\n';
}

async function ensureFunded(label, secretEnv, publicEnv) {
  let secret = process.env[secretEnv];
  let publicKey = process.env[publicEnv];

  if (!secret || !publicKey) {
    const kp = StellarSdk.Keypair.random();
    secret = kp.secret();
    publicKey = kp.publicKey();
    console.log(`Generated ${label}: ${publicKey}`);
  } else {
    console.log(`Reusing ${label}: ${publicKey}`);
  }

  let exists = false;
  try {
    await getServer().loadAccount(publicKey);
    exists = true;
  } catch (e) {
    exists = false;
  }

  if (!exists) {
    console.log(`Funding ${label} via Friendbot…`);
    await fundWithFriendbot(publicKey);
  } else {
    console.log(`${label} already funded.`);
  }

  return { secret, publicKey };
}

async function main() {
  let envText = loadEnvFile();

  const issuer = await ensureFunded('issuer', 'ISSUER_SECRET', 'ISSUER_PUBLIC');
  const distributor = await ensureFunded('distributor', 'DISTRIBUTOR_SECRET', 'DISTRIBUTOR_PUBLIC');

  envText = setEnvVar(envText, 'ISSUER_PUBLIC', issuer.publicKey);
  envText = setEnvVar(envText, 'ISSUER_SECRET', issuer.secret);
  envText = setEnvVar(envText, 'DISTRIBUTOR_PUBLIC', distributor.publicKey);
  envText = setEnvVar(envText, 'DISTRIBUTOR_SECRET', distributor.secret);
  envText = setEnvVar(envText, 'NEXT_PUBLIC_ISSUER_PUBLIC', issuer.publicKey);
  envText = setEnvVar(envText, 'NEXT_PUBLIC_DISTRIBUTOR_PUBLIC', distributor.publicKey);

  fs.writeFileSync(ENV_PATH, envText);
  console.log('\n.env updated:');
  console.log(`  ISSUER_PUBLIC      = ${issuer.publicKey}`);
  console.log(`  DISTRIBUTOR_PUBLIC = ${distributor.publicKey}`);
  console.log('\nNext: run `npm run mint` to issue card assets.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
