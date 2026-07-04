/* ==========================================================================
   yutat23.dev — MOTHER2(EARTHBOUND)風Ver スクリプト
   構成: 背景 / 効果音 / メッセージ / コマンドメニュー / WORKS / 入力 / 起動
   ========================================================================== */

const $ = (id) => document.getElementById(id);

/* --------------------------------------------------------------------------
   状態
   state: "msg"(メッセージ表示中) / "menu"(コマンド選択) / "works"(一覧)
   -------------------------------------------------------------------------- */
let state = "msg";

/* --------------------------------------------------------------------------
   サイケデリック戦闘背景
   低解像度キャンバスにポスタライズしたプラズマを描き、CSSで引き伸ばす
   -------------------------------------------------------------------------- */
const BACKGROUND_PALETTES = {
  cosmic: [
    "#180848",
    "#31107a",
    "#5a2ca0",
    "#2f64c8",
    "#1fa0b4",
    "#2fc878",
    "#8ce03c",
    "#f0e858",
  ],
  sanctuary: [
    "#100018",
    "#300028",
    "#681030",
    "#a82838",
    "#e05030",
    "#f09828",
    "#f0d850",
    "#fff0a0",
  ],
  otherworldly: [
    "#001820",
    "#003848",
    "#075c60",
    "#148c78",
    "#60b858",
    "#c8d850",
    "#d85888",
    "#782878",
  ],
};

let backgroundPalette = [];
let redrawBackground = null;
let backgroundTime = 0;

function selectBackgroundPalette(name) {
  const colors = BACKGROUND_PALETTES[name] || BACKGROUND_PALETTES.cosmic;
  backgroundPalette = colors.map((hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  if (redrawBackground) redrawBackground();
}

selectBackgroundPalette("cosmic");

function initBackground() {
  const canvas = $("bg");
  const W = 128;
  const H = 112;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(W, H);

  // 毎フレームのsqrtを避けるため中心からの距離を先に作る
  const dist = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - W / 2;
      const dy = y - H / 2;
      dist[y * W + x] = Math.sqrt(dx * dx + dy * dy);
    }
  }

  function draw(tms) {
    backgroundTime = tms;
    const t = tms / 1000;
    let p = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v =
          Math.sin(x * 0.1 + t * 0.8) +
          Math.sin(y * 0.14 - t * 0.6) +
          Math.sin((x + y) * 0.07 + t * 1.1) +
          Math.sin(dist[y * W + x] * 0.11 - t * 1.4);
        const idx =
          Math.floor(((v + 4) / 8) * backgroundPalette.length * 2) %
          backgroundPalette.length;
        const c = backgroundPalette[idx];
        img.data[p++] = c[0];
        img.data[p++] = c[1];
        img.data[p++] = c[2];
        img.data[p++] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  redrawBackground = () => draw(backgroundTime);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    redrawBackground();
    return;
  }
  (function loop(tms) {
    draw(tms);
    requestAnimationFrame(loop);
  })(0);
}

/* --------------------------------------------------------------------------
   効果音(WebAudioの矩形波でファミコン風ビープ)
   -------------------------------------------------------------------------- */
let audioCtx = null;
let soundOn = true;

