/* ── Character pools ──────────────────────────────────── */
const POOL = {
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower:   'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
};

/* ── Helper: cryptographic random int [0, max) ─────────── */
function randInt(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}

/* ── Classify a character ──────────────────────────────── */
function classify(ch) {
  if (POOL.upper.includes(ch))   return 'upper';
  if (POOL.lower.includes(ch))   return 'lower';
  if (POOL.numbers.includes(ch)) return 'numbers';
  return 'symbols';
}

/* ── Core generator ────────────────────────────────────── */
function generatePassword(length, useUpper, useLower, useNumbers, useSymbols) {
  const activePools = [];
  if (useUpper)   activePools.push({ key: 'upper',   chars: POOL.upper });
  if (useLower)   activePools.push({ key: 'lower',   chars: POOL.lower });
  if (useNumbers) activePools.push({ key: 'numbers', chars: POOL.numbers });
  if (useSymbols) activePools.push({ key: 'symbols', chars: POOL.symbols });
  if (activePools.length === 0) return '';

  let password = '';
  let lastType = null;

  for (let i = 0; i < length; i++) {
    // Exclude the previous category to avoid consecutive same-type chars
    const available = activePools.length === 1
      ? activePools
      : activePools.filter(function(p) { return p.key !== lastType; });

    const pool = available[randInt(available.length)];
    let ch = null;
    let attempts = 0;

    while (ch === null && attempts < 60) {
      const candidate = pool.chars[randInt(pool.chars.length)];
      attempts++;
      if (password.length > 0) {
        const last = password[password.length - 1];
        // Reject repeated identical character (e.g. same digit twice)
        if (candidate === last) continue;
        // Reject same letter different case adjacency (Vv / vV)
        if (candidate.toLowerCase() === last.toLowerCase() && candidate !== last) continue;
      }
      ch = candidate;
    }

    // Fallback (virtually never reached)
    if (ch === null) ch = pool.chars[randInt(pool.chars.length)];

    password += ch;
    lastType = pool.key;
  }
  return password;
}

/* ── Strength score (0-4) ──────────────────────────────── */
function calcStrength(pwd) {
  if (!pwd || pwd.length < 6) return 0;
  let s = 0;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (pwd.length >= 16) s = Math.min(s + 1, 4);
  return Math.min(s, 4);
}

/* ── Escape HTML entities ──────────────────────────────── */
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Render colour-coded password ──────────────────────── */
function renderPassword(pwd) {
  if (!pwd) return '&mdash; Pulsa Generar &mdash;';
  const map = { upper: 'c-upper', lower: 'c-lower', numbers: 'c-digit', symbols: 'c-symbol' };
  return pwd.split('').map(function(ch) {
    return '<span class="' + map[classify(ch)] + '">' + escHtml(ch) + '</span>';
  }).join('');
}

/* ── Strength UI data ──────────────────────────────────── */
const SINFO = [
  { label: '&mdash;',  color: '#64748b' },
  { label: 'D&eacute;bil', color: '#ef4444' },
  { label: 'Regular',  color: '#f59e0b' },
  { label: 'Buena',    color: '#84cc16' },
  { label: 'Fuerte',   color: '#10b981' }
];

/* ── Update strength bar UI ────────────────────────────── */
function updateStrength(pwd) {
  const score = calcStrength(pwd);
  document.querySelectorAll('.bar').forEach(function(bar, i) {
    bar.className = 'bar';
    if (i < score) bar.classList.add('s' + score);
  });
  const lbl = document.getElementById('strengthLabel');
  lbl.innerHTML   = SINFO[score].label;
  lbl.style.color = SINFO[score].color;
}

/* ── DOM references ────────────────────────────────────── */
const slider      = document.getElementById('lengthSlider');
const lengthBadge = document.getElementById('lengthBadge');
const passText    = document.getElementById('passText');
const passDisplay = document.getElementById('passDisplay');
const btnGenerate = document.getElementById('btnGenerate');
const btnCopy     = document.getElementById('btnCopy');
const toast       = document.getElementById('toast');

let currentPassword = '';

/* ── SVG icons (inline strings) ───────────────────────── */
const ICON_CLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="10" height="13" rx="2"/><path d="M5 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

/* ── Slider: update badge + track fill ─────────────────── */
slider.addEventListener('input', function() {
  lengthBadge.textContent = slider.value;
  const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.background =
    'linear-gradient(to right, #7c3aed ' + pct + '%, #2a2a4a ' + pct + '%)';
});
slider.dispatchEvent(new Event('input'));

/* ── Sync toggle .active class on checkbox change ──────── */
document.querySelectorAll('.toggle-item input[type="checkbox"]').forEach(function(chk) {
  chk.addEventListener('change', function() {
    chk.closest('.toggle-item').classList.toggle('active', chk.checked);
  });
});

/* ── Generate ──────────────────────────────────────────── */
function generate() {
  const len  = parseInt(slider.value, 10);
  const useU = document.getElementById('chkUpper').checked;
  const useL = document.getElementById('chkLower').checked;
  const useN = document.getElementById('chkNumbers').checked;
  const useS = document.getElementById('chkSymbols').checked;

  if (!useU && !useL && !useN && !useS) {
    passText.innerHTML = '<span style="color:#ef4444">&#9888; Selecciona al menos un tipo</span>';
    currentPassword = '';
    updateStrength('');
    return;
  }

  currentPassword = generatePassword(len, useU, useL, useN, useS);
  passText.innerHTML = renderPassword(currentPassword);

  passDisplay.classList.add('highlight');
  setTimeout(function() { passDisplay.classList.remove('highlight'); }, 600);

  updateStrength(currentPassword);
}

btnGenerate.addEventListener('click', generate);

/* ── Copy ──────────────────────────────────────────────── */
function copyPassword() {
  if (!currentPassword) return;

  const finish = function() {
    showToast();
    btnCopy.innerHTML = ICON_CHECK;
    setTimeout(function() { btnCopy.innerHTML = ICON_CLIP; }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(currentPassword).then(finish);
  } else {
    // Fallback for older browsers / file:// protocol
    const ta = document.createElement('textarea');
    ta.value = currentPassword;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    finish();
  }
}

btnCopy.addEventListener('click', copyPassword);

// Enter / Space on the display box also copies
passDisplay.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') copyPassword();
});

/* ── Toast ──────────────────────────────────────────────── */
let toastTimer;
function showToast() {
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2200);
}

/* ── Keyboard shortcuts: G = generate, C = copy ────────── */
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT') return;
  if (e.key.toLowerCase() === 'g') generate();
  if (e.key.toLowerCase() === 'c' && currentPassword) copyPassword();
});

/* ── Auto-generate on page load ─────────────────────────── */
generate();
