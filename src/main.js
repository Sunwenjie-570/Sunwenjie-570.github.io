const canvas = document.querySelector('#cosmos');
const ctx = canvas.getContext('2d', { alpha: false });
const startButton = document.querySelector('#startButton');
const intro = document.querySelector('#intro');
const panel = document.querySelector('#gesturePanel');
const state = document.querySelector('#systemState');
const stateText = document.querySelector('#stateText');
const meterFill = document.querySelector('#meterFill');
const handIcon = document.querySelector('#handIcon');
const gestureName = document.querySelector('#gestureName');
const gestureHint = document.querySelector('#gestureHint');
const ringProgress = document.querySelector('#ringProgress');
const fallback = document.querySelector('#fallback');
const video = document.querySelector('#camera');

let width = 0, height = 0, dpr = 1;
let targetOpenness = .82, openness = .82, cameraActive = false, tracker = null;
let lastDetected = 0, pointerDown = false;
const stars = [];
const dust = [];

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  width = innerWidth; height = innerHeight;
  canvas.width = width * dpr; canvas.height = height * dpr;
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  makeStars();
}

function makeStars() {
  stars.length = 0; dust.length = 0;
  const count = Math.min(1250, Math.floor(width * height / 850));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.pow(Math.random(), .57);
    stars.push({ angle, radius, size: Math.random() * 1.45 + .2, alpha: Math.random() * .72 + .18, twinkle: Math.random() * 6.28, speed: Math.random() * .35 + .08, warm: Math.random() < .08 });
  }
  for (let i = 0; i < 28; i++) dust.push({ x:Math.random(), y:Math.random(), r:60+Math.random()*180, a:.012+Math.random()*.02, hue:185+Math.random()*45 });
}

function draw(time) {
  openness += (targetOpenness - openness) * .075;
  const cx = width * .53, cy = height * .51;
  const maxR = Math.hypot(width, height) * (.22 + openness * .45);
  ctx.fillStyle = '#020306'; ctx.fillRect(0, 0, width, height);
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width,height)*.58);
  core.addColorStop(0, `rgba(38,62,91,${.10 + openness*.06})`);
  core.addColorStop(.28, 'rgba(12,22,38,.1)'); core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core; ctx.fillRect(0,0,width,height);
  for (const cloud of dust) {
    const x=cloud.x*width, y=cloud.y*height;
    const g=ctx.createRadialGradient(x,y,0,x,y,cloud.r*(.65+openness*.55));
    g.addColorStop(0,`hsla(${cloud.hue},75%,58%,${cloud.a})`); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,cloud.r*(.65+openness*.55),0,Math.PI*2); ctx.fill();
  }
  const squeeze = .07 + openness * .93;
  for (const s of stars) {
    const spiral = s.angle + s.radius * 5.7 + time*.000012*(1-s.radius);
    const r = 20 + s.radius * maxR * squeeze;
    const x = cx + Math.cos(spiral) * r * 1.2;
    const y = cy + Math.sin(spiral) * r * .7;
    if (x < -10 || x > width+10 || y < -10 || y > height+10) continue;
    const pulse = .72 + Math.sin(time*.001*s.speed + s.twinkle)*.28;
    const motionSize = s.size * (1 + (1-openness)*(1-s.radius)*1.1);
    ctx.fillStyle = s.warm ? `rgba(255,220,177,${s.alpha*pulse})` : `rgba(210,241,255,${s.alpha*pulse})`;
    ctx.beginPath(); ctx.arc(x,y,motionSize,0,Math.PI*2); ctx.fill();
    if (s.size > 1.35) { ctx.fillStyle=`rgba(133,222,255,${s.alpha*.055})`; ctx.beginPath(); ctx.arc(x,y,motionSize*6,0,Math.PI*2); ctx.fill(); }
  }
  if (openness < .3) {
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,90);
    glow.addColorStop(0,`rgba(160,241,255,${(.3-openness)*.7})`); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow; ctx.fillRect(cx-100,cy-100,200,200);
  }
  updateUI();
  requestAnimationFrame(draw);
}

function updateUI() {
  const p = Math.round(openness*100);
  meterFill.style.width = `${p}%`;
  ringProgress.style.transform = `rotate(${(-45 + openness*270)}deg)`;
  const closed = openness < .48;
  handIcon.classList.toggle('closed', closed);
  gestureName.textContent = closed ? '握紧手掌' : '张开手掌';
  gestureHint.textContent = closed ? '星辰正在回归掌心' : '让星辰向外延展';
}

function opennessFromLandmarks(points) {
  const dist = (a,b) => Math.hypot(points[a].x-points[b].x, points[a].y-points[b].y);
  const palm = Math.max(dist(0,9), .01);
  const fingers = [[8,5],[12,9],[16,13],[20,17]].map(([tip,base]) => dist(tip,base)/palm);
  const thumb = dist(4,2)/palm;
  const score = (fingers.reduce((a,b)=>a+b,0)/4 - .55) / .72;
  return Math.max(0, Math.min(1, score*.82 + Math.max(0,Math.min(1,(thumb-.25)/.55))*.18));
}

async function startTracking() {
  startButton.disabled = true;
  startButton.querySelector('span').textContent = '正在唤醒星河…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:{ideal:640}, height:{ideal:480} }, audio:false });
    video.srcObject = stream; await video.play();
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm');
    const resolver = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
    tracker = await vision.HandLandmarker.createFromOptions(resolver, { baseOptions:{ modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate:'GPU' }, runningMode:'VIDEO', numHands:1, minHandDetectionConfidence:.55, minTrackingConfidence:.5 });
    cameraActive = true; intro.classList.add('ready'); panel.classList.add('visible'); state.classList.add('active'); stateText.textContent = '手势连接中';
    detect();
  } catch (error) {
    cameraActive = false; intro.classList.add('ready'); panel.classList.add('visible'); fallback.style.display='flex';
    stateText.textContent = '演示模式'; startButton.style.display='none';
  }
}

function detect() {
  if (!cameraActive || !tracker) return;
  const result = tracker.detectForVideo(video, performance.now());
  if (result.landmarks?.length) {
    targetOpenness = opennessFromLandmarks(result.landmarks[0]); lastDetected = performance.now();
    stateText.textContent = targetOpenness < .48 ? '检测到收拢' : '检测到张开'; state.classList.add('active');
  } else if (performance.now()-lastDetected > 700) { stateText.textContent='请将手放入画面'; state.classList.remove('active'); }
  requestAnimationFrame(detect);
}

function pointer(on) { pointerDown=on; if (!cameraActive) targetOpenness=on ? .04 : .95; }
addEventListener('pointerdown', e => { if (!e.target.closest('button')) pointer(true); });
addEventListener('pointerup', ()=>pointer(false)); addEventListener('pointercancel', ()=>pointer(false));
addEventListener('keydown', e=>{ if(e.code==='Space'){e.preventDefault();pointer(true)}});
addEventListener('keyup', e=>{ if(e.code==='Space')pointer(false)});
startButton.addEventListener('click', startTracking);
addEventListener('resize', resize);
resize(); requestAnimationFrame(draw);