// AudioContextを必要になった時点で作る(自動再生制限対策)
function ensureAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return null;
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function beep(freq, dur = 0.05, vol = 0.03) {
  if (!soundOn) return;
  if (!ensureAudio()) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

const sfx = {
  blip: () => beep(1200, 0.03, 0.015), // 文字送り
  move: () => beep(880, 0.04), // カーソル移動
  ok: () => {
    beep(660, 0.05);
    setTimeout(() => beep(990, 0.07), 60);
  },
  cancel: () => beep(330, 0.06),
  // 打撃(ノイズ + 低音でドスッという音)
  hit: () => {
    if (!soundOn || !ensureAudio()) return;
    playNoise(audioCtx, audioCtx.currentTime, 0.09, 300, 0.07);
    beep(90, 0.1, 0.06);
  },
  // PSI発動(ピッチが駆け上がる不思議スイープ)
  psi: () => {
    if (!soundOn || !ensureAudio()) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  },
};

function initSoundToggle() {
  const btn = $("sound-toggle");
  btn.addEventListener("click", () => {
    soundOn = !soundOn;
    btn.textContent = soundOn ? "SOUND: ON" : "SOUND: OFF";
    if (soundOn) {
      sfx.ok();
      startBgm();
    } else {
      stopBgm();
    }
    btn.blur(); // Enterキーでボタンが再発火しないようにする
  });
}

/* --------------------------------------------------------------------------
   BGM(異世界の敵と戦うようなオリジナル・サイケファンク)
   跳ねる低音、不協和なブラス、うねるシンセ、ダブ風エコーを組み合わせる
   -------------------------------------------------------------------------- */
const DEFAULT_BGM_BPM = 112;
const DEFAULT_BGM_SWING = 0.56;

// 譜面データ: 8分音符×128ステップ(16小節)、数値はMIDIノート番号
// 4小節ごとにパートを追加・変化させ、プリセットにより約26〜34秒で一周する
const N = null;
// prettier-ignore
const COSMIC_BASS = [
  [36, N, 36, 36, 39, N, 42, N], [36, N, 36, 36, 39, 42, 39, 38],
  [32, N, 32, 32, 36, N, 38, N], [31, N, 31, 31, 37, 36, 34, 31],
  [36, N, 36, 39, 42, 36, 39, N], [39, N, 39, 42, 46, 45, 42, 39],
  [32, N, 32, 36, 39, 38, 36, N], [31, 31, 34, 37, 36, 34, 31, 30],
  [36, N, 36, 35, 36, 39, 42, N], [30, N, 30, 33, 36, 39, 36, 33],
  [32, N, 32, 35, 36, 38, 39, N], [35, N, 35, 38, 41, 38, 36, 35],
  [36, 36, 39, 42, 43, 42, 39, 36], [39, 39, 42, 45, 46, 45, 42, 39],
  [30, 30, 33, 36, 42, 39, 36, 33], [31, 34, 37, 36, 34, 31, 30, 35],
].flat();
// リードは長く尾を引くワイル(うなり)
// { m: 音程, len: 長さ(ステップ数), slide: 終点までの半音差 }
// prettier-ignore
const COSMIC_LEAD = [
  [{ m: 75, len: 6, slide: -1 }, N, N, N, N, N, N, N],
  [{ m: 78, len: 4, slide: -3 }, N, N, N, N, N, { m: 72, len: 2, slide: 0 }, N],
  [{ m: 80, len: 6, slide: -2 }, N, N, N, N, N, N, N],
  [{ m: 79, len: 3, slide: -6 }, N, N, N, { m: 73, len: 4, slide: -1 }, N, N, N],
  [{ m: 75, len: 4, slide: 3 }, N, N, N, N, N, { m: 78, len: 2, slide: -1 }, N],
  [{ m: 82, len: 6, slide: -4 }, N, N, N, N, N, N, N],
  [{ m: 80, len: 3, slide: -1 }, N, N, N, { m: 75, len: 3, slide: 2 }, N, N, N],
  [{ m: 79, len: 7, slide: -7 }, N, N, N, N, N, N, N],
  [{ m: 84, len: 5, slide: -2 }, N, N, N, N, N, { m: 78, len: 2, slide: 0 }, N],
  [{ m: 81, len: 3, slide: 3 }, N, N, N, { m: 84, len: 3, slide: -6 }, N, N, N],
  [{ m: 80, len: 6, slide: 1 }, N, N, N, N, N, N, N],
  [{ m: 83, len: 4, slide: -5 }, N, N, N, N, N, { m: 77, len: 2, slide: -1 }, N],
  [{ m: 87, len: 4, slide: -3 }, N, N, N, N, N, { m: 82, len: 2, slide: 0 }, N],
  [{ m: 84, len: 3, slide: 2 }, N, N, N, { m: 87, len: 3, slide: -4 }, N, N, N],
  [{ m: 81, len: 5, slide: 3 }, N, N, N, N, N, { m: 84, len: 2, slide: -2 }, N],
  [{ m: 79, len: 7, slide: -7 }, N, N, N, N, N, N, N],
].flat();

// 高音アルペジオ。序盤は薄く、後半ほど音数を増やす
// prettier-ignore
const COSMIC_ARP = [
  [N, N, N, N, N, N, N, N], [N, N, 72, N, N, N, 78, N],
  [N, N, N, N, 68, N, 74, N], [N, N, 71, N, 77, N, 74, N],
  [72, N, 75, N, 78, N, 75, N], [75, N, 78, N, 82, N, 78, N],
  [68, N, 72, N, 75, N, 72, N], [71, N, 74, N, 77, N, 74, N],
  [72, N, 75, 78, 75, N, 78, 81], [66, N, 69, 72, 75, N, 72, 69],
  [68, N, 72, 74, 77, N, 74, 72], [71, N, 74, 77, 80, N, 77, 74],
  [72, 75, 78, 81, 84, 81, 78, 75], [75, 78, 82, 84, 87, 84, 82, 78],
  [66, 69, 72, 75, 78, 75, 72, 69], [71, 74, 77, 80, 83, 80, 77, 74],
].flat();

// 小節の境目で鳴る異星の鳴き声。メロディーではなく音響的なアクセント
const COSMIC_ALIEN_FX = new Map([
  [0, { m: 55, len: 7, slide: 12 }],
  [30, { m: 68, len: 3, slide: -9 }],
  [64, { m: 51, len: 8, slide: 15 }],
  [94, { m: 72, len: 4, slide: -12 }],
  [120, { m: 58, len: 7, slide: 10 }],
]);

// 不協和音クラスタを裏拍に「ジャッ」と刺す
const CL_A = [60, 66, 71];
const CL_B = [59, 65, 70];
const CL_C = [56, 62, 67];
const CL_D = [55, 61, 66];
// prettier-ignore
const COSMIC_CHORDS = [
  [N, N, N, N, N, CL_A, N, N], [N, N, N, CL_A, N, N, N, CL_B],
  [N, N, N, N, N, CL_C, N, N], [N, N, N, CL_D, N, CL_A, N, CL_B],
  [N, N, CL_A, N, N, CL_A, N, N], [N, N, CL_A, N, N, CL_B, N, CL_A],
  [N, N, CL_C, N, N, CL_C, N, N], [CL_D, N, N, CL_D, N, CL_A, N, CL_B],
  [CL_A, N, N, CL_A, N, N, CL_B, N], [CL_D, N, N, CL_D, N, CL_A, N, N],
  [CL_C, N, N, CL_C, N, N, CL_A, N], [CL_B, N, N, CL_B, N, CL_A, N, CL_B],
  [CL_A, N, CL_A, N, N, CL_B, N, CL_A], [CL_A, N, CL_B, N, N, CL_A, N, CL_B],
  [CL_D, N, CL_D, N, CL_A, N, CL_B, N], [CL_B, N, CL_A, N, CL_B, N, CL_A, CL_B],
].flat();
// k=キック s=スネア h=ハイハット t=タム o=オープンハット c=クラッシュ
// prettier-ignore
const COSMIC_DRUMS = [
  ["k", "t", "s", "k", "k", "t", "s", "h"], ["k", "t", "s", "k", "k", "t", "s", "o"],
  ["k", "t", "s", "k", "k", "t", "s", "h"], ["k", "t", "s", "k", "t", "t", "s", "s"],
  ["kc", "h", "sh", "h", "k", "h", "sh", "o"], ["k", "h", "sh", "kh", "k", "h", "sh", "o"],
  ["k", "h", "sh", "h", "kh", "h", "sh", "h"], ["k", "t", "st", "t", "t", "t", "s", "so"],
  ["kc", "h", "sh", "kh", "k", "h", "sh", "h"], ["k", "h", "sh", "h", "kh", "h", "sh", "o"],
  ["k", "h", "sh", "kh", "k", "h", "sh", "h"], ["k", "t", "s", "kt", "t", "t", "st", "so"],
  ["kc", "h", "sh", "kh", "k", "kh", "sh", "o"], ["k", "kh", "sh", "kh", "k", "kh", "sh", "o"],
  ["k", "h", "sh", "kh", "kt", "h", "st", "h"], ["kt", "t", "st", "t", "kt", "t", "st", "sco"],
].flat();

/* --------------------------------------------------------------------------
   Otherworldly風プリセット
   原曲の旋律は使わず、短い半音進行・トライトーン・低音の応答で雰囲気を作る
   -------------------------------------------------------------------------- */
// prettier-ignore
const OTHERWORLDLY_BASS = [
  [41, N, 41, 44, N, 41, 39, N], [41, 41, N, 47, 46, N, 44, 41],
  [39, N, 39, 42, N, 39, 38, N], [35, N, 35, 41, 39, 38, 35, N],
  [41, N, 44, 41, 47, N, 46, 44], [41, 41, N, 39, 41, 44, N, 47],
  [39, N, 42, 39, 45, N, 44, 42], [35, 35, 41, N, 39, 38, 35, 40],
  [41, N, 41, 47, N, 44, 41, 39], [38, N, 38, 44, 41, N, 40, 38],
  [39, N, 45, 42, 39, N, 38, 35], [35, N, 41, 40, 39, 38, 35, N],
  [41, 41, 44, 47, 46, 44, 41, 39], [38, 38, 41, 44, 47, 44, 41, 38],
  [39, 39, 42, 45, 44, 42, 39, 38], [35, 41, 40, 39, 38, 35, 34, 40],
].flat();

// 主旋律: 不安定な上行フレーズに、低く沈む応答を返す
// prettier-ignore
const OTHERWORLDLY_LEAD = [
  [{ m: 77, len: 2, slide: -1 }, N, N, { m: 80, len: 2, slide: -2 }, N, N, N, N],
  [{ m: 83, len: 3, slide: 1 }, N, N, N, { m: 80, len: 2, slide: -3 }, N, N, N],
  [{ m: 75, len: 2, slide: 0 }, N, N, { m: 78, len: 2, slide: 1 }, N, N, N, N],
  [{ m: 71, len: 4, slide: -5 }, N, N, N, N, N, N, N],
  [{ m: 77, len: 2, slide: 2 }, N, N, { m: 80, len: 2, slide: -1 }, N, N, N, N],
  [{ m: 84, len: 3, slide: -1 }, N, N, N, { m: 83, len: 3, slide: -4 }, N, N, N],
  [{ m: 75, len: 2, slide: 3 }, N, N, { m: 81, len: 2, slide: -2 }, N, N, N, N],
  [{ m: 76, len: 4, slide: -6 }, N, N, N, N, N, { m: 70, len: 2, slide: 1 }, N],
  [{ m: 89, len: 2, slide: -1 }, N, N, { m: 92, len: 2, slide: -2 }, N, N, N, N],
  [{ m: 95, len: 3, slide: -4 }, N, N, N, { m: 88, len: 2, slide: 1 }, N, N, N],
  [{ m: 87, len: 2, slide: 0 }, N, N, { m: 90, len: 2, slide: -3 }, N, N, N, N],
  [{ m: 83, len: 5, slide: -7 }, N, N, N, N, N, N, N],
  [{ m: 77, len: 2, slide: 2 }, N, { m: 80, len: 2, slide: 1 }, N, { m: 83, len: 2, slide: -1 }, N, N, N],
  [{ m: 84, len: 2, slide: -1 }, N, { m: 83, len: 2, slide: -2 }, N, { m: 80, len: 2, slide: -3 }, N, N, N],
  [{ m: 75, len: 2, slide: 3 }, N, { m: 81, len: 2, slide: -1 }, N, { m: 78, len: 2, slide: -4 }, N, N, N],
  [{ m: 71, len: 7, slide: -5 }, N, N, N, N, N, N, N],
].flat();

// 主旋律の隙間に入る、乾いた電子音のカウンターメロディー
// prettier-ignore
const OTHERWORLDLY_ARP = [
  [N, N, N, N, N, N, 68, N], [N, N, 71, N, N, N, 74, N],
  [N, N, N, N, N, 66, N, 69], [N, N, 65, N, 71, N, N, N],
  [N, 68, N, N, 71, N, 74, N], [N, N, 76, N, 74, N, 71, N],
  [N, 66, N, 69, N, N, 72, N], [65, N, 68, N, 71, N, 67, N],
  [68, N, 71, N, 74, 73, N, 71], [N, 70, N, 73, 76, N, 73, N],
  [66, N, 69, 72, N, 69, N, 66], [65, N, 71, 70, N, 68, 67, N],
  [68, 71, N, 74, 77, N, 74, 71], [70, 73, N, 76, 79, N, 76, 73],
  [66, 69, N, 72, 75, N, 72, 69], [65, 68, 71, 74, 73, 71, 68, 67],
].flat();

const OW_A = [65, 71, 76];
const OW_B = [63, 68, 74];
const OW_C = [59, 65, 70];
// prettier-ignore
const OTHERWORLDLY_CHORDS = [
  [N, N, N, N, N, OW_A, N, N], [N, N, OW_A, N, N, N, OW_C, N],
  [N, N, N, N, N, OW_B, N, N], [OW_C, N, N, N, OW_A, N, N, OW_C],
  [N, N, OW_A, N, N, OW_A, N, N], [N, OW_C, N, N, OW_A, N, OW_C, N],
  [N, N, OW_B, N, N, OW_B, N, N], [OW_C, N, N, OW_A, N, N, OW_C, N],
  [OW_A, N, N, OW_A, N, OW_C, N, N], [OW_C, N, N, OW_C, N, OW_A, N, N],
  [OW_B, N, N, OW_B, N, OW_C, N, N], [OW_C, N, OW_A, N, N, OW_C, N, OW_A],
  [OW_A, N, OW_A, N, N, OW_C, N, OW_A], [OW_C, N, OW_A, N, OW_C, N, N, OW_A],
  [OW_B, N, OW_B, N, OW_C, N, OW_A, N], [OW_C, N, OW_A, N, OW_C, N, OW_A, OW_C],
].flat();

const OTHERWORLDLY_ALIEN_FX = new Map([
  [0, { m: 53, len: 7, slide: 11 }],
  [31, { m: 65, len: 3, slide: -8 }],
  [64, { m: 48, len: 8, slide: 17 }],
  [95, { m: 70, len: 4, slide: -11 }],
  [120, { m: 53, len: 7, slide: 12 }],
]);

/* --------------------------------------------------------------------------
   Sanctuary Guardian風プリセット
   原曲のフレーズは使わず、変則アクセント・鋭い短音・急な休符で緊張感を作る
   -------------------------------------------------------------------------- */
// prettier-ignore
const SANCTUARY_BASS = [
  [39, N, 39, 38, 33, N, 38, N], [39, 39, N, 45, N, 44, 38, N],
  [36, N, 36, 42, 41, N, 36, N], [34, N, 40, 39, N, 34, 33, N],
  [39, 39, 45, N, 44, 38, N, 39], [33, N, 39, 38, 33, 32, N, 38],
  [36, 42, N, 41, 36, N, 35, 36], [34, N, 40, 39, 34, N, 33, 32],
  [39, N, 46, 45, 39, N, 38, 33], [38, 38, N, 44, 43, 38, N, 32],
  [36, N, 43, 42, 36, 35, N, 30], [34, 40, 39, N, 34, 33, 32, N],
  [39, 45, 44, 39, 38, 33, 38, N], [36, 42, 41, 36, 35, 30, 35, N],
  [34, 40, 39, 34, 33, 28, 33, 32], [27, 33, 38, 39, 38, 33, 32, 38],
].flat();

// 主旋律: 長音を避け、予測しづらい位置に短い音を置く
// prettier-ignore
const SANCTUARY_LEAD = [
  [{ m: 75, len: 1, slide: 0 }, N, { m: 81, len: 1, slide: -1 }, { m: 80, len: 2, slide: -2 }, N, N, N, N],
  [N, { m: 78, len: 1, slide: 1 }, N, N, { m: 84, len: 2, slide: -5 }, N, N, N],
  [{ m: 72, len: 1, slide: 0 }, N, { m: 78, len: 1, slide: 1 }, N, { m: 77, len: 2, slide: -4 }, N, N, N],
  [N, { m: 70, len: 1, slide: 2 }, N, { m: 76, len: 1, slide: -1 }, N, N, { m: 75, len: 2, slide: -6 }, N],
  [{ m: 87, len: 1, slide: 0 }, { m: 86, len: 1, slide: -1 }, N, { m: 81, len: 2, slide: 2 }, N, N, N, N],
  [N, { m: 78, len: 1, slide: 0 }, { m: 84, len: 1, slide: -2 }, N, N, { m: 80, len: 2, slide: -5 }, N, N],
  [{ m: 84, len: 1, slide: 1 }, N, { m: 77, len: 1, slide: 0 }, { m: 83, len: 1, slide: -1 }, N, N, { m: 78, len: 2, slide: -3 }, N],
  [N, { m: 76, len: 1, slide: -1 }, N, { m: 82, len: 1, slide: -4 }, N, { m: 75, len: 2, slide: -5 }, N, N],
  [{ m: 87, len: 1, slide: 0 }, N, { m: 93, len: 1, slide: -1 }, { m: 92, len: 2, slide: -2 }, N, N, N, N],
  [N, { m: 90, len: 1, slide: 1 }, N, { m: 84, len: 1, slide: 0 }, { m: 89, len: 2, slide: -5 }, N, N, N],
  [{ m: 84, len: 1, slide: 0 }, { m: 90, len: 1, slide: -1 }, N, N, { m: 89, len: 1, slide: -2 }, N, { m: 83, len: 2, slide: -4 }, N],
  [N, { m: 82, len: 1, slide: 0 }, N, { m: 88, len: 1, slide: -3 }, { m: 81, len: 1, slide: 0 }, N, N, N],
  [{ m: 75, len: 1, slide: 0 }, { m: 81, len: 1, slide: -1 }, { m: 80, len: 1, slide: -2 }, N, { m: 78, len: 1, slide: 1 }, N, N, N],
  [{ m: 84, len: 1, slide: -1 }, N, { m: 77, len: 1, slide: 0 }, { m: 83, len: 1, slide: -2 }, N, { m: 76, len: 2, slide: -4 }, N, N],
  [{ m: 82, len: 1, slide: 0 }, { m: 75, len: 1, slide: 2 }, N, { m: 81, len: 1, slide: -1 }, { m: 74, len: 1, slide: 0 }, N, { m: 80, len: 1, slide: -5 }, N],
  [{ m: 75, len: 1, slide: 0 }, N, { m: 81, len: 1, slide: -1 }, N, { m: 74, len: 1, slide: 1 }, { m: 80, len: 1, slide: -2 }, { m: 73, len: 2, slide: -6 }, N],
].flat();

// 金属的なカウンターメロディー。主旋律とは別の拍で割り込む
// prettier-ignore
const SANCTUARY_ARP = [
  [N, 63, N, N, 69, N, 68, N], [N, N, 66, N, N, 72, N, 65],
  [N, 60, N, 66, N, N, 65, N], [58, N, 64, N, 63, N, N, 57],
  [63, N, 69, N, N, 68, N, 62], [N, 57, N, 63, 62, N, 68, N],
  [60, N, 66, N, 65, N, N, 59], [58, 64, N, 63, N, 57, N, 56],
  [75, N, 81, N, 80, N, N, 74], [N, 69, N, 75, 74, N, 80, N],
  [72, N, 78, N, N, 77, N, 71], [70, 76, N, 75, N, 69, 68, N],
  [63, 69, N, 68, 62, N, 68, N], [60, N, 66, 65, N, 59, N, 65],
  [58, 64, 63, N, 57, 63, N, 56], [51, 57, 62, 63, 62, 57, 56, 62],
].flat();

const SG_A = [63, 69, 74];
const SG_B = [60, 66, 71];
const SG_C = [58, 64, 69];
const SG_HIT = [51, 57, 62, 68];
// prettier-ignore
const SANCTUARY_CHORDS = [
  [SG_HIT, N, N, SG_A, N, N, SG_B, N], [N, SG_A, N, N, SG_C, N, N, SG_HIT],
  [SG_B, N, N, SG_B, N, SG_A, N, N], [N, SG_C, N, SG_HIT, N, N, SG_A, N],
  [SG_HIT, N, SG_A, N, N, SG_B, N, SG_A], [N, SG_C, N, N, SG_HIT, N, SG_B, N],
  [SG_B, N, SG_A, N, SG_B, N, N, SG_C], [SG_HIT, N, N, SG_C, N, SG_A, N, N],
  [SG_HIT, N, SG_A, N, N, SG_B, SG_A, N], [N, SG_C, N, SG_HIT, N, N, SG_B, N],
  [SG_B, N, SG_A, N, SG_C, N, N, SG_HIT], [N, SG_C, SG_HIT, N, N, SG_A, N, SG_B],
  [SG_HIT, SG_A, N, SG_B, N, SG_A, N, N], [SG_B, N, SG_C, N, SG_HIT, N, SG_A, N],
  [SG_C, SG_HIT, N, SG_A, SG_B, N, SG_C, N], [SG_HIT, N, SG_A, SG_B, SG_C, SG_A, N, SG_HIT],
].flat();

// 休符を多用し、同じ8分音符でもアクセント位置を小節ごとにずらす
// prettier-ignore
const SANCTUARY_DRUMS = [
  ["kc", "", "s", "k", "", "t", "s", ""], ["k", "t", "", "s", "k", "", "st", "o"],
  ["kc", "", "s", "", "kt", "", "s", "h"], ["", "k", "t", "s", "", "kt", "s", "so"],
  ["kc", "h", "s", "kh", "", "t", "sh", ""], ["k", "", "st", "", "kh", "h", "s", "o"],
  ["", "kt", "s", "h", "k", "", "st", "h"], ["kc", "", "t", "st", "", "kt", "s", "so"],
  ["kc", "h", "sh", "", "kt", "h", "s", ""], ["k", "kh", "", "st", "k", "", "sh", "o"],
  ["", "kt", "sh", "h", "", "k", "st", ""], ["kc", "", "t", "s", "kt", "t", "", "so"],
  ["kc", "kh", "s", "", "kt", "h", "sh", ""], ["k", "", "st", "kh", "", "kt", "s", "o"],
  ["kc", "t", "sh", "", "kt", "st", "h", "t"], ["kc", "t", "st", "kt", "t", "st", "s", "sco"],
].flat();

const SANCTUARY_ALIEN_FX = new Map([
  [0, { m: 46, len: 3, slide: 14 }],
  [32, { m: 58, len: 2, slide: -10 }],
  [64, { m: 51, len: 4, slide: 15 }],
  [96, { m: 63, len: 2, slide: -12 }],
  [124, { m: 46, len: 4, slide: 13 }],
]);

const BGM_TRACKS = {
  cosmic: {
    bpm: 128,
    swing: 0.56,
    bass: COSMIC_BASS,
    lead: COSMIC_LEAD,
    arp: COSMIC_ARP,
    chords: COSMIC_CHORDS,
    drums: COSMIC_DRUMS,
    alienFx: COSMIC_ALIEN_FX,
  },
  otherworldly: {
    bpm: 112,
    swing: 0.56,
    bass: OTHERWORLDLY_BASS,
    lead: OTHERWORLDLY_LEAD,
    arp: OTHERWORLDLY_ARP,
    chords: OTHERWORLDLY_CHORDS,
    drums: COSMIC_DRUMS,
    alienFx: OTHERWORLDLY_ALIEN_FX,
  },
  sanctuary: {
    bpm: 138,
    swing: 0.5,
    bass: SANCTUARY_BASS,
    lead: SANCTUARY_LEAD,
    arp: SANCTUARY_ARP,
    chords: SANCTUARY_CHORDS,
    drums: SANCTUARY_DRUMS,
    alienFx: SANCTUARY_ALIEN_FX,
  },
};

// 勝利するたび cosmic → sanctuary → otherworldly の順に進む
const BGM_TRACK_ORDER = ["cosmic", "sanctuary", "otherworldly"];
let bgmTrackIndex = 0;
let BGM_TRACK_NAME;
let BGM_BPM;
let BGM_SWING;
let BGM_EIGHTH;
let BGM_BASS;
let BGM_LEAD;
let BGM_ARP;
let BGM_CHORDS;
let BGM_DRUMS;
let BGM_ALIEN_FX;

function selectBgmTrack(name) {
  const score = BGM_TRACKS[name] || BGM_TRACKS.otherworldly;
  BGM_TRACK_NAME = BGM_TRACKS[name] ? name : "otherworldly";
  selectBackgroundPalette(BGM_TRACK_NAME);
  BGM_BPM = score.bpm ?? DEFAULT_BGM_BPM;
  BGM_SWING = score.swing ?? DEFAULT_BGM_SWING;
  BGM_EIGHTH = 60 / BGM_BPM / 2;
  BGM_BASS = score.bass;
  BGM_LEAD = score.lead;
  BGM_ARP = score.arp;
  BGM_CHORDS = score.chords;
  BGM_DRUMS = score.drums;
  BGM_ALIEN_FX = score.alienFx;
}

selectBgmTrack(BGM_TRACK_ORDER[bgmTrackIndex]);

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ファミコンの25%デューティ矩形波を再現するPeriodicWave(遅延生成)
let pulseWave = null;
function getPulseWave(ctx) {
  if (pulseWave) return pulseWave;
  const size = 32;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  for (let k = 1; k < size; k++) {
    real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
  }
  pulseWave = ctx.createPeriodicWave(real, imag);
  return pulseWave;
}

// ドラム用のホワイトノイズバッファ(遅延生成)
let noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.5);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// 音程のある音を1つ鳴らす(type: "triangle" / "pulse")
// opts.slide: 半音単位で音の後半にピッチをずらす
// opts.vibrato: ゆらゆらしたビブラートをかける
// opts.sustain: 減衰音ではなくアタック→持続→リリースの長音にする
function playVoice(ctx, midi, t, dur, type, vol, opts = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  if (type === "pulse") {
    osc.setPeriodicWave(getPulseWave(ctx));
  } else {
    osc.type = type;
  }
  const f0 = midiToFreq(midi);
  osc.frequency.setValueAtTime(f0, t);
  if (opts.slide) {
    // 前半は音程を保ち、後半でゆっくりずり下げる(ワイル)
    osc.frequency.setValueAtTime(f0, t + dur * 0.3);
    osc.frequency.exponentialRampToValueAtTime(
      midiToFreq(midi + opts.slide),
      t + dur
    );
  }
  if (opts.vibrato) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = 25; // detuneはセント単位
    lfo.connect(lfoGain).connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + dur);
  }
  if (opts.sustain) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    gain.gain.setValueAtTime(vol, t + Math.max(0.06, dur - 0.12));
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  } else {
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  }
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

