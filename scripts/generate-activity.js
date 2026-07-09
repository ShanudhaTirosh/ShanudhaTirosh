'use strict';

/**
 * ShanuFx Discord Activity Card Generator
 * ─────────────────────────────────────────
 * Fetches Discord presence via Lanyard API, correctly resolves
 * Discord CDN app-asset URLs (fixing the "?" icon bug in lanyard.cnrad.dev),
 * embeds all images as base64, and writes assets/discord-activity.svg
 *
 * Usage: DISCORD_ID=<id> node scripts/generate-activity.js
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const DISCORD_ID = process.env.DISCORD_ID || '1477941751699214478';

// ─── Network ──────────────────────────────────────────────────────────────────

function httpGet(url, depth = 0) {
  if (depth > 6) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'ShanuFx-Activity-Generator/2.0' },
    }, res => {
      // Follow redirects (Discord CDN / media proxy uses these)
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
        return resolve(httpGet(res.headers.location, depth + 1));
      }
      const chunks = [];
      res.on('data',  c => chunks.push(c));
      res.on('end',   () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(12_000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

async function fetchJson(url) {
  const r = await httpGet(url);
  return JSON.parse(r.body.toString('utf8'));
}

/**
 * Download image and return a data: URI string, or null on failure.
 * Using base64-embedded images avoids GitHub's camo proxy stripping
 * external Discord CDN references in committed SVG files.
 */
async function toBase64(url) {
  if (!url) return null;
  try {
    const r = await httpGet(url);
    if (r.status !== 200) {
      console.log(`     ↳ HTTP ${r.status} for ${url.slice(0, 80)}`);
      return null;
    }
    const mime = r.headers['content-type']?.split(';')[0].trim() || 'image/png';
    const b64  = r.body.toString('base64');
    console.log(`     ↳ ✅ ${(b64.length * 0.75 / 1024).toFixed(0)} KB  (${mime})`);
    return `data:${mime};base64,${b64}`;
  } catch (e) {
    console.log(`     ↳ ❌ ${e.message}`);
    return null;
  }
}

// ─── Discord asset URL resolution ─────────────────────────────────────────────

/**
 * Converts a Lanyard asset key into an ORDERED LIST of candidate fetchable URLs.
 *
 * Lanyard stores asset keys in three formats:
 *   mp:external/<hash>/...  → Discord media proxy wrapping an external image
 *   spotify:<trackId>       → Spotify album art
 *   <assetKey>              → Discord CDN app asset
 *
 * Discord CDN app-assets are usually .png, but some RPC apps register
 * webp/jpg-only assets. Rather than assume .png and silently show the
 * "?" fallback when that guess is wrong, we return every extension we
 * know Discord serves and let the caller try them in order until one
 * actually resolves (see resolveToBase64 below).
 */
