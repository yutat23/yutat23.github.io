/* ==========================================================================
   yutat23.com — メインスクリプト
   構成: 星空 / ピクセル惑星 / 流れ星 / ポートフォリオ一覧
   ========================================================================== */

const homeView = document.getElementById("home-view");

/* --------------------------------------------------------------------------
   星空
   -------------------------------------------------------------------------- */
const STAR_COUNT = 200;
const STAR_SIZES = [1, 1, 1, 2, 2, 3]; // 小さい星ほど出やすくする

function initStars() {
  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement("div");
    star.className = "star";
    const size = STAR_SIZES[Math.floor(Math.random() * STAR_SIZES.length)];
    star.style.width = size + "px";
    star.style.height = size + "px";
    star.style.setProperty(
      "--max-opacity",
      (0.4 + Math.random() * 0.6).toFixed(2)
    );
    star.style.top = Math.random() * 100 + "%";
    star.style.left = Math.random() * 100 + "%";
    star.style.animationDuration = Math.random() * 2 + 1 + "s";
    star.style.animationDelay = Math.random() * 5 + "s";
    homeView.appendChild(star);
  }
}

/* --------------------------------------------------------------------------
   ピクセル惑星
   -------------------------------------------------------------------------- */
const PLANET_TYPES = [
  { size: 20, color: "#00eeee" },
  { size: 16, color: "#b22222", craters: true },
  { size: 18, color: "#f4a460", craters: true },
  { size: 30, color: "#ffa500", ring: true },
  { size: 26, color: "#ff6347" },
  { size: 32, color: "#4682b4", craters: true },
  { size: 34, color: "#0fe060" },
];

// factor < 1 で暗く、> 1 で白に近づける
function shadeColor(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) =>
    factor <= 1
      ? Math.round(v * factor)
      : Math.round(v + (255 - v) * (factor - 1));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

// 惑星本体を1pxずつ描く。左上光源からの距離で明暗を付ける
function drawPlanetBody(ctx, { res, r, ringPad, color, craters }) {
  // クレーターの位置とサイズを事前に決める(惑星中心からの相対座標)
  const craterList = craters
    ? Array.from({ length: 3 }, () => ({
        x: (Math.random() - 0.5) * res * 0.9,
        y: (Math.random() - 0.5) * res * 0.9,
        r: r * (0.15 + Math.random() * 0.15),
      }))
    : [];

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const dx = x - r + 0.5;
      const dy = y - r + 0.5;
      if (dx * dx + dy * dy > r * r) continue;
      const lx = dx + r * 0.4;
      const ly = dy + r * 0.4;
      const d = Math.sqrt(lx * lx + ly * ly) / r;
      let factor;
      if (d < 0.5) factor = 1.35;
      else if (d < 1.05) factor = 1;
      else if (d < 1.45) factor = 0.72;
      else factor = 0.5;
      if (
        craterList.some((c) => (dx - c.x) ** 2 + (dy - c.y) ** 2 <= c.r * c.r)
      ) {
        factor *= 0.72;
      }
      ctx.fillStyle = shadeColor(color, factor);
      ctx.fillRect(x + ringPad, y, 1, 1);
    }
  }
}