// ノイズを1発鳴らす(ハイハット・スネア用)
function playNoise(ctx, t, dur, filterFreq, vol) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur);
}

// キック(サイン波のピッチを急降下させる)
function playKick(ctx, t) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.14);
}

// タム(キックより高めのピッチ降下でドコドコ感を出す)
function playTom(ctx, t) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.1);
  gain.gain.setValueAtTime(0.07, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.13);
}

// ローパスフィルターを素早く開閉する、短いシンセブラス
function playBrassStab(ctx, notes, t, dur) {
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const delay = ctx.createDelay();
  const echoGain = ctx.createGain();

  filter.type = "lowpass";
  filter.Q.value = 5;
  filter.frequency.setValueAtTime(480, t);
  filter.frequency.exponentialRampToValueAtTime(1800, t + 0.035);
  filter.frequency.exponentialRampToValueAtTime(420, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.026, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  delay.delayTime.value = BGM_EIGHTH * 0.75;
  echoGain.gain.value = 0.18;

  filter.connect(gain).connect(ctx.destination);
  gain.connect(delay).connect(echoGain).connect(ctx.destination);

  notes.forEach((m, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = midiToFreq(m);
    osc.detune.value = (i - 1) * 5;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur);
  });
}

// ピッチ、フィルター、ビブラートが同時に動く異星の鳴き声
function playAlienCry(ctx, t, dur, midi, slide) {
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const delay = ctx.createDelay();
  const echoGain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const oscillators = [ctx.createOscillator(), ctx.createOscillator()];
  const endFreq = midiToFreq(midi + slide);

  filter.type = "bandpass";
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(380, t);
  filter.frequency.exponentialRampToValueAtTime(1700, t + dur * 0.45);
  filter.frequency.exponentialRampToValueAtTime(520, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.014, t + 0.08);
  gain.gain.setValueAtTime(0.014, t + dur * 0.65);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

  delay.delayTime.value = BGM_EIGHTH * 1.5;
  echoGain.gain.value = 0.28;
  filter.connect(gain).connect(ctx.destination);
  gain.connect(delay).connect(echoGain).connect(ctx.destination);

  lfo.type = "sine";
  lfo.frequency.value = 4.2;
  lfoGain.gain.value = 70;
  lfo.connect(lfoGain);

  oscillators.forEach((osc, i) => {
    osc.type = i === 0 ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(midiToFreq(midi), t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    osc.detune.value = i === 0 ? -7 : 7;
    lfoGain.connect(osc.detune);
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur);
  });
  lfo.start(t);
  lfo.stop(t + dur);
}