function candidateAssetUrls(applicationId, key) {
  if (!key) return [];

  // External image piped through Discord's media proxy
  if (key.startsWith('mp:external/')) {
    const rest = key.slice('mp:external/'.length);
    return [`https://media.discordapp.net/external/${rest}`];
  }

  // Spotify album art
  if (key.startsWith('spotify:')) {
    return [`https://i.scdn.co/image/${key.slice('spotify:'.length)}`];
  }

  // Already a full URL
  if (/^https?:\/\//.test(key)) return [key];

  // Standard Discord CDN app asset — try each extension Discord actually serves
  if (applicationId) {
    return ['png', 'webp', 'jpg', 'jpeg'].map(
      ext => `https://cdn.discordapp.com/app-assets/${applicationId}/${key}.${ext}`
    );
  }

  return [];
}

/**
 * Tries every candidate URL for an asset key, in order, and returns the
 * first one that actually downloads successfully as a base64 data URI.
 * Returns null if every candidate fails (caller then falls back to the
 * drawn placeholder icon in buildSVG — never a broken "?" image).
 */
async function resolveToBase64(applicationId, key, label) {
  const candidates = candidateAssetUrls(applicationId, key);
  if (candidates.length === 0) return null;

  for (const url of candidates) {
    const result = await toBase64(url);
    if (result) return result;
  }

  console.log(`     ↳ ⚠️  All ${candidates.length} extension(s) failed for ${label} asset "${key}" — using drawn fallback icon`);
  return null;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const X    = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const clip = (s, n) => !s ? '' : s.length > n ? s.slice(0, n - 1) + '…' : s;
const pad2 = n => String(n).padStart(2, '0');

function elapsedStr(startMs) {
  const t = Math.max(0, Date.now() - startMs);
  const h = Math.floor(t / 3_600_000);
  const m = Math.floor((t % 3_600_000) / 60_000);
  const s = Math.floor((t %    60_000) /  1_000);
  return h > 0
    ? `${h}:${pad2(m)}:${pad2(s)} elapsed`
    : `${m}:${pad2(s)} elapsed`;
}

// ─── SVG card generator ───────────────────────────────────────────────────────

const STATUS_COLOR = {
  online:  '#57F287',
  idle:    '#FEE75C',
  dnd:     '#ED4245',
  offline: '#747F8D',
};

const ACT_TYPE_LABEL = {
  0: 'PLAYING',
  1: 'STREAMING',
  2: 'LISTENING TO',
  3: 'WATCHING',
  5: 'COMPETING IN',
};

function buildSVG(presence, imgs) {
  const {
    discord_status = 'offline',
    discord_user,
    activities = [],
  } = presence;

  const sc  = STATUS_COLOR[discord_status] ?? STATUS_COLOR.offline;
  const usr = X(discord_user?.username ?? 'shanudatirosh');

  // Separate custom status (type 4) from activity (type 0/1/2/3/5)
  const customStatus = activities.find(a => a.type === 4) ?? null;
  const mainActivity = activities.find(a => a.type !== 4) ?? null;

  // Dynamic card height
  const SVG_H = mainActivity ? 268 : 108;

  // ── Avatar element ────────────────────────────────────────────────────────
  const avatarEl = imgs.avatar
    ? `<image href="${imgs.avatar}" x="20" y="20" width="64" height="64" clip-path="url(#avatarClip)"/>`
    : `<rect x="20" y="20" width="64" height="64" rx="32" fill="#1e2640"/>
       <text x="52" y="62" font-family="'Segoe UI',Arial,sans-serif" font-size="28"
             fill="#7aa2f7" text-anchor="middle">${usr[0]?.toUpperCase() ?? 'S'}</text>`;

  // ── Custom status text ────────────────────────────────────────────────────
  const customStatusEl = customStatus?.state
    ? `<text x="96" y="89" font-family="'Segoe UI',Arial,sans-serif" font-size="11" fill="#5c6a99"
            dominant-baseline="middle">${X(clip(customStatus.state, 52))}</text>`
    : '';

  // ── Activity section ──────────────────────────────────────────────────────
  let activitySection = '';
  if (mainActivity) {
    const { name, details, state, assets, timestamps, type, application_id } = mainActivity;

    const typeLabel = X(ACT_TYPE_LABEL[type] ?? 'PLAYING');
    const actName   = X(clip(name, 30));
    const detText   = details ? X(clip(details, 44)) : '';
    const staText   = state   ? X(clip(state, 44))   : '';
    const timeText  = timestamps?.start ? X(elapsedStr(timestamps.start)) : '';

    // Large image (app icon)
    const largeEl = imgs.large
      ? `<image href="${imgs.large}" x="24" y="138" width="64" height="64" clip-path="url(#largeClip)"/>`
      : `<rect x="24" y="138" width="64" height="64" rx="10" fill="#1e2640"/>
         <text x="56" y="178" font-family="'Segoe UI',Arial,sans-serif" font-size="26"
               fill="#7aa2f7" text-anchor="middle">${X(name?.[0] ?? '?')}</text>`;

    // Small image badge (bottom-right of large icon)
    const smallEl = imgs.small
      ? `<circle cx="82" cy="196" r="11" fill="#0d1117"/>
         <image href="${imgs.small}" x="73" y="187" width="18" height="18" clip-path="url(#smallClip)"/>`
      : '';

    // Text lines — dynamic Y spacing
    let ty = 156;
    const textLines = [
      `<text x="100" y="${ty}" font-family="'Segoe UI',Arial,sans-serif" font-size="14"
             font-weight="700" fill="#e0e6ff">${actName}</text>`,
    ];
    if (detText) { ty += 20; textLines.push(`<text x="100" y="${ty}" font-family="'Segoe UI',Arial,sans-serif" font-size="11.5" fill="#8892b0">${detText}</text>`); }
    if (staText) { ty += 17; textLines.push(`<text x="100" y="${ty}" font-family="'Segoe UI',Arial,sans-serif" font-size="11.5" fill="#8892b0">${staText}</text>`); }
    if (timeText){ ty += 18; textLines.push(`<text x="100" y="${ty}" font-family="'Segoe UI',Arial,sans-serif" font-size="11"   fill="#4a5a80">${timeText}</text>`); }

    activitySection = `
  <!-- ─ Divider ─ -->
  <line x1="20" y1="110" x2="480" y2="110" stroke="#1a2345" stroke-width="1"/>
  <!-- Activity type label -->
  <text x="24" y="129" font-family="'Segoe UI',Arial,sans-serif" font-size="10"
        font-weight="700" letter-spacing="1.5" fill="#7aa2f7">${typeLabel}</text>
  <!-- App icon (large) -->
  ${largeEl}
  <!-- Badge icon (small) -->
  ${smallEl}
  <!-- Text -->
  ${textLines.join('\n  ')}`;
  }

  // ── Full SVG ──────────────────────────────────────────────────────────────
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="500" height="${SVG_H}" viewBox="0 0 500 ${SVG_H}">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#141b2d"/>
    </linearGradient>
    <!-- Top accent bar gradient (ShanuFx brand) -->
    <linearGradient id="topBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#7aa2f7"/>
      <stop offset="50%"  stop-color="#bb9af7"/>
      <stop offset="100%" stop-color="#7dcfff"/>
    </linearGradient>
    <!-- Clip paths (always defined even if not used) -->
    <clipPath id="avatarClip"><circle cx="52" cy="52" r="32"/></clipPath>
    <clipPath id="largeClip"><rect x="24" y="138" width="64" height="64" rx="10"/></clipPath>
    <clipPath id="smallClip"><circle cx="82" cy="196" r="9"/></clipPath>
  </defs>

  <!-- Card background + border -->
  <rect width="500" height="${SVG_H}" rx="16" fill="url(#bgGrad)" stroke="#1e2640" stroke-width="1.5"/>
  <!-- Top gradient accent bar -->
  <rect width="500" height="3" rx="1.5" fill="url(#topBar)"/>

  <!-- Avatar ring -->
  <circle cx="52" cy="52" r="35" fill="#1a2240" stroke="#262f52" stroke-width="1"/>
  ${avatarEl}

  <!-- Status dot (white ring mask + colored dot) -->
  <circle cx="76" cy="76" r="10" fill="#0d1117"/>
  <circle cx="76" cy="76" r="8"  fill="${sc}"/>

  <!-- Username -->
  <text x="96" y="46" font-family="'Segoe UI',Arial,sans-serif" font-size="17"
        font-weight="700" fill="#e0e6ff">${usr}</text>

  <!-- Status pill -->
  <rect x="96" y="52" width="80" height="19" rx="9.5" fill="${sc}" fill-opacity="0.13"/>
  <circle cx="107" cy="61.5" r="4" fill="${sc}"/>
  <text x="116" y="66" font-family="'Segoe UI',Arial,sans-serif" font-size="10.5"
        font-weight="700" fill="${sc}">${X(discord_status.toUpperCase())}</text>

  <!-- Custom status (type 4) -->
  ${customStatusEl}

  <!-- Activity block -->
  ${activitySection}

  <!-- Footer brand watermark -->
  <text x="250" y="${SVG_H - 9}" font-family="'Segoe UI',Arial,sans-serif" font-size="9"
        fill="#252f50" text-anchor="middle">ShanuFx · Powered by Lanyard</text>
</svg>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⚡ ShanuFx Discord Activity Generator');
  console.log('─'.repeat(44));
  console.log(`📡 Discord ID : ${DISCORD_ID}`);

  // 1. Fetch presence data from Lanyard
  let presence;
  try {
    const resp = await fetchJson(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
    if (!resp.success) throw new Error(JSON.stringify(resp.error));
    presence = resp.data;
  } catch (e) {
    console.error(`\n❌ Lanyard API error: ${e.message}`);
    process.exit(1);
  }

  const { discord_status, discord_user, activities = [] } = presence;
  console.log(`✔  Status     : ${discord_status}`);
  if (activities.length === 0) {
    console.log('   (no activities)');
  } else {
    activities.forEach(a =>
      console.log(`   [type ${a.type}] ${a.name}${a.details ? ' — ' + a.details : ''}`)
    );
  }

  // 2. Resolve + fetch all images as base64
  const mainActivity = activities.find(a => a.type !== 4) ?? null;

  const avatarUrl = discord_user?.avatar
    ? `https://cdn.discordapp.com/avatars/${discord_user.id}/${discord_user.avatar}.png?size=128`
    : null;

  console.log('\n🖼  Resolving + fetching images as base64:');
  console.log(`   avatar → ${avatarUrl ?? '(none)'}`);
  const avatar = await toBase64(avatarUrl);

  let large = null;
  let small = null;
  if (mainActivity) {
    const largeKey = mainActivity.assets?.large_image;
    const smallKey = mainActivity.assets?.small_image;
    console.log(`   large  → key "${largeKey ?? '(none)'}" (app ${mainActivity.application_id ?? 'n/a'})`);
    large = await resolveToBase64(mainActivity.application_id, largeKey, 'large');
    console.log(`   small  → key "${smallKey ?? '(none)'}" (app ${mainActivity.application_id ?? 'n/a'})`);
    small = await resolveToBase64(mainActivity.application_id, smallKey, 'small');
  }

  const images = { avatar, large, small };

  // 4. Build SVG
  const svg = buildSVG(presence, images);

  // 5. Write to assets/discord-activity.svg
  const outDir  = path.resolve(process.cwd(), 'assets');
  const outPath = path.join(outDir, 'discord-activity.svg');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, svg, 'utf8');

  console.log(`\n✅ Saved → ${outPath}`);
  console.log(`   Size: ${(svg.length / 1024).toFixed(1)} KB`);
  console.log(`   Height: ${mainActivity ? 268 : 108}px\n`);
}

main().catch(e => {
  console.error('\n❌ Fatal:', e.message);
  process.exit(1);
});
