(function () {
  "use strict";

  /* ============================================================
     Edit these to match the real shop.
     ============================================================ */
  var CONFIG = {
    email: "hello@magicmobile.example",
    phone: "+910000000000",        // used for the tel: link
    phoneDisplay: "+91 00000 00000",
    whatsapp: "",                  // e.g. "919876543210" (country code, no +). If set, cart reservations go via WhatsApp.
    openHour: 11,                  // 11 am
    closeHour: 24                  // midnight
  };

  var PRODUCTS = [
    { id: "p1",  name: "Nova X12",              cat: "phones",      price: 54999 },
    { id: "p2",  name: "Nova X12 Mini",         cat: "phones",      price: 42999 },
    { id: "p3",  name: "Aster Fold 3",          cat: "phones",      price: 89999 },
    { id: "p4",  name: "Aster Lite",            cat: "phones",      price: 14999 },
    { id: "p5",  name: "Nova X10 (refurbished)", cat: "refurbished", price: 24999 },
    { id: "p6",  name: "Aster S9 (refurbished)", cat: "refurbished", price: 18999 },
    { id: "p7",  name: "Pulse Pro (refurbished)", cat: "refurbished", price: 31999 },
    { id: "p8",  name: "20W fast charger",      cat: "accessories", price: 799 },
    { id: "p9",  name: "Braided USB-C cable",   cat: "accessories", price: 399 },
    { id: "p10", name: "Clear case",            cat: "accessories", price: 499 },
    { id: "p11", name: "Tempered glass, 2-pack", cat: "accessories", price: 299 },
    { id: "p12", name: "Wireless earbuds",      cat: "accessories", price: 2499 }
  ];

  // [low, high] in rupees
  var REPAIR_PRICES = {
    screen:   { entry: [1500, 2500], mid: [3000, 5000],  flagship: [7000, 12000], foldable: [18000, 30000] },
    battery:  { entry: [700, 1200],  mid: [1200, 2000],  flagship: [2500, 4500],  foldable: [6000, 9000] },
    charging: { entry: [500, 900],   mid: [900, 1500],   flagship: [1800, 3000],  foldable: [4000, 6500] },
    water:    { entry: [1200, 2500], mid: [2000, 4000],  flagship: [4000, 8000],  foldable: [8000, 15000] },
    camera:   { entry: [800, 1500],  mid: [1500, 3000],  flagship: [3500, 7000],  foldable: [7000, 12000] }
  };
  var TURNAROUND = {
    screen: "Most screen repairs are done within 2 hours.",
    battery: "Most battery replacements are done the same day.",
    charging: "Most charging port repairs are done within 2 hours.",
    water: "Water damage needs 24–48 hours for diagnosis and drying.",
    camera: "Most camera repairs are done within 24 hours."
  };

  var $ = function (id) { return document.getElementById(id); };
  var inr = function (n) { return "₹" + Number(n).toLocaleString("en-IN"); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Contact details from CONFIG ---------- */
  $("phoneLink").href = "tel:" + CONFIG.phone;
  $("phoneLink").textContent = CONFIG.phoneDisplay;
  $("emailLink").href = "mailto:" + CONFIG.email;
  $("emailLink").textContent = CONFIG.email;

  /* ---------- Mobile menu + current section ---------- */
  var menuBtn = $("menuBtn");
  var navLinks = $("navLinks");
  menuBtn.addEventListener("click", function () {
    var open = navLinks.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.textContent = open ? "Close" : "Menu";
  });
  navLinks.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      navLinks.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.textContent = "Menu";
    });
  });

  if ("IntersectionObserver" in window) {
    var links = {};
    navLinks.querySelectorAll('a[href^="#"]').forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle("current", k === e.target.id); });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(links).forEach(function (id) { var s = $(id); if (s) spy.observe(s); });
  }

  /* ---------- Store hours (always in Bhopal time) ---------- */
  function hourLabel(h) {
    h = h % 24;
    return (h % 12 || 12) + (h < 12 ? " am" : " pm");
  }
  function updateStatus() {
    var hour = parseInt(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23"
    }).format(new Date()), 10);
    var open = hour >= CONFIG.openHour && hour < CONFIG.closeHour;
    document.querySelectorAll("[data-store-status]").forEach(function (el) {
      el.textContent = open ? "Open until " + hourLabel(CONFIG.closeHour) : "Closed, opens at " + hourLabel(CONFIG.openHour);
      el.classList.toggle("status-open", open);
      el.classList.toggle("status-closed", !open);
    });
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ---------- Repair estimate ---------- */
  var DEVICE_NAMES = { entry: "entry-level phone", mid: "mid-range phone", flagship: "flagship phone", foldable: "foldable phone" };
  var ISSUE_NAMES = { screen: "cracked screen", battery: "battery replacement", charging: "charging port", water: "water damage", camera: "camera repair" };
  var shown = [0, 0], tweenId;
  function checked(name) { return document.querySelector('input[name="' + name + '"]:checked').value; }
  function paintEstimate(a, b) { $("estimateValue").textContent = inr(Math.round(a)) + " – " + inr(Math.round(b)); }
  function updateEstimate() {
    var r = REPAIR_PRICES[checked("issue")][checked("device")];
    $("estimateNote").textContent = TURNAROUND[checked("issue")] + " The price is a guide until we've seen the phone.";
    cancelAnimationFrame(tweenId);
    if (reduceMotion || !shown[1]) { shown = r.slice(); paintEstimate(r[0], r[1]); return; }
    var from = shown.slice(), t0 = null;
    (function step(ts) {
      t0 = t0 || ts;
      var p = Math.min((ts - t0) / 450, 1), k = 1 - Math.pow(1 - p, 3);
      shown = [from[0] + (r[0] - from[0]) * k, from[1] + (r[1] - from[1]) * k];
      paintEstimate(shown[0], shown[1]);
      if (p < 1) tweenId = requestAnimationFrame(step);
    })(performance.now());
  }
  document.querySelectorAll('.chips input').forEach(function (i) { i.addEventListener("change", updateEstimate); });
  updateEstimate();

  $("bookRepair").addEventListener("click", function (e) {
    e.preventDefault();
    var r = REPAIR_PRICES[checked("issue")][checked("device")];
    window.location.href = messageLink("Repair booking",
      "I'd like to get my " + DEVICE_NAMES[checked("device")] + " repaired (" + ISSUE_NAMES[checked("issue")] + "). The estimate on your site was " + inr(r[0]) + " – " + inr(r[1]) + ".");
  });

  /* ---------- Shop ---------- */
  var ICONS = {
    phones: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="13" y="5" width="22" height="38" rx="5"/><path d="M21 9h6M22 38h4"/></svg>',
    refurbished: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M38 20a15 15 0 0 0-27-5M10 28a15 15 0 0 0 27 5"/><path d="M11 6v9h9M37 42v-9h-9"/></svg>',
    accessories: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M27 5 11 27h12l-2 16 16-22H25z"/></svg>'
  };

  var list = $("productList");
  var searchInput = $("searchInput");
  var sortSelect = $("sortSelect");
  var filterBtns = document.querySelectorAll("#filters button");
  var activeFilter = "all";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function renderProducts() {
    var q = searchInput.value.trim().toLowerCase();
    var items = PRODUCTS.filter(function (p) {
      return (activeFilter === "all" || p.cat === activeFilter) && (!q || p.name.toLowerCase().indexOf(q) !== -1);
    });
    var sort = sortSelect.value;
    if (sort === "price-asc") items.sort(function (a, b) { return a.price - b.price; });
    if (sort === "price-desc") items.sort(function (a, b) { return b.price - a.price; });
    if (sort === "name") items.sort(function (a, b) { return a.name.localeCompare(b.name); });

    list.textContent = "";
    items.forEach(function (p) {
      var li = el("li");
      var tile = el("div", "tile tile-" + p.cat);
      tile.innerHTML = ICONS[p.cat];
      var body = el("div", "p-body");
      body.appendChild(el("span", "p-name", p.name));
      body.appendChild(el("span", "p-cat", cap(p.cat)));
      var foot = el("div", "p-foot");
      foot.appendChild(el("span", "p-price", inr(p.price)));
      var btn = el("button", "add", "Add to cart");
      btn.setAttribute("aria-label", "Add " + p.name + " to cart");
      btn.addEventListener("click", function () {
        changeQty(p.id, 1);
        btn.textContent = "Added";
        btn.classList.add("done");
        setTimeout(function () { btn.textContent = "Add to cart"; btn.classList.remove("done"); }, 1200);
      });
      foot.appendChild(btn);
      body.appendChild(foot);
      li.appendChild(tile);
      li.appendChild(body);
      list.appendChild(li);
    });
    $("emptyState").hidden = items.length > 0;
  }
  searchInput.addEventListener("input", renderProducts);
  sortSelect.addEventListener("change", renderProducts);
  filterBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      filterBtns.forEach(function (x) { x.classList.remove("active"); x.setAttribute("aria-pressed", "false"); });
      b.classList.add("active");
      b.setAttribute("aria-pressed", "true");
      activeFilter = b.getAttribute("data-filter");
      renderProducts();
    });
  });

  /* ---------- Cart ---------- */
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem("mm_cart")) || {}; } catch (e) { cart = {}; }
  var cartBtn = $("cartBtn");
  var checkoutBtn = $("checkoutBtn");

  function byId(id) { return PRODUCTS.filter(function (p) { return p.id === id; })[0]; }
  function changeQty(id, d) {
    cart[id] = (cart[id] || 0) + d;
    if (cart[id] <= 0) delete cart[id];
    try { localStorage.setItem("mm_cart", JSON.stringify(cart)); } catch (e) {}
    renderCart();
    if (d > 0 && !reduceMotion) { cartBtn.classList.remove("bump"); void cartBtn.offsetWidth; cartBtn.classList.add("bump"); }
  }

  function renderCart() {
    var ids = Object.keys(cart).filter(byId);
    var count = 0, total = 0;
    var ul = $("cartItems");
    ul.textContent = "";

    ids.forEach(function (id) {
      var p = byId(id), q = cart[id];
      count += q; total += p.price * q;
      var li = el("li");
      var r1 = el("div", "row");
      r1.appendChild(el("span", "", p.name));
      r1.appendChild(el("span", "", inr(p.price * q)));
      var r2 = el("div", "row2");
      var qty = el("div", "qty");
      var minus = el("button", "", "−"); minus.setAttribute("aria-label", "Remove one " + p.name);
      var plus = el("button", "", "+"); plus.setAttribute("aria-label", "Add one " + p.name);
      minus.addEventListener("click", function () { changeQty(id, -1); });
      plus.addEventListener("click", function () { changeQty(id, 1); });
      qty.appendChild(minus); qty.appendChild(el("span", "", q)); qty.appendChild(plus);
      var rm = el("button", "link-btn", "Remove");
      rm.addEventListener("click", function () { changeQty(id, -q); });
      r2.appendChild(qty); r2.appendChild(rm);
      li.appendChild(r1); li.appendChild(r2);
      ul.appendChild(li);
    });

    if (!ids.length) ul.appendChild(el("li", "cart-empty", "Your cart is empty."));
    $("cartCount").textContent = count;
    $("cartTotal").textContent = inr(total);
    checkoutBtn.disabled = !ids.length;
  }

  function openCart() {
    document.body.classList.add("cart-open");
    cartBtn.setAttribute("aria-expanded", "true");
    $("cartClose").focus();
  }
  function closeCart() {
    document.body.classList.remove("cart-open");
    cartBtn.setAttribute("aria-expanded", "false");
    cartBtn.focus();
  }
  cartBtn.addEventListener("click", openCart);
  $("cartClose").addEventListener("click", closeCart);
  $("overlay").addEventListener("click", closeCart);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.body.classList.contains("cart-open")) closeCart();
  });

  function messageLink(subject, body) {
    if (CONFIG.whatsapp) return "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(subject + "\n\n" + body);
    return "mailto:" + CONFIG.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  checkoutBtn.addEventListener("click", function () {
    var total = 0;
    var lines = Object.keys(cart).filter(byId).map(function (id) {
      var p = byId(id);
      total += p.price * cart[id];
      return cart[id] + " × " + p.name + " — " + inr(p.price * cart[id]);
    });
    lines.push("", "Total: " + inr(total));
    window.location.href = messageLink("Reservation request", lines.join("\n"));
  });

  /* ---------- Hero phone ---------- */
  var phoneMin = Math.min.apply(null, PRODUCTS.filter(function (p) { return p.cat !== "accessories"; }).map(function (p) { return p.price; }));
  var TABS = {
    buy:    { big: "Phones from " + inr(phoneMin), sub: "New and refurbished phones. Refurbished ones come with a 90-day warranty.", link: "Browse the shop", href: "#shop" },
    sell:   { big: "Get a quote", sub: "Bring your old phone in, or send us the details, for a trade-in or outright sale.", link: "Visit or call us", href: "#visit" },
    repair: { big: "Fixed the same day", sub: "Screens, batteries, charging ports and more. Most repairs take a few hours.", link: "Estimate a repair", href: "#repairs" }
  };
  var tabBtns = document.querySelectorAll("#heroTabs button");
  var screen = $("screen"), cycleId, userTouched = false;
  function showTab(key, instant) {
    tabBtns.forEach(function (b) {
      var on = b.getAttribute("data-tab") === key;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    function paint() {
      var t = TABS[key];
      $("sBig").textContent = t.big;
      $("sSub").textContent = t.sub;
      $("sLink").textContent = t.link;
      $("sLink").href = t.href;
      screen.classList.remove("swap");
    }
    if (instant || reduceMotion) { paint(); return; }
    screen.classList.add("swap");
    setTimeout(paint, 180);
  }
  var order = ["buy", "sell", "repair"], idx = 0;
  tabBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      userTouched = true;
      clearInterval(cycleId);
      idx = order.indexOf(b.getAttribute("data-tab"));
      showTab(order[idx]);
    });
  });
  showTab("buy", true);
  if (!reduceMotion) {
    cycleId = setInterval(function () {
      if (document.hidden || userTouched) return;
      idx = (idx + 1) % order.length;
      showTab(order[idx]);
    }, 4500);
  }

  var visual = $("heroVisual"), phoneEl = $("phone");
  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    visual.addEventListener("pointermove", function (e) {
      var r = visual.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      phoneEl.style.transform = "rotateY(" + (x * 10) + "deg) rotateX(" + (-y * 8) + "deg)";
    });
    visual.addEventListener("pointerleave", function () { phoneEl.style.transform = ""; });
  }

  /* ---------- Scroll progress ---------- */
  var bar = $("progress"), ticking = false;
  function paintProgress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(paintProgress); }
  }, { passive: true });

  /* ---------- Gentle reveal on scroll ---------- */
  if ("IntersectionObserver" in window && !reduceMotion) {
    var rv = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); rv.unobserve(en.target); }
      });
    }, { threshold: 0.05 });
    document.querySelectorAll(".section-body").forEach(function (n) { n.classList.add("reveal"); rv.observe(n); });
  }

  renderProducts();
  renderCart();
})();