function scheduleBgmStep(ctx, step, t, dur) {
  const bass = BGM_BASS[step];
  if (bass !== N) {
    playVoice(ctx, bass, t, dur * 0.95, "triangle", 0.095);
    playVoice(ctx, bass + 12, t, dur * 0.32, "pulse", 0.007);
  }

  // リードは長音なので開始ステップだけ予約する
  const lead = BGM_LEAD[step];
  if (lead) {
    playVoice(ctx, lead.m, t, lead.len * BGM_EIGHTH, "pulse", 0.024, {
      slide: lead.slide,
      vibrato: true,
      sustain: true,
    });
  }

  const arp = BGM_ARP[step];
  if (arp !== N) {
    playVoice(ctx, arp, t, dur * 0.62, "pulse", 0.0055);
  }

  const chord = BGM_CHORDS[step];
  if (chord) {
    playBrassStab(ctx, chord, t, dur * 0.72);
  }

  const alienFx = BGM_ALIEN_FX.get(step);
  if (alienFx) {
    playAlienCry(
      ctx,
      t,
      alienFx.len * BGM_EIGHTH,
      alienFx.m,
      alienFx.slide
    );
  }

  const drums = BGM_DRUMS[step] || "";
  if (drums.includes("k")) playKick(ctx, t);
  if (drums.includes("t")) playTom(ctx, t);
  if (drums.includes("s")) playNoise(ctx, t, 0.1, 1600, 0.05);
  if (drums.includes("h")) playNoise(ctx, t, 0.035, 6000, 0.02);
  if (drums.includes("o")) playNoise(ctx, t, 0.16, 5000, 0.016);
  if (drums.includes("c")) playNoise(ctx, t, 0.32, 4200, 0.025);
}