// 土星風のリングを描く。上半分は惑星の裏に隠し、下半分だけ手前に重ねる
function drawRing(ctx, canvas, { r, ringPad, color }) {
  const cx = canvas.width / 2;
  const aOuter = r + ringPad * 0.9;
  const aInner = r + ringPad * 0.3;
  const flat = 0.32; // リングのつぶれ具合
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const ex = x - cx + 0.5;
      const ey = y - r + 0.5;
      const vOuter = (ex / aOuter) ** 2 + (ey / (aOuter * flat)) ** 2;
      const vInner = (ex / aInner) ** 2 + (ey / (aInner * flat)) ** 2;
      if (vOuter > 1 || vInner < 1) continue;
      const onPlanet = ex * ex + ey * ey <= r * r;
      if (onPlanet && ey < 0) continue;
      ctx.fillStyle = shadeColor(color, ey < 0 ? 1.25 : 1.5);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// メッセージと重ならないランダムな位置に惑星を置く
function placePlanet(canvas, cssW, cssH) {
  const msgRect = document.getElementById("message").getBoundingClientRect();
  const margin = 20;
  const maxX = window.innerWidth - cssW - margin;
  const maxY = window.innerHeight - cssH - margin;
  const MAX_ATTEMPTS = 50; // 置き場所がない画面サイズでも無限ループしないよう上限を設ける

  let x, y;
  let attempts = 0;
  do {
    x = margin + Math.random() * maxX;
    y = margin + Math.random() * maxY;
    attempts++;
  } while (
    attempts < MAX_ATTEMPTS &&
    x + cssW > msgRect.left &&
    x < msgRect.right &&
    y + cssH > msgRect.top &&
    y < msgRect.bottom
  );

  canvas.style.left = x + "px";
  canvas.style.top = y + "px";
}

function createPixelPlanet({ size, color, ring, craters }) {
  const res = Math.floor(size / 2); // 描画解像度(ピクセル数)
  const r = res / 2;
  const ringPad = ring ? Math.round(res * 0.6) : 0;

  const canvas = document.createElement("canvas");
  canvas.width = res + ringPad * 2;
  canvas.height = res;
  canvas.className = "pixel-planet";
  const cssW = canvas.width * 2; // CSS上は2倍に拡大してドット感を出す
  const cssH = canvas.height * 2;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.style.setProperty(
    "--float-duration",
    (7 + Math.random() * 6).toFixed(1) + "s"
  );
  canvas.style.setProperty(
    "--float-delay",
    (-Math.random() * 10).toFixed(1) + "s"
  );
  homeView.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  drawPlanetBody(ctx, { res, r, ringPad, color, craters });
  if (ring) {
    drawRing(ctx, canvas, { r, ringPad, color });
  }
  placePlanet(canvas, cssW, cssH);
}

function initPlanets() {
  // Webフォント読み込み後にメッセージの実寸を測って惑星を配置する
  document.fonts.ready.then(() => {
    PLANET_TYPES.forEach(createPixelPlanet);
  });
}

/* --------------------------------------------------------------------------
   流れ星(動きを減らす設定のときは出さない)
   -------------------------------------------------------------------------- */
function initShootingStar() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  const shootingStar = document.createElement("div");
  shootingStar.className = "shooting-star";
  homeView.appendChild(shootingStar);

  function launch() {
    shootingStar.style.left = Math.random() * 70 + "%";
    shootingStar.style.top = Math.random() * 40 + "%";
    shootingStar.classList.remove("is-active");
    void shootingStar.offsetWidth; // アニメーションを頭から再生し直す
    shootingStar.classList.add("is-active");
    setTimeout(launch, 6000 + Math.random() * 14000);
  }
  setTimeout(launch, 3000 + Math.random() * 5000);
}

/* --------------------------------------------------------------------------
   ポートフォリオ一覧
   -------------------------------------------------------------------------- */
const CATEGORY_ORDER = [
  "Webアプリケーション",
  "CLI",
  "GUIアプリケーション",
  "ライブラリ",
];

function createExternalLink(href, text) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = text;
  return a;
}

function createSep(text) {
  const sep = document.createElement("span");
  sep.className = "sep";
  sep.textContent = text;
  return sep;
}

function renderItem(item) {
  const li = document.createElement("li");
  li.className = "portfolio-item";
  li.appendChild(createExternalLink(item.url, item.name));
  if (item.siteUrl) {
    li.appendChild(createSep("·"));
    li.appendChild(createExternalLink(item.siteUrl, item.siteUrl));
  }
  if (item.description) {
    li.appendChild(createSep("—"));
    const desc = document.createElement("span");
    desc.textContent = item.description;
    li.appendChild(desc);
  }
  return li;
}

// カテゴリごとにグループ化し、CATEGORY_ORDER の順 → 残りの順で返す
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

function initPortfolio() {
  const worldLink = document.getElementById("world-link");
  const backLink = document.getElementById("back-link");
  const portfolioSection = document.getElementById("portfolio-section");
  const portfolioList = document.getElementById("portfolio-list");

  function togglePortfolio() {
    const isOpen = portfolioSection.classList.toggle("is-visible");
    worldLink.textContent = isOpen ? "WORKS" : "WORLD";
    worldLink.setAttribute("aria-expanded", isOpen);
    portfolioSection.setAttribute("aria-hidden", !isOpen);
    homeView.classList.toggle("is-portfolio-open", isOpen);
  }

  function disableWorldLink() {
    worldLink.disabled = true;
  }

  worldLink.addEventListener("click", (e) => {
    e.preventDefault();
    togglePortfolio();
  });
  backLink.addEventListener("click", (e) => {
    e.preventDefault();
    togglePortfolio();
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      portfolioSection.classList.contains("is-visible")
    ) {
      togglePortfolio();
    }
  });

  fetch("portfolio.json")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`portfolio.json の取得に失敗しました (${res.status})`);
      }
      return res.json();
    })
    .then((items) => {
      if (items.length === 0) {
        disableWorldLink();
        return;
      }
      groupByCategory(items).forEach(({ category, items: catItems }) => {
        const heading = document.createElement("div");
        heading.className = "portfolio-category";
        heading.textContent = category;
        portfolioList.appendChild(heading);

        const ul = document.createElement("ul");
        ul.className = "portfolio-list";
        catItems.forEach((item) => ul.appendChild(renderItem(item)));
        portfolioList.appendChild(ul);
      });
    })
    .catch(disableWorldLink);
}

/* --------------------------------------------------------------------------
   起動
   -------------------------------------------------------------------------- */
initStars();
initPlanets();
initShootingStar();
initPortfolio();
