// ========== 0) 页脚年份自动更新 ==========
document.getElementById("y").textContent = new Date().getFullYear();

// ========== 1) Timeline 滚动渐入（IntersectionObserver） ==========
// Scroll reveal for timeline cards
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) e.target.classList.add('show');
  }
}, { threshold: 0.18 });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ========== 2) Utilities Dock：滚动后出现 + 点击展开/收起 + Esc/外部点击关闭 ==========
// ======= Utilities Dock behavior =======
const udock = document.getElementById('udock');
const udockToggle = document.getElementById('udockToggle');

function updateDockVisibility(){
  if (!udock) return;
  const y = window.scrollY || document.documentElement.scrollTop || 0;
  const threshold = Math.floor(window.innerHeight * 0.40); // keep hero clean
  if (y > threshold) udock.classList.add('show');
  else {
    udock.classList.remove('show');
    udock.classList.remove('open');
  }
}

function toggleDock(){
  if (!udock) return;
  udock.classList.toggle('open');
}

function closeDock(){
  if (!udock) return;
  udock.classList.remove('open');
}

udockToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDock();
});

document.addEventListener('click', (e) => {
  if (!udock) return;
  if (!udock.contains(e.target)) closeDock();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDock();
});

window.addEventListener('scroll', updateDockVisibility, { passive: true });
window.addEventListener('resize', updateDockVisibility);
updateDockVisibility();

// ========== 3) New Year 2026 彩蛋：Toast + Sparkles（头像触发/自动弹出） ==========
// ======= New Year 2026 Easter Egg (Apple-style toast) =======
const nyToast = document.getElementById('nyToast');
const nyClose = document.getElementById('nyClose');
const nyCopy = document.getElementById('nyCopy');
const nySpark = document.getElementById('nySpark');
const confetti = document.getElementById('confetti');
const avatar = document.querySelector('.avatar');

const NY_MESSAGE = '恭喜进入地球 Online 2026 新赛季 ✨';

function showToast(){
  if (!nyToast) return;
  nyToast.classList.add('show');
  window.clearTimeout(window.__nyToastTimer);
  window.__nyToastTimer = window.setTimeout(() => {
    nyToast.classList.remove('show');
  }, 5200);
}

function hideToast(){
  if (!nyToast) return;
  nyToast.classList.remove('show');
  window.clearTimeout(window.__nyToastTimer);
}

function shootSparkles(n){
  if (!confetti) return;
  confetti.innerHTML = '';
  confetti.classList.add('show');

  const colors = [
    'rgba(201,178,125,.95)',
    'rgba(138,166,255,.95)',
    'rgba(255,255,255,.85)',
    'rgba(201,178,125,.70)',
    'rgba(138,166,255,.70)'
  ];

  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const left = Math.random() * 100;
    const delay = Math.random() * 0.22;
    const size = 4 + Math.random() * 7;
    const dur = 1.15 + Math.random() * 0.85;
    const dx = (-26 + Math.random() * 52).toFixed(1) + 'px';

    p.style.left = left + 'vw';
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = delay + 's';
    p.style.animationDuration = dur + 's';
    p.style.opacity = '0';
    p.style.setProperty('--dx', dx);
    confetti.appendChild(p);
  }

  window.clearTimeout(window.__nyConfettiTimer);
  window.__nyConfettiTimer = window.setTimeout(() => {
    confetti.classList.remove('show');
    confetti.innerHTML = '';
  }, 1900);
}

function fireNY(){
  showToast();
  shootSparkles(22);
}

nyClose?.addEventListener('click', hideToast);

nySpark?.addEventListener('click', () => {
  showToast();
  shootSparkles(30);
});

nyCopy?.addEventListener('click', async () => {
  try{
    await navigator.clipboard.writeText(NY_MESSAGE);
    nyCopy.textContent = 'Copied ✅';
    window.setTimeout(() => (nyCopy.textContent = 'Copy'), 1200);
  }catch{
    const ta = document.createElement('textarea');
    ta.value = NY_MESSAGE;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    nyCopy.textContent = 'Copied ✅';
    window.setTimeout(() => (nyCopy.textContent = 'Copy'), 1200);
  }
});

let pressTimer = null;
const PRESS_MS = 10;

function startPress(){
  if (!avatar) return;
  if (pressTimer) window.clearTimeout(pressTimer);
  pressTimer = window.setTimeout(() => {
    pressTimer = null;
    fireNY();
  }, PRESS_MS);
}

function cancelPress(){
  if (pressTimer) {
    window.clearTimeout(pressTimer);
    pressTimer = null;
  }
}

avatar?.addEventListener('pointerdown', startPress);
avatar?.addEventListener('pointerup', cancelPress);
avatar?.addEventListener('pointerleave', cancelPress);
avatar?.addEventListener('pointercancel', cancelPress);

try{
  const now = new Date();
  const start = new Date('2026-02-10T00:00:00');
  const end = new Date('2026-03-01T00:00:00');
  if (now >= start && now < end) {
    if (!localStorage.getItem('ny2026_shown')) {
      localStorage.setItem('ny2026_shown', '1');
      window.setTimeout(() => {
        showToast();
        shootSparkles(14);
      }, 800);
    }
  }
}catch{}