const bgm = { timer: null, step: 0, nextTime: 0 };

function startBgm() {
  if (bgm.timer || !soundOn) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  bgm.step = 0;
  bgm.nextTime = ctx.currentTime + 0.1;
  // 25msごとに0.2秒先までまとめて予約するルックアヘッド方式
  bgm.timer = setInterval(() => {
    while (bgm.nextTime < ctx.currentTime + 0.2) {
      const swing = bgm.step % 2 === 0 ? BGM_SWING : 1 - BGM_SWING;
      const dur = BGM_EIGHTH * 2 * swing;
      scheduleBgmStep(ctx, bgm.step % BGM_BASS.length, bgm.nextTime, dur);
      bgm.nextTime += dur;
      bgm.step++;
    }
  }, 25);
}

function stopBgm() {
  if (!bgm.timer) return;
  clearInterval(bgm.timer);
  bgm.timer = null;
}

function advanceBgmTrack() {
  if (bgmTrackIndex >= BGM_TRACK_ORDER.length - 1) return;

  const wasPlaying = Boolean(bgm.timer);
  if (wasPlaying) stopBgm();
  bgmTrackIndex++;
  selectBgmTrack(BGM_TRACK_ORDER[bgmTrackIndex]);
  if (wasPlaying && soundOn) startBgm();
}

function initBgm() {
  // 自動再生制限があるため、最初のキー入力かタップでBGMを開始する
  const start = () => startBgm();
  window.addEventListener("keydown", start, { once: true });
  window.addEventListener("pointerdown", start, { once: true });

  // タブが裏に回ったら止め、戻ったら再開する
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopBgm();
    } else if (soundOn) {
      startBgm();
    }
  });
}

/* --------------------------------------------------------------------------
   メッセージウィンドウ(タイプライター表示 + ▼待ち)
   -------------------------------------------------------------------------- */
const msgText = $("msg-text");
const msgCursor = $("msg-cursor");
let typing = false;
let skipTyping = false;
let confirmResolve = null; // ▼待ちを解除する関数

function typeMessage(text) {
  return new Promise((resolve) => {
    typing = true;
    skipTyping = false;
    msgText.textContent = "";
    msgCursor.classList.add("hidden");
    let i = 0;
    (function step() {
      if (skipTyping) {
        msgText.textContent = text;
        typing = false;
        resolve();
        return;
      }
      i++;
      msgText.textContent = text.slice(0, i);
      if (i % 3 === 0) sfx.blip();
      if (i >= text.length) {
        typing = false;
        resolve();
        return;
      }
      setTimeout(step, 45);
    })();
  });
}

function waitConfirm() {
  msgCursor.classList.remove("hidden");
  return new Promise((resolve) => {
    confirmResolve = () => {
      msgCursor.classList.add("hidden");
      resolve();
    };
  });
}

// メッセージを表示して▼待ちまで行う
async function say(text) {
  state = "msg";
  await typeMessage(text);
  await waitConfirm();
}

// 決定入力(文字送りスキップ or ▼待ち解除)。処理したら true を返す
function advanceMessage() {
  if (typing) {
    skipTyping = true;
    return true;
  }
  if (confirmResolve) {
    const resolve = confirmResolve;
    confirmResolve = null;
    sfx.move();
    resolve();
    return true;
  }
  return false;
}

/* --------------------------------------------------------------------------
   コマンドメニュー(2列グリッド)
   -------------------------------------------------------------------------- */
const cmdWindow = $("cmd-window");
const cmdItems = [...document.querySelectorAll("#cmd-list li")];
let cmdIndex = 0;

function setCmdIndex(i) {
  cmdItems[cmdIndex].classList.remove("selected");
  cmdIndex = (i + cmdItems.length) % cmdItems.length;
  cmdItems[cmdIndex].classList.add("selected");
}

function openMenu() {
  // ドラムが0まで回りきっていたらメニューに戻らず負け処理へ
  if (tryRunDefeat()) return;
  state = "menu";
  cmdWindow.classList.remove("hidden");
  setCmdIndex(cmdIndex);
}

function closeMenu() {
  cmdWindow.classList.add("hidden");
}

const TALK_LINES = [
  "・おれなんかどうせ・・・",
  "・ああああ・・・",
  "・いつもこうだよ・・・",
];
let talkIndex = 0;

// 被弾シェイク(クラスを付け直してアニメーションを頭から再生する)
function shakeEnemy() {
  const enemy = $("enemy");
  enemy.classList.remove("hit");
  void enemy.offsetWidth;
  enemy.classList.add("hit");
  setTimeout(() => enemy.classList.remove("hit"), 400);
}

function waitForEnemyAnimation(enemy, animationName) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(finish, 1000);

    function finish() {
      clearTimeout(timeout);
      enemy.removeEventListener("animationend", onAnimationEnd);
      resolve();
    }

    function onAnimationEnd(event) {
      if (event.target !== enemy || event.animationName !== animationName) return;
      finish();
    }

    enemy.addEventListener("animationend", onAnimationEnd);
  });
}

async function fadeEnemyOut() {
  const enemy = $("enemy");
  enemy.classList.remove("hit", "enemy-reviving", "enemy-defeated");
  void enemy.offsetWidth;
  enemy.classList.add("enemy-defeated");
  await waitForEnemyAnimation(enemy, "enemy-fade-out");
}

async function fadeEnemyIn() {
  const enemy = $("enemy");
  enemy.classList.remove("enemy-defeated", "enemy-reviving");
  void enemy.offsetWidth;
  enemy.classList.add("enemy-reviving");
  await waitForEnemyAnimation(enemy, "enemy-fade-in");
  enemy.classList.remove("enemy-reviving");
}

// PSI発動時の画面フラッシュ(kind: "fire" / "freeze" / "thunder" / 省略=回復の緑)
function psiFlash(kind) {
  const flash = $("flash");
  flash.className = "";
  void flash.offsetWidth;
  if (kind) flash.classList.add(kind);
  flash.classList.add("is-active");
}

// 敵(yutat23)の隠しHP。
const ENEMY_HP_MAX = 1500;
let enemyHp = ENEMY_HP_MAX;

// 撃破演出(敵HPはここで満タンに戻す)
async function enemyDefeated() {
  await say("・yutat23 は たおれた!");
  await fadeEnemyOut();
  await say("・YOU WIN!\n・YOU は 32 の けいけんちをえた");
  await say("・…");
  await say("・……");
  await say("・………");
  advanceBgmTrack();
  await say("・…yutat23 は なにごともなかったかのように\nたちあがった!");
  enemyHp = ENEMY_HP_MAX;
  await fadeEnemyIn();
}

// 反撃のあとに出るランダムなセリフ
const ENEMY_IDLE_LINES = [
  "・yutat23 は ふてきなえみを うかべている...",
  "・yutat23 は くちぶえを ふいている...",
  "・yutat23 は ブツブツ ひとりごとを つぶやいている...",
  "・yutat23 は しずかに コーヒーを すすった。",
  "・yutat23 は つぎの こうげきの けいかくをねっている...",
];

// 敵の攻撃。weightの合計に対する割合で攻撃の種類が選ばれる
const ENEMY_ATTACKS = [
  {
    weight: 65,
    message: "・yutat23 の こうげき!",
    minDamage: 30,
    maxDamage: 50,
  },
  {
    weight: 30,
    message: "・yutat23 が なぐりかかってきた!",
    minDamage: 60,
    maxDamage: 80,
  },
  {
    weight: 5,
    message: "・yutat23 の PKスターストーム!",
    minDamage: 120,
    maxDamage: 190,
  },
];

function chooseEnemyAttack() {
  const totalWeight = ENEMY_ATTACKS.reduce(
    (total, attack) => total + attack.weight,
    0
  );
  let random = Math.random() * totalWeight;

  for (const attack of ENEMY_ATTACKS) {
    random -= attack.weight;
    if (random < 0) return attack;
  }

  return ENEMY_ATTACKS[ENEMY_ATTACKS.length - 1];
}

// 指定確率で敵の攻撃を実行する(通常の敵ターンでは100%)
async function maybeCounter(prob) {
  if (Math.random() >= prob) return;
  const attack = chooseEnemyAttack();
  sfx.hit();
  const counter =
    attack.minDamage +
    Math.floor(Math.random() * (attack.maxDamage - attack.minDamage + 1));
  const newHp = Math.max(0, hpMeter.value - counter);
  hpMeter.setValue(newHp, 10);
  await say(attack.message + "\n・YOU に " + counter + "の ダメージ!");
  // 致命傷でもここでは倒れない。本家と同じく、
  // ドラムロールが0まで回りきる前に回復すれば助かる
  if (newHp === 0) {
    await say("・YOU に ちめいてきな ダメージ!");
  }
  // ランダムなセリフ
  await say(
    ENEMY_IDLE_LINES[Math.floor(Math.random() * ENEMY_IDLE_LINES.length)]
  );
}

// プレイヤーの有効な行動を終え、敵ターンを実行してメニューへ戻す
async function finishBattleTurn() {
  await maybeCounter(1);
  openMenu();
}

/* --------------------------------------------------------------------------
   気絶判定(本家方式)
   ダメージを受けた瞬間ではなく、HPドラムが0まで回りきったら負け
   -------------------------------------------------------------------------- */
let defeatPending = false;

// hpMeterのドラムが0に到達すると呼ばれる
function onHpZero() {
  defeatPending = true;
  tryRunDefeat();
}

// メッセージ表示中なら保留し、手が空いたタイミングで負け処理を始める。
// 保留分はopenMenu()経由でも回収する。開始したらtrueを返す
function tryRunDefeat() {
  if (!defeatPending) return false;
  if (typing || confirmResolve) return false; // メッセージが終わってから
  defeatPending = false;
  closeMenu();
  closePsi();
  worksWindow.classList.add("hidden");
  runDefeat();
  return true;
}

async function runDefeat() {
  await say("・YOU は きずつき たおれた…");
  await say("・たたかいに やぶれた…");
  await say("・…");
  await say("・……");
  await say("・………");
  await say("・「もしまけたら なにか おもしろいもの が ");
  await say("・みれるかと おもった?");
  await say("・ざんねんだが そこまで つくりこんでないんだよね」");
  hpMeter.setValue(STATUS_HP_MAX, 10);
  ppMeter.setValue(STATUS_PP_MAX, 10);
  await say("・YOU は カムバックした!");
  openMenu();
}

/* --------------------------------------------------------------------------
   PSI(選択ウィンドウ + 発動処理)
   -------------------------------------------------------------------------- */
const PSI_LIST = [
  { name: "ファイア α", cost: 6, type: "attack", min: 60, max: 100, flash: "fire" },
  { name: "フリーズ α", cost: 5, type: "attack", min: 135, max: 225, flash: "freeze" },
  { name: "サンダー α", cost: 3, type: "attack", min: 60, max: 80, miss: 0.4, flash: "thunder" },
  { name: "ライフアップ α", cost: 5, type: "heal", min: 75, max: 125 },
  { name: "ライフアップ β", cost: 8, type: "heal", min: 225, max: 375 },
];

const psiWindow = $("psi-window");
const psiListEl = $("psi-list");
let psiItems = [];
let psiIndex = 0;

function setPsiIndex(i) {
  psiItems[psiIndex].classList.remove("selected");
  psiIndex = (i + psiItems.length) % psiItems.length;
  psiItems[psiIndex].classList.add("selected");
}

function openPsi() {
  state = "psi";
  // PPが足りない技を薄く表示する
  psiItems.forEach((li, i) => {
    li.classList.toggle("unaffordable", ppMeter.value < PSI_LIST[i].cost);
  });
  psiWindow.classList.remove("hidden");
  setPsiIndex(psiIndex);
}

function closePsi() {
  psiWindow.classList.add("hidden");
}

async function castPsi(spell) {
  closePsi();
  if (ppMeter.value < spell.cost) {
    sfx.cancel();
    await say("・PPが たりない!");
    openPsi();
    return;
  }
  ppMeter.setValue(ppMeter.value - spell.cost, 10);
  sfx.psi();
  psiFlash(spell.flash);
  await say("・YOUは PSI " + spell.name + "!");

  if (spell.type === "heal") {
    if (hpMeter.value >= STATUS_HP_MAX) {
      await say("・しかし なにも おこらなかった。");
    } else {
      const healHp =
        spell.min + Math.floor(Math.random() * (spell.max - spell.min + 1));
      const reachesMax = hpMeter.value + healHp >= STATUS_HP_MAX;
      const actualHeal = Math.min(healHp, STATUS_HP_MAX - hpMeter.value);
      hpMeter.setValue(hpMeter.value + actualHeal, 10);
      await say(
        reachesMax
          ? "・YOU の HPが まんタンになる!"
          : "・YOU の HPが " + actualHeal + " かいふくする!"
      );
    }
    await finishBattleTurn();
    return;
  }

  // 攻撃PSI
  if (spell.miss && Math.random() < spell.miss) {
    await say("・しかし yutat23 には あたらなかった!");
    await finishBattleTurn();
    return;
  }
  sfx.hit();
  shakeEnemy();
  const dmg =
    spell.min + Math.floor(Math.random() * (spell.max - spell.min + 1));
  enemyHp = Math.max(0, enemyHp - dmg);
  await say("・yutat23 に " + dmg + "の ダメージ!");
  if (enemyHp === 0) {
    await enemyDefeated();
    openMenu();
    return;
  }
  await finishBattleTurn();
}

function initPsi() {
  PSI_LIST.forEach((spell, i) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = spell.name;
    const cost = document.createElement("span");
    cost.className = "psi-cost";
    cost.textContent = "PP " + spell.cost;
    li.append(name, cost);
    li.addEventListener("mouseenter", () => {
      if (state === "psi" && i !== psiIndex) {
        setPsiIndex(i);
        sfx.move();
      }
    });
    li.addEventListener("click", () => {
      if (state !== "psi") return;
      setPsiIndex(i);
      sfx.ok();
      castPsi(spell);
    });
    psiListEl.appendChild(li);
    psiItems.push(li);
  });
}

async function doAction(action) {
  closeMenu();
  sfx.ok();
  switch (action) {
    case "attack": {
      sfx.hit();
      shakeEnemy();
      // 2割でSMAAAASH!!(クリティカル)
      const smash = Math.random() < 0.2;
      const dmg = smash
        ? 100 + Math.floor(Math.random() * 200)
        : 10 + Math.floor(Math.random() * 70);
      enemyHp = Math.max(0, enemyHp - dmg);
      if (smash) {
        await say("SMAAAASH!!\n・yutat23 に " + dmg + "の ダメージ!");
      } else {
        await say("・yutat23 に " + dmg + "の ダメージ!");
      }
      if (enemyHp === 0) {
        await enemyDefeated();
        openMenu();
        return;
      }
      await finishBattleTurn();
      return;
    }
    case "psi": {
      // どの技も使えないほどPPが尽きたらマジックバタフライが助けてくれる
      const minCost = Math.min(...PSI_LIST.map((s) => s.cost));
      if (ppMeter.value < minCost) {
        await say("・PPが たりない!");
        openMenu();
        return;
      }
      openPsi();
      return;
    }
    case "works":
      if (worksItems.length === 0) {
        await say("どうぐばこは からっぽのようだ。");
        openMenu();
        return;
      }
      openWorks();
      return;
    case "github":
      await say("GitHub いきの ドアを あけた!");
      await say("いってらっしゃい!");
      window.open("https://github.com/yutat23", "_blank", "noopener");
      openMenu();
      return;
    case "talk":
      await say(TALK_LINES[talkIndex++ % TALK_LINES.length]);
      await finishBattleTurn();
      return;
    case "check":
      await say("YOUは yutat23をチェックした!" );
      await say("しかし なにもわからなかった..." );
      await finishBattleTurn();
      return;
    case "run":
      await say("にげだした!");
      await say("しかし まわりこまれてしまった!");
      await finishBattleTurn();
      return;
  }
}

function initMenu() {
  cmdItems.forEach((li, i) => {
    li.addEventListener("mouseenter", () => {
      if (state === "menu" && i !== cmdIndex) {
        setCmdIndex(i);
        sfx.move();
      }
    });
    li.addEventListener("click", () => {
      if (state !== "menu") return;
      setCmdIndex(i);
      doAction(li.dataset.action);
    });
  });
}

/* --------------------------------------------------------------------------
   WORKS 一覧
   -------------------------------------------------------------------------- */
const CATEGORY_ORDER = [
  "Webアプリケーション",
  "CLI",
  "GUIアプリケーション",
  "ライブラリ",
];

const worksWindow = $("works-window");
const worksList = $("works-list");
const worksDesc = $("works-desc");
let worksItems = []; // { el, item }
let worksIndex = 0;

function groupByCategory(items) {
  const groups = {};
  items.forEach((item) => {
    const cat = item.category || "その他";
    (groups[cat] ??= []).push(item);
  });
  const ordered = CATEGORY_ORDER.filter((c) => groups[c]);
  const rest = Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c));
  return [...ordered, ...rest].map((cat) => ({
    category: cat,
    items: groups[cat],
  }));
}

function setWorksIndex(i) {
  if (worksItems.length === 0) return;
  worksItems[worksIndex].el.classList.remove("selected");
  worksIndex = (i + worksItems.length) % worksItems.length;
  const { el, item } = worksItems[worksIndex];
  el.classList.add("selected");
  el.scrollIntoView({ block: "nearest" });
  worksDesc.textContent =
    (item.description || "") + (item.siteUrl ? "\n" + item.siteUrl : "");
}

function openWorks() {
  state = "works";
  worksWindow.classList.remove("hidden");
  setWorksIndex(worksIndex);
}

function closeWorks() {
  sfx.cancel();
  worksWindow.classList.add("hidden");
  openMenu();
}

function openWorksItem() {
  sfx.ok();
  window.open(worksItems[worksIndex].item.url, "_blank", "noopener");
}

function initWorks() {
  $("works-close").addEventListener("click", () => {
    if (state === "works") closeWorks();
  });

  fetch("portfolio.json")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`portfolio.json の取得に失敗しました (${res.status})`);
      }
      return res.json();
    })
    .then((items) => {
      groupByCategory(items).forEach(({ category, items: catItems }) => {
        const heading = document.createElement("div");
        heading.className = "works-category";
        heading.textContent = category;
        worksList.appendChild(heading);

        catItems.forEach((item) => {
          const el = document.createElement("div");
          el.className = "works-item";
          el.textContent = item.name;
          const index = worksItems.length;
          el.addEventListener("mouseenter", () => {
            if (state === "works" && index !== worksIndex) {
              setWorksIndex(index);
              sfx.move();
            }
          });
          el.addEventListener("click", () => {
            if (state !== "works") return;
            setWorksIndex(index);
            openWorksItem();
          });
          worksList.appendChild(el);
          worksItems.push({ el, item });
        });
      });
    })
    .catch(() => {
      worksItems = [];
    });
}

/* --------------------------------------------------------------------------
   HP/PPドラムロールメーター
   本家の「回転するカウンタ」を再現。各桁を0-9の帯にして、
   値を一定速度でなめらかに変化させながらtransformで回す
   -------------------------------------------------------------------------- */
function createOdometer(el, numDigits, initial = 0, onZero = null) {
  const BLANK_POS = 12; // 帯の末尾にある空白セルの位置(上位桁のゼロ消し用)
  const strips = [];

  for (let d = 0; d < numDigits; d++) {
    const digit = document.createElement("span");
    digit.className = "odo-digit";
    const strip = document.createElement("span");
    strip.className = "odo-strip";
    // 0-9のあとに0,1を重ねて桁上がりの継ぎ目を隠し、最後に空白を置く
    for (const ch of [..."012345678901", ""]) {
      const cell = document.createElement("span");
      cell.className = "odo-cell";
      cell.textContent = ch;
      strip.appendChild(cell);
    }
    digit.appendChild(strip);
    el.appendChild(digit);
    strips.push(strip);
  }
  strips.reverse(); // strips[i] が 10^i の位になるようにする

  let value = initial; // 表示中の値(小数を含む)
  let target = initial;
  let speed = 60; // 1秒あたりの変化量
  let raf = null;
  let lastT = 0;
  let cellH = 0;

  function render() {
    cellH ||= strips[0].firstChild.offsetHeight;
    const intVal = Math.floor(value);
    for (let i = 0; i < strips.length; i++) {
      const pow = 10 ** i;
      let pos;
      if (i > 0 && intVal < pow) {
        pos = BLANK_POS; // 上位の空き桁は空白にする
      } else if (i === 0) {
        pos = value % 10; // 一の位は常に回り続ける
      } else {
        // 上位桁は下位が9...9を通過する間だけ次の数字へ回る
        const digit = Math.floor(value / pow) % 10;
        const lower = value % pow;
        const carry = lower > pow - 1 ? lower - (pow - 1) : 0;
        pos = digit + carry;
      }
      strips[i].style.transform = `translateY(${-pos * cellH}px)`;
    }
  }

  function tick(now) {
    if (!lastT) lastT = now;
    const dt = (now - lastT) / 1000;
    lastT = now;
    const dir = Math.sign(target - value);
    value += dir * speed * dt;
    if ((dir > 0 && value >= target) || (dir < 0 && value <= target)) {
      value = target;
    }
    render();
    if (value !== target) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
      // ドラムが回りきって0に到達した瞬間を通知する(本家の気絶判定用)
      if (target === 0 && onZero) onZero();
    }
  }

  function setValue(next, newSpeed = 10) {
    target = Math.max(0, next);
    if (newSpeed) speed = newSpeed;
    if (!raf && value !== target) {
      lastT = 0;
      raf = requestAnimationFrame(tick);
    }
  }

  render();
  return {
    setValue,
    get value() {
      return target;
    },
  };
}

const STATUS_HP_MAX = 310;
const STATUS_PP_MAX = 123;
let hpMeter = null;
let ppMeter = null;

function initStatus() {
  hpMeter = createOdometer($("hp-meter"), 3, 0, onHpZero);
  ppMeter = createOdometer($("pp-meter"), 3, 0);
  // 起動演出: 0からドラムロールで回して満タンにする
  hpMeter.setValue(STATUS_HP_MAX, 999);
  ppMeter.setValue(STATUS_PP_MAX, 999);
}

/* --------------------------------------------------------------------------
   入力(キーボード / クリック)
   -------------------------------------------------------------------------- */
function initInput() {
  document.addEventListener("keydown", (e) => {
    const k = e.key;
    const isConfirm = k === "Enter" || k === " " || k === "z" || k === "Z";
    const isCancel = k === "Escape" || k === "x" || k === "X";
    const isArrow = k.startsWith("Arrow");
    if (isConfirm || isCancel || isArrow) e.preventDefault();

    // メッセージ表示中は文字送りだけ受け付ける
    if (typing || confirmResolve) {
      if (isConfirm) advanceMessage();
      return;
    }

    // カーソル移動量: メニューは3列グリッドなので上下は±3
    if (state === "menu") {
      const moves = { ArrowUp: -3, ArrowDown: 3, ArrowLeft: -1, ArrowRight: 1 };
      if (isArrow && k in moves) {
        setCmdIndex(cmdIndex + moves[k]);
        sfx.move();
      } else if (isConfirm) {
        doAction(cmdItems[cmdIndex].dataset.action);
      }
      return;
    }

    if (state === "psi") {
      if (k === "ArrowUp" || k === "ArrowDown") {
        setPsiIndex(psiIndex + (k === "ArrowUp" ? -1 : 1));
        sfx.move();
      } else if (isConfirm) {
        sfx.ok();
        castPsi(PSI_LIST[psiIndex]);
      } else if (isCancel) {
        sfx.cancel();
        closePsi();
        openMenu();
      }
      return;
    }

    if (state === "works") {
      if (k === "ArrowUp" || k === "ArrowDown") {
        setWorksIndex(worksIndex + (k === "ArrowUp" ? -1 : 1));
        sfx.move();
      } else if (isConfirm) {
        openWorksItem();
      } else if (isCancel) {
        closeWorks();
      }
      return;
    }
  });

  // メッセージウィンドウのクリック / タップで文字送り
  $("msg-window").addEventListener("click", () => {
    advanceMessage();
  });

  // アイコンをつつくと怒られて、YOUが反撃を食らう
  $("enemy").addEventListener("click", async () => {
    if (state !== "menu") return;
    closeMenu();
    sfx.cancel();
    await say("・「いたっ!」\n・yutat23 は ちょっと おこった!");
    const counter = 10 + Math.floor(Math.random() * 40);
    const newHp = Math.max(1, hpMeter.value - counter); // つつきでは倒れない
    const actual = hpMeter.value - newHp;
    if (actual === 0) {
      await say("・yutat23 の はんげき!\n・しかし YOU は ひらりと かわした!");
    } else {
      sfx.hit();
      hpMeter.setValue(newHp, 10);
      await say("・yutat23 の はんげき!\n・YOU に " + actual + "の ダメージ!");
    }
    openMenu();
  });
}

/* --------------------------------------------------------------------------
   起動
   -------------------------------------------------------------------------- */
async function boot() {
  initBackground();
  initSoundToggle();
  initBgm();
  initMenu();
  initPsi();
  initWorks();
  initStatus();
  initInput();
  await document.fonts.ready; // フォント確定後にタイプ開始
  await say("yutat23 が ゆくてを ふさぐ...");
  openMenu();
}

boot();
