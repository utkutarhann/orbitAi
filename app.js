const root = document.getElementById("screen-root");
let STATE = {
  user: null,
  restaurants: [],
  homeSuggestions: null,
  cart: {},
  activeRestaurant: null,
  lastSearchResults: [],
  lastQuery: "",
  orderTotal: 0,
  orderPaidWithOrbitPay: false,
  chatMessages: [],
  issueChat: null,
  prefsOnboarded: true,
  /* Orbit Eats'in kendi kart kasası — Orbit Pay cüzdanındaki kartlardan ayrıdır */
  savedCards: [
    { id: "card_1_4821", last4: "4821", label: "Garanti BBVA Bonus", scheme: "Bonus" },
    { id: "card_2_9104", last4: "9104", label: "Yapı Kredi World", scheme: "World" }
  ],
  selectedPayMethod: "orbitpay",
  chatGenerating: false,
  /* Senaryo seçici — null ise saat/güne göre otomatik */
  activeScenario: null,
  birthdayFireworksDone: false
};

function orbitLogo(size, mono) {
  const primary = mono ? "rgba(255,255,255,0.95)" : "var(--orbit-primary)";
  const ai = mono ? "rgba(255,255,255,0.65)" : "var(--orbit-ai)";
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0" aria-hidden="true">
      <path d="M10 20 C10 27.732 14.477 34 20 34 C25.523 34 30 27.732 30 20" stroke="${primary}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M8 20 L32 20" stroke="${primary}" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse cx="20" cy="20" rx="18" ry="6" transform="rotate(-20 20 20)" stroke="${ai}" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
      <circle cx="32" cy="10" r="3" fill="${primary}"/>
    </svg>
  `;
}

function goToPreferences() {
  renderPreferences();
}

/* Orbit AI anahtarı — kapalıyken canlı model hiç çağrılmaz, yerel motor kullanılır.
   Tercih kalıcı: localStorage'da saklanır. */
function aiEnabled() {
  return localStorage.getItem("orbit_ai_enabled") !== "0";
}
function setAiEnabled(on) {
  localStorage.setItem("orbit_ai_enabled", on ? "1" : "0");
}
window.aiEnabled = aiEnabled;

/* Tek gerçek kaynak: 90 günlük nakit iade toplamı haftalık dökümden hesaplanır,
   böylece kart üzerindeki tutar ile grafik hiçbir zaman ayrışmaz. */
function cashback90d(user) {
  const g = ((user || STATE.user) || {}).orbitGrow || {};
  const w = g.cashbackWeekly || [];
  if (!w.length) return g.cashbackEarned90d || 0;
  return Math.round(w.reduce((t, x) => t + x.amount, 0) * 100) / 100;
}

function currentTier() {
  return computeTier(STATE.user);
}

function getTierBadge(user) {
  const tier = computeTier(user || STATE.user);
  const cls = tier === "Prime" ? "prime" : tier === "Plus" ? "plus" : "base";
  return { tier, cls, label: `✦ ${tier.toUpperCase()}`, memberLabel: `✦ ${tier.toUpperCase()}` };
}

function tl(n) {
  return `${Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

function firstName(full) {
  return (full || "").trim().split(" ")[0];
}

function greetingByHour() {
  const h = (STATE.user && STATE.user.context && STATE.user.context.localHour) ?? new Date().getHours();
  if (h >= 18 || h < 4) return "İyi akşamlar";
  if (h >= 11) return "İyi günler";
  return "Günaydın";
}

/* Kişiselleştirmenin dayandığı canlı sinyaller. Sunumda "AI neye bakıyor?"
   sorusunun ekrandaki karşılığı; hepsi gerçek STATE verisinden okunuyor. */
function personalizationSignals() {
  const u = STATE.user || {};
  const p = u.declaredPreferences || {};
  const c = u.context || {};
  const ctx = momentContext();
  const gecmis = (typeof DETAILED_ORDERS !== "undefined" ? DETAILED_ORDERS : []).length;
  const alerjen = (p.allergensToAvoid || []).join(", ");
  const sevmedigi = (p.dislikes || []).join(", ");

  const list = [
    { icon: "🕒", label: "Zaman ve hava",
      value: `${ctx.hour}:00 · ${c.weather || "hava bilgisi yok"}` },
    { icon: "🥗", label: "Beslenme tercihin",
      value: !dietFilterOn() ? "süzme kapalı" : (p.dietStyle || "belirtilmemiş") }
  ];
  if (alerjen) list.push({ icon: "⚠️", label: "Kaçındığın alerjenler", value: alerjen });
  if (sevmedigi) list.push({ icon: "🚫", label: "Sevmediklerin", value: sevmedigi });
  if (gecmis) list.push({ icon: "📜", label: "Sipariş geçmişin", value: `son ${gecmis} sipariş` });
  list.push({ icon: "✦", label: "Statün", value: `${currentTier()} — kazanç ve teslimat avantajların` });
  return list;
}

function heroContextLine() {
  const c = (STATE.user && STATE.user.context) || {};
  const h = c.localHour ?? 19;
  const rainy = /yağmur/i.test(c.weather || "");

  const sehir = c.city || "İstanbul";
  if (rainy && (h >= 18 || h < 4)) return `${sehir}'da yağmurlu ve serin bir hava var. İçini ısıtacak lezzetler için doğru yerdesin.`;
  if (h >= 23 || h < 4) return "Gece uzun, mutfak kapalı. Ben hallederim.";
  if (h >= 18) return "Gün bitti, sıra sende. Bu akşam canın ne çekiyor?";
  if (h >= 15) return "Araya küçük bir kaçamak sığar.";
  if (h >= 11) return "Öğle arası kısa — doyurucu bir şey bulalım.";
  if (h >= 5) return "Güne iyi başlayalım. Kahvaltı hazır bekliyor.";
  return "Buradayım, ne canın çekiyorsa bulalım.";
}

function momentContext() {
  const c = (STATE.user && STATE.user.context) || {};
  const d = new Date();
  return {
    hour: c.localHour ?? d.getHours(),
    rainy: /yağmur/i.test(c.weather || ""),
    weekend: d.getDay() === 0 || d.getDay() === 6,
    month: d.getMonth() + 1,
    date: d.getDate()
  };
}

function habitFromHistory() {
  const hist = (STATE.user && STATE.user.orderHistory) || [];
  const part = (STATE.user && STATE.user.context && STATE.user.context.timeOfDay) || null;
  const pool = part ? hist.filter(o => o.dayPart === part) : [];
  const list = pool.length ? pool : hist;
  if (!list.length) return null;
  return list.slice().sort((a, b) => a.daysAgo - b.daysAgo)[0];
}

function specialDayMoment(ctx) {
  const key = `${ctx.date}-${ctx.month}`;
  const days = {
    "1-1":   { badge: "YILBAŞI", title: "Yılbaşı sofrası", sub: "Kalabalık siparişler", emoji: "🎉" },
    "14-2":  { badge: "SEVGİLİLER GÜNÜ", title: "İki kişilik menüler", sub: "Özel seçkiler", emoji: "💝" },
    "23-4":  { badge: "23 NİSAN", title: "Çocuklara özel", sub: "Aile menüleri", emoji: "🎈" },
    "29-10": { badge: "29 EKİM", title: "Cumhuriyet keyfi", sub: "Ev sahipliği menüleri", emoji: "🇹🇷" }
  };
  const d = days[key];
  return d ? { id: "ozel-gun", tone: "special", prompt: `${d.title} için öneri ver`, ...d } : null;
}

function getMoments() {
  const ctx = momentContext();
  const h = ctx.hour;
  const list = [];
  const dietLabels = mappedProfilePrefLabels();
  const beslenmeCard = {
    id: "beslenme", badge: "BESLENME TERCİHİN",
    title: "Sana Özel Seçimler",
    sub: "Beslenme alışkanlıklarına sadık lezzet rehberi",
    emoji: "🥗", tone: "diet",
    action: "diet",
    prompt: "Beslenme tercihlerime uygun bir şey öner"
  };

  // Aktif senaryo varsa: sadece senaryo kartı + beslenme tercihi (Akşam Molası vs. gösterilmez)
  if (STATE.activeScenario) {
    const sc = SCENARIO_DEFS[STATE.activeScenario];
    if (sc && sc.momentCard) list.push(sc.momentCard);
    if (dietFilterOn() && (dietLabels.length || rankingOnlyPrefLabels().length)) {
      list.push(beslenmeCard);
    }
    return list;
  }

  // Senaryo seçili değilse otomatik saat/gün bazlı kartlar
  if (h >= 18 || h < 4) {
    list.push({
      id: "aksam-molasi", badge: "AKŞAM MOLASI", title: "Akşam molası başlasın",
      sub: "Gece boyu açık yerler", emoji: "🌙", tone: "night",
      action: "night", prompt: "Akşam için hafif bir şey öner"
    });
  } else if (h >= 5 && h < 11) {
    list.push({
      id: "kahvalti", badge: "GÜNAYDIN", title: "Kahvaltı vakti",
      sub: "Güne enerjik ve doyurucu bir öğünle başlamaya ne dersin?", emoji: "☀️", tone: "morning",
      prompt: "Kahvaltılık hafif bir şeyler öner"
    });
  } else {
    list.push({
      id: "ogle", badge: "ÖĞLE ARASI", title: "Doyurucu ara öğün",
      sub: "Öğle arana uygun hızlı teslimatlı restoranlar", emoji: "🍽️", tone: "day",
      prompt: "Öğle arası için doyurucu ve hızlı bir şey öner"
    });
  }

  const special = specialDayMoment(ctx);
  if (special) list.push(special);

  if (h >= 22 || h < 4) {
    list.push({
      id: "tatli", badge: "GEÇ SAAT", title: "Tatlı krizi",
      sub: "Gece açık tatlıcılar", emoji: "🍰", tone: "sweet",
      prompt: "Gece açık tatlı yerleri göster"
    });
  }

  // HAFTA SONU kartı: yalnızca hafta sonu VE saat 22:00+ ise göster
  if (ctx.weekend && (h >= 22 || h < 4)) {
    list.push({
      id: "haftasonu", badge: "HAFTA SONU", title: "Hafta Sonuna Özel Tüm Lezzetler",
      sub: "Keyifli mekanlar 🥐", emoji: "🥐", tone: "day",
      prompt: "Hafta sonu brunch için mekan öner"
    });
  }

  if (dietFilterOn() && (dietLabels.length || rankingOnlyPrefLabels().length)) {
    list.push(beslenmeCard);
  }

  return list.slice(0, 4);
}

/* ============================================================
   SENARYO MOTORU — Contextual Moments Engine
   ============================================================ */
const SCENARIO_DEFS = {
  sabah: {
    label: "☀️ Sabah Saatleri",
    gradient: "linear-gradient(145deg, #064E3B 0%, #0F766E 50%, #0D9488 100%)",
    greeting: "Günaydın, Baki ☀️",
    sub: "Güne taze ve enerjik bir başlangıç yap. Fırından yeni çıkmış çıtır lezzetler senin için hazır.",
    badge: { cls: "plus", label: "✦ PLUS" },
    swipeRail: true,  // Ana içerikte swipe edilebilir restoran önerileri göster
    aiMessage: "Yukarıdaki seçeneklerin sana uygun olabileceğini düşündüm. Değilse bana nasıl bir şeyler yemek istediğini söyleyebilirsin.",
    momentCard: {
      id: "sc-sabah", badge: "☀️ GÜNAYDIN", title: "Kahvaltı Vakti",
      sub: "Güne enerjik ve doyurucu bir öğünle başlamaya ne dersin?", emoji: "🥐", tone: "morning",
      prompt: "Kahvaltılık hafif bir şeyler öner"
    },
    swipeRestaurants: [
      { name: "Meşhur Sarıyer Börekçisi", cuisine: "Börek & Kahvaltı", rating: 4.8, deliveryMinutes: 18, image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=200&h=160&fit=crop&q=75" },
      { name: "Yeşil Kase", cuisine: "Sağlıklı & Organik", rating: 4.7, deliveryMinutes: 22, image: "https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=200&h=160&fit=crop&q=75" },
      { name: "Espresso Lab", cuisine: "Kahve & Fırın", rating: 4.9, deliveryMinutes: 20, image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=160&fit=crop&q=75" },
      { name: "Simit Sarayı", cuisine: "Simit & Poğaça", rating: 4.6, deliveryMinutes: 15, image: "https://images.unsplash.com/photo-1598511757337-fe2cafc31ba0?w=200&h=160&fit=crop&q=75" }
    ],
    menus: [
      { itemName: "Peynirli Sarıyer Böreği + Demleme Çay", restaurantName: "Meşhur Sarıyer Börekçisi", price: 140, tags: ["hafif"], deliveryMinutes: 18, image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=120&h=120&fit=crop&q=75" },
      { itemName: "Granola & Orman Meyveli Taze Yoğurt Kasesi", restaurantName: "Yeşil Kase", price: 185, tags: ["hafif", "vegan"], deliveryMinutes: 22, image: "https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=120&h=120&fit=crop&q=75" },
      { itemName: "Sıcak Flat White + Çikolatalı Fırın Kruvasan", restaurantName: "Espresso Lab", price: 160, tags: ["hafif"], deliveryMinutes: 20, image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=120&h=120&fit=crop&q=75" }
    ]
  },
  ogle: {
    label: "⚡ Öğlen Molası",
    gradient: "linear-gradient(145deg, #0C2340 0%, #1D4ED8 50%, #2563EB 100%)",
    greeting: "İyi Günler, Baki ⚡",
    sub: "Öğle arası en verimli şekilde değerlendirebileceğin restorantlar için Sana Özel'e bakmayı unutma!",
    badge: { cls: "plus", label: "✦ PLUS" },
    swipeRail: true,
    aiMessage: "Yukarıdaki seçeneklerin sana uygun olabileceğini düşündüm. Değilse bana nasıl bir şeyler yemek istediğini söyleyebilirsin.",
    momentCard: {
      id: "sc-ogle", badge: "⚡ ÖĞLE MOLASI", title: "Doyurucu ara öğün",
      sub: "Öğle arana uygun hızlı teslimatlı restoranlar", emoji: "🍽️", tone: "day",
      prompt: "Öğle arası için doyurucu ve hızlı bir şey öner"
    },
    swipeRestaurants: [
      { name: "Dürümcü Sedat", cuisine: "Dürüm & Lahmacun", rating: 4.8, deliveryMinutes: 15, image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200&h=160&fit=crop&q=75" },
      { name: "Yeşil Kase", cuisine: "Sağlıklı & Salata", rating: 4.7, deliveryMinutes: 22, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=160&fit=crop&q=75" },
      { name: "Pideor", cuisine: "Pide & Fırın", rating: 4.5, deliveryMinutes: 20, image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=200&h=160&fit=crop&q=75" },
      { name: "Köfteci Ali", cuisine: "Köfte & Izgara", rating: 4.9, deliveryMinutes: 25, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=200&h=160&fit=crop&q=75" }
    ],
    menus: [
      { itemName: "Izgara Tavuk Dürüm + Ayran Menü", restaurantName: "Dürümcü Sedat", price: 190, tags: ["doyurucu"], deliveryMinutes: 15, image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=120&h=120&fit=crop&q=75" },
      { itemName: "Izgara Somonlu & Avokadolu Kinoa Kasesi", restaurantName: "Yeşil Kase", price: 280, tags: ["hafif", "vegan"], deliveryMinutes: 22, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=120&h=120&fit=crop&q=75" },
      { itemName: "Çıtır Kaşarlı Kıymalı Pide Menüsü", restaurantName: "Pideor", price: 210, tags: ["doyurucu"], deliveryMinutes: 20, image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=120&h=120&fit=crop&q=75" }
    ]
  },
  aksam: {
    label: "🌙 Akşam Molası",
    gradient: "linear-gradient(145deg, #09122C 0%, #112046 50%, #1A1842 100%)",
    greeting: "İyi Akşamlar, Baki 🌙",
    sub: "Dışarısı serin. İçini ısıtacak lezzetler için doğru yerdesin.",
    badge: { cls: "plus", label: "✦ PLUS" },
    momentCard: {
      id: "sc-aksam", badge: "🌙 AKŞAM MOLASI", title: "Akşam Molası Başlasın",
      sub: "Sıcak çorba, ev yemekleri ve taze fırınlar", emoji: "🍲", tone: "night",
      action: "night", prompt: "Akşam için hafif bir şey öner"
    },
    menus: [
      { itemName: "Süzme Mercimek Çorbası + Zeytinyağlı Enginar", restaurantName: "Zeytin Sofrası", price: 195, tags: ["hafif", "vegan"], deliveryMinutes: 25, image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=120&h=120&fit=crop&q=75" },
      { itemName: "Izgara Kasap Köfte + Piyaz Menüsü", restaurantName: "Köfteci Ali", price: 260, tags: ["doyurucu", "protein"], deliveryMinutes: 30, image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=120&h=120&fit=crop&q=75" },
      { itemName: "Fırın Sebzeli Sıcak Kinoa Kasesi", restaurantName: "Yeşil Kase", price: 210, tags: ["hafif", "vegan"], deliveryMinutes: 22, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=120&h=120&fit=crop&q=75" }
    ]
  },
  dogumgunu: {
    label: "🎂 Doğum Günü",
    gradient: "linear-gradient(145deg, #4A044E 0%, #831843 50%, #9D174D 100%)",
    greeting: "İyi ki Doğdun, Baki! 🎉",
    sub: "Bugün senin günün! Doğum günü hediyen hazır.",
    badge: { cls: "plus", label: "✦ PLUS" },
    momentCard: {
      id: "sc-dogumgunu", badge: "🎁 İYİ Kİ DOĞDUN", title: "Doğum Günü Hediyen",
      sub: "Sana özel hediyeni seçmek için tıkla 🎁", emoji: "🎂", tone: "birthday",
      action: "birthday", prompt: "Doğum günü için özel menü öner"
    },
    menus: []
  },
  mac: {
    label: "🇹🇷 Türkiye Maç Günü",
    gradient: "linear-gradient(145deg, #7F1D1D 0%, #B91C1C 50%, #DC2626 100%)",
    greeting: "Kalpler Kırmızı-Beyaz, Baki! 🇹🇷",
    sub: "Maç başlamadan siparişini ver, ilk düdükten önce kapında olsun.",
    badge: { cls: "match", label: "⚽ MAÇ ÖZEL" },
    momentCard: {
      id: "sc-mac", badge: "⚽ MAÇ AKŞAMI", title: "Taraftar Party Box",
      sub: "Kalabalık gruplar için paylaşımlık maç paketleri", emoji: "🏆", tone: "match",
      prompt: "Maç akşamı için büyük boy atıştırmalıklar öner"
    },
    menus: [
      { itemName: "2'li Büyük Boy Taraftar Pizza + 1 Litre İçecek", restaurantName: "Pizza Locale", price: 540, tags: ["doyurucu"], deliveryMinutes: 30, image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=120&h=120&fit=crop&q=75" },
      { itemName: "20'li Çıtır Tavuk Kovası + 4 Farklı Dip Sos", restaurantName: "Crispy Box", price: 380, tags: ["doyurucu", "protein"], deliveryMinutes: 25, image: "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=120&h=120&fit=crop&q=75" },
      { itemName: "3 Kişilik Maç Paketi + Soğan Halkaları", restaurantName: "Burger House", price: 490, tags: ["doyurucu"], deliveryMinutes: 28, image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=120&h=120&fit=crop&q=75" }
    ]
  }
};

function getScenarioHero() {
  if (STATE.activeScenario) {
    return SCENARIO_DEFS[STATE.activeScenario] || null;
  }
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return SCENARIO_DEFS.sabah;
  if (h >= 11 && h < 16) return SCENARIO_DEFS.ogle;
  return SCENARIO_DEFS.aksam;
}

function getScenarioMenuItems() {
  const sc = getScenarioHero();
  if (!sc || !sc.menus) return null;
  const scKey = STATE.activeScenario || (new Date().getHours() >= 5 && new Date().getHours() < 11 ? "sabah" : new Date().getHours() >= 11 && new Date().getHours() < 16 ? "ogle" : "aksam");
  return sc.menus.map((m, i) => ({
    itemId: `sc-item-${scKey}-${i}`,
    itemName: m.itemName,
    restaurantName: m.restaurantName,
    restaurantId: `sc-rest-${i}`,
    price: m.price,
    tags: m.tags || [],
    deliveryMinutes: m.deliveryMinutes || 25,
    image: m.image || null
  }));
}

function openScenarioPicker() {
  // Mevcut sheet varsa kaldır
  const existing = document.getElementById("scenarioPickerSheet");
  if (existing) existing.remove();

  const scenarios = [
    { id: "sabah",      label: "☀️ Sabah Saatleri" },
    { id: "ogle",       label: "⚡ Öğlen Molası" },
    { id: "aksam",      label: "🌙 Akşam Molası" },
    { id: "dogumgunu",  label: "🎂 Doğum Günü Kutlaması" },
    { id: "mac",        label: "🇹🇷 Türkiye Maçı Günü" }
  ];

  const sheet = document.createElement("div");
  sheet.id = "scenarioPickerSheet";
  sheet.className = "tier-modal-overlay";
  sheet.innerHTML = `
    <div class="scenario-picker-sheet bottom-sheet-panel">
      <div class="scenario-picker-handle"></div>
      <div class="scenario-picker-header">
        <p class="scenario-picker-title">Senaryo Seçici</p>
        <p class="scenario-picker-sub">Kullanıcıya özel günün farklı zaman dilimleri ve özel günlere farklılaşan deneyim için seçim yap Baki :)</p>
      </div>
      <div class="scenario-picker-list">
        ${scenarios.map(s => `
          <button class="scenario-row ${STATE.activeScenario === s.id ? "active" : ""}" data-scenario="${s.id}">
            <span class="scenario-row-label">${s.label}</span>
            ${STATE.activeScenario === s.id ? '<span class="scenario-row-check">✓</span>' : '<span class="scenario-row-arrow">›</span>'}
          </button>
        `).join("")}
      </div>
    </div>
  `;

  const shell = document.querySelector(".app-shell");
  if (shell) shell.appendChild(sheet);

  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) closeScenarioPicker();
  });
  const scClose = document.getElementById("scenarioPickerClose");
  if (scClose) scClose.addEventListener("click", closeScenarioPicker);

  sheet.querySelectorAll("[data-scenario]").forEach(btn => {
    btn.addEventListener("click", () => {
      const scId = btn.dataset.scenario || null;
      STATE.activeScenario = scId;
      closeScenarioPicker();
      // Doğum günü seçilirse havai fişek göster
      if (scId === "dogumgunu" && !STATE.birthdayFireworksDone) {
        renderHome();
        setTimeout(() => launchBirthdayFireworks(), 300);
        STATE.birthdayFireworksDone = true;
      } else {
        renderHome();
      }
    });
  });

  // Sheet'i animasyonlu aç
  requestAnimationFrame(() => {
    sheet.style.display = "flex";
    requestAnimationFrame(() => sheet.querySelector(".scenario-picker-sheet").classList.add("open"));
  });
}

function closeScenarioPicker() {
  const sheet = document.getElementById("scenarioPickerSheet");
  if (!sheet) return;
  const panel = sheet.querySelector(".scenario-picker-sheet");
  if (panel) panel.classList.remove("open");
  setTimeout(() => sheet.remove(), 320);
}

function openBirthdayRewardModal() {
  const existing = document.getElementById("birthdayRewardModal");
  if (existing) existing.remove();

  const sheet = document.createElement("div");
  sheet.id = "birthdayRewardModal";
  sheet.className = "tier-modal-overlay";
  sheet.innerHTML = `
    <div class="birthday-reward-sheet bottom-sheet-panel">
      <div class="scenario-picker-handle"></div>
      <div class="scenario-picker-header">
        <p class="scenario-picker-title">🎁 Bugün Senin Günün! ✨</p>
        <p class="scenario-picker-sub">Orbit AI geçmiş tercihlerine baktı ve sana en uygun hediyeleri hazırladı. Kutlamayı başlatmak için birini seç:</p>
      </div>
      <div class="birthday-reward-options" style="padding: 16px;">
        <button class="birthday-reward-card" id="reward50Pct">
          <div class="reward-icon">%50</div>
          <div class="reward-info">
            <p class="reward-title">%50 İndirim Kuponu</p>
            <p class="reward-sub"><strong>Orbit AI senin için seçti:</strong> Bu yıl 14 kez sipariş verdiğin Pizza Locale'de bugüne özel %50 indirim!</p>
          </div>
          <span class="reward-select-btn">Kuponu Aktif Et ›</span>
        </button>
        <button class="birthday-reward-card" id="rewardDessert" style="margin-top: 12px;">
          <div class="reward-icon">🍰</div>
          <div class="reward-info">
            <p class="reward-title">Ücretsiz Doğum Günü Tatlısı</p>
            <p class="reward-sub"><strong>Orbit AI hafızasından:</strong> En sevdiğin San Sebastian Cheesecake veya mumlu Çikolatalı Kruvasan siparişinin yanında hediye!</p>
          </div>
          <span class="reward-select-btn">Tatlını Al ›</span>
        </button>
      </div>
    </div>
  `;

  const shell = document.querySelector(".app-shell");
  if (shell) shell.appendChild(sheet);

  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) closeBirthdayRewardModal();
  });
  const bdayClose = document.getElementById("birthdayRewardClose");
  if (bdayClose) bdayClose.addEventListener("click", closeBirthdayRewardModal);

  const selectGift = (giftName) => {
    closeBirthdayRewardModal();
    toast(`🎉 ${giftName} hesabına tanımlandı!`);
  };

  document.getElementById("reward50Pct").addEventListener("click", () => selectGift("%50 İndirim Kuponu"));
  document.getElementById("rewardDessert").addEventListener("click", () => selectGift("San Sebastian Cheesecake"));

  requestAnimationFrame(() => {
    sheet.style.display = "flex";
    requestAnimationFrame(() => sheet.querySelector(".birthday-reward-sheet").classList.add("open"));
  });
}

function closeBirthdayRewardModal() {
  const sheet = document.getElementById("birthdayRewardModal");
  if (!sheet) return;
  const panel = sheet.querySelector(".birthday-reward-sheet");
  if (panel) panel.classList.remove("open");
  setTimeout(() => sheet.remove(), 320);
}

/* Doğum Günü Havai Fişek Animasyonu */
function launchBirthdayFireworks() {
  const phone = document.querySelector(".phone");
  if (!phone) return;

  const container = document.createElement("div");
  container.className = "fireworks-container";
  phone.appendChild(container);

  const colors = ["#FDE047", "#FB7185", "#A78BFA", "#34D399", "#F97316", "#60A5FA", "#fff"];

  function spawnWave() {
    const phoneRect = phone.getBoundingClientRect();
    const w = phoneRect.width || 390;

    for (let i = 0; i < 22; i++) {
      const p = document.createElement("div");
      p.className = "firework-particle";
      const color = colors[Math.floor(Math.random() * colors.length)];
      const side = Math.random() > 0.5 ? "left" : "right";
      const angle = side === "left" ? Math.random() * 70 + 20 : Math.random() * 70 + 90;
      const dist = 70 + Math.random() * 110;
      const tx = Math.cos(angle * Math.PI / 180) * dist;
      const ty = -Math.abs(Math.sin(angle * Math.PI / 180) * dist);
      const x = side === "left" ? w * (0.05 + Math.random() * 0.25) : w * (0.7 + Math.random() * 0.25);

      p.style.cssText = `
        left:${x}px; bottom:0;
        background:${color};
        --tx:${tx}px; --ty:${ty}px;
        animation-delay:${Math.random() * 0.4}s;
        width:${4 + Math.random() * 5}px;
        height:${4 + Math.random() * 5}px;
        border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      `;
      container.appendChild(p);
    }
  }

  spawnWave();
  setTimeout(spawnWave, 600);
  setTimeout(spawnWave, 1200);

  // 3.5 saniye sonra temizle
  setTimeout(() => container.remove(), 3500);
}

function dietFilterDefaults() {
  const p = (STATE.user && STATE.user.declaredPreferences) || {};
  const prefs = [];
  if (dietFilterOn() && (p.dietStyle === "vegan" || p.dietStyle === "vejetaryen")) prefs.push("vegetarian");
  return prefs;
}

function dietStyleLabel(id) {
  const d = (typeof DIET_OPTIONS !== "undefined" ? DIET_OPTIONS : []).find(x => x.id === id);
  return d ? d.label : "";
}
function dietStyleIcon(id) {
  const d = (typeof DIET_OPTIONS !== "undefined" ? DIET_OPTIONS : []).find(x => x.id === id);
  return d ? d.icon : "🍽️";
}

function mappedProfilePrefLabels() {
  const map = { vegetarian: "Vejetaryen / Vegan", fast: "25 dk altı teslimat" };
  return dietFilterDefaults().map(p => map[p]).filter(Boolean);
}

function rankingOnlyPrefLabels() {
  const p = (STATE.user && STATE.user.declaredPreferences) || {};
  return (p.allergensToAvoid || []).map(a => `${a} içermeyen`);
}

function bootstrap() {
  if (typeof USER !== "undefined") STATE.user = USER;
  if (typeof RESTAURANTS !== "undefined") STATE.restaurants = RESTAURANTS;
  if (typeof getHomeSuggestions === "function") STATE.homeSuggestions = getHomeSuggestions();
  renderHome();
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  const phone = document.querySelector(".phone");
  if (phone) phone.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* Ekosistem butonu bazı ekranlarda (sohbet girdi çubuğu gibi) araya giriyor. */
function setEcoFabVisible(show) {
  const g = document.getElementById("ecoFabGroup");
  if (g) g.style.display = show ? "" : "none";
}

function resetScreenChrome() {
  clearMountedSheets();
  setEcoFabVisible(true); // varsayılan görünür; gizleyen ekran kendi kapatır
}

function makeFabDraggable(moveEl, handleEl, onTap, onDragStart) {
  const phone = document.querySelector(".phone");
  const DRAG_THRESHOLD = 4;
  const EDGE = 10;
  if (!moveEl || !phone) return;
  const handle = handleEl || moveEl;

  let dragging = false, moved = false;
  let startX = 0, startY = 0, originLeft = 0, originTop = 0;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  handle.addEventListener("pointerdown", (e) => {
    const r = moveEl.getBoundingClientRect();
    const p = phone.getBoundingClientRect();
    originLeft = r.left - p.left;
    originTop = r.top - p.top;
    moveEl.style.left = originLeft + "px";
    moveEl.style.top = originTop + "px";
    moveEl.style.right = "auto";
    moveEl.style.bottom = "auto";

    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      moved = true;
      handle.classList.add("dragging");
      if (onDragStart) onDragStart();
    }
    if (!moved) return;

    const p = phone.getBoundingClientRect();
    const maxLeft = p.width - moveEl.offsetWidth - EDGE;
    const maxTop = p.height - moveEl.offsetHeight - EDGE;
    const nl = clamp(originLeft + dx, EDGE, maxLeft);
    moveEl.style.left = nl + "px";
    moveEl.style.top = clamp(originTop + dy, EDGE, maxTop) + "px";
    moveEl.classList.toggle("flip", nl < p.width / 2 - moveEl.offsetWidth / 2);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    if (!moved && onTap) onTap();
  }

  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
}

function openSheet(sheet) {
  if (!sheet) return;
  sheet.style.display = "flex";
  sheet.classList.add("open");
}
function closeSheet(sheet) {
  if (!sheet) return;
  sheet.classList.remove("open");
  sheet.style.display = "none";
}
function mountSheetToShell(sheet) {
  const shell = document.querySelector(".app-shell");
  if (sheet && shell && sheet.parentElement !== shell) shell.appendChild(sheet);
}
function clearMountedSheets() {
  document.querySelectorAll(".app-shell > .tier-modal-overlay").forEach(el => el.remove());
}

function bindBottomSheet(sheet, openBtnId, closeBtnId) {
  if (!sheet) return;
  const openBtn = document.getElementById(openBtnId);
  const closeBtn = document.getElementById(closeBtnId);
  mountSheetToShell(sheet);
  if (openBtn) openBtn.addEventListener("click", () => openSheet(sheet));
  if (closeBtn) closeBtn.addEventListener("click", () => closeSheet(sheet));
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) closeSheet(sheet);
  });
}

function cartCount() {
  return Object.values(STATE.cart).reduce((s, c) => s + c.qty, 0);
}
function cartTotal() {
  return Object.values(STATE.cart).reduce((s, c) => s + c.qty * c.price, 0);
}

function addToCart(entry) {
  const id = entry.itemId;
  if (!STATE.cart[id]) {
    STATE.cart[id] = {
      name: entry.itemName,
      price: entry.price,
      restaurantId: entry.restaurantId,
      restaurantName: entry.restaurantName,
      qty: 0
    };
  }
  STATE.cart[id].qty++;
}
function removeFromCart(itemId) {
  if (STATE.cart[itemId]) {
    STATE.cart[itemId].qty--;
    if (STATE.cart[itemId].qty <= 0) delete STATE.cart[itemId];
  }
}

function foodIconTile(tags, imgUrl) {
  if (imgUrl) {
    return `<div class="food-art img-art"><img src="${imgUrl}" alt="" class="food-img-thumb" /></div>`;
  }
  const t = (tags || []).join(" ");
  let cls = "art-mixed";
  if (/vegan|vejetaryen|hafif/.test(t)) cls = "art-fresh";
  else if (/cok-acili|acili/.test(t)) cls = "art-spicy";
  else if (/doyurucu|protein/.test(t)) cls = "art-hearty";
  return `<div class="food-art ${cls}"><svg width="30" height="30" viewBox="0 0 48 48"><use href="#icon-bowl"/></svg></div>`;
}

function storeIconTile(imgUrl) {
  if (imgUrl) {
    return `<div class="food-art img-art"><img src="${imgUrl}" alt="" class="food-img-thumb" /></div>`;
  }
  return `<div class="food-art art-store"><svg width="30" height="30" viewBox="0 0 48 48"><use href="#icon-store"/></svg></div>`;
}

/* ---------------- Home ---------------- */
function renderHome() {
  resetScreenChrome();
  const u = STATE.user || {};
  const sug = STATE.homeSuggestions || { forYou: [], popularFallback: [] };
  const sc = getScenarioHero();
  const heroStyle = sc ? `style="background:${sc.gradient}"` : "";
  const greetingText = sc ? sc.greeting : `${greetingByHour()}, ${firstName(STATE.user ? STATE.user.name : "Baki")}`;
  const subText = sc ? sc.sub : heroContextLine();
  const badgeCls = sc ? sc.badge.cls : getTierBadge(u).cls;
  const badgeLabel = sc ? sc.badge.label : getTierBadge(u).label;
  const isBirthday = STATE.activeScenario === "dogumgunu";
  const scMenuItems = getScenarioMenuItems();

  root.innerHTML = `
    <div class="home-hero" ${heroStyle}>
      <span class="hero-sparkle s1">✦</span>

      <div class="topbar-hero-row">
        <div class="topbar-brand">
          ${orbitLogo(28)}
          <span class="topbar-word">Orbit Eats</span>
        </div>
        <button class="topbar-icon scenario-picker-btn ${STATE.activeScenario ? "scenario-active" : ""}" id="scenarioPickerBtn" aria-label="Senaryo Seç" title="Demo Bağlamı Seç">
          🎭
        </button>
      </div>



      <div class="hero-greeting-block">
        <h1 class="hero-greeting-title">
          <span>${greetingText}</span>
          <span class="hero-tier-badge avatar-tier-badge ${badgeCls}">${badgeLabel}</span>
        </h1>
        <p class="hero-greeting-sub">${subText}</p>
      </div>

      <div class="search-bar hero-search" id="openSearch">
        <span class="icon search-glass"><svg width="17" height="17" viewBox="0 0 24 24"><use href="#icon-search"/></svg></span>
        <input id="searchInput" placeholder="Restoran veya yemek ara" />
        <button class="search-cam-btn" id="searchCam" title="Fotoğrafla ara" aria-label="Fotoğrafla ara">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 8.5h3l1.4-2h7.2L17 8.5h3v10H4v-10Z"/><circle cx="12" cy="13" r="3.2"/>
          </svg>
        </button>
        <button class="ask-ai-btn" id="askAiBtn" title="Orbit AI'a sor">✦ Sor</button>
      </div>

      <div class="hero-blob"><div class="hero-blob-shape"></div></div>
      <svg class="hero-wave" viewBox="0 0 400 32" preserveAspectRatio="none"><path d="M0,32 C120,5 260,38 400,12 L400,32 L0,32 Z" style="fill:var(--orbit-bg)"/></svg>
    </div>

    <div class="screen" style="padding-top:0">
      <div class="section-title moment-title-row">
        <span>${momentContext().hour >= 18 || momentContext().hour < 4 ? "🌙" : "✦"} Sana Özel</span>
        <!-- Yeşil yıldız uygulamada AI'ı temsil ediyor -->
        <span class="ai-star" tabindex="0" role="img"
              aria-label="Sana Özel alanı geçmiş siparişlerin, harcama alışkanlıkların ve bir çok farklı hesaplamaya göre Orbit AI tarafından oluşturulmuştur"
              data-tip="Sana Özel alanı geçmiş siparişlerin, harcama alışkanlıkların ve bir çok farklı hesaplamaya göre Orbit AI tarafından oluşturulmuştur.">✦</span>
      </div>
      <div class="h-scroll moment-rail">
        ${getMoments().map(m => `
          <div class="moment-card tone-${m.tone}" data-moment="${m.id}">
            <div class="moment-top">
              <span class="moment-badge">${m.badge}</span>
              <span class="moment-emoji">${m.emoji}</span>
            </div>
            <p class="moment-title">${m.title}</p>
            ${m.sub ? `<p class="moment-sub">${m.sub}</p>` : ""}
            <span class="moment-go">→</span>
          </div>
        `).join("")}
      </div>

      <div class="quick-actions">
        <div class="quick-action-tile" id="qaNear">
          <div class="qa-icon"><svg width="17" height="17" viewBox="0 0 48 48"><use href="#icon-store"/></svg></div>
          <span>Yakınımda</span>
        </div>
        <div class="quick-action-tile" id="qaFeatured">
          <div class="qa-icon"><svg width="15" height="15" viewBox="0 0 24 24"><use href="#icon-spark"/></svg></div>
          <span>Öne Çıkanlar</span>
        </div>
        <div class="quick-action-tile" id="qaLocal">
          <div class="qa-icon"><svg width="17" height="17" viewBox="0 0 48 48"><use href="#icon-bowl"/></svg></div>
          <span>Yerel İşletmeler</span>
        </div>
      </div>

      ${STATE.activeScenario === "dogumgunu" ? "" : `
        <div class="section-title">
          <span>${STATE.activeScenario ? SCENARIO_DEFS[STATE.activeScenario].label.split(" ").slice(1).join(" ") + " Menüleri" : "Avantajlı Menüler"}</span>
        </div>
        <div class="h-scroll">
          ${scMenuItems
            ? scMenuItems.map(dishCardHTML).join("")
            : (sug.forYou.map(dishCardHTML).join("") || `<p style="font-size:12px;color:var(--orbit-muted)">Henüz yeterli geçmiş yok.</p>`)}
        </div>
      `}

      <div class="section-title"><span>Bölgede Popüler</span></div>
      <div class="h-scroll">
        ${sug.popularFallback.map(p => {
          let foundImg = null;
          STATE.restaurants.forEach(r => {
            const f = (r.menu || []).find(m => m.name === p.item);
            if (f && f.image) foundImg = f.image;
          });
          return `
            <div class="dish-card">
              ${foodIconTile(["doyurucu"], foundImg)}
              <p class="dish-name">${p.item}</p>
              <p class="dish-meta">${p.restaurant}</p>
            </div>
          `;
        }).join("")}
      </div>

      <div class="section-title"><span>Yemek Türleri & Mutfaklar</span></div>
      <div class="h-scroll food-cat-scroll">
        <div class="food-cat-pill active" data-cat="tumu"><span>✨ Tümü</span></div>
        <div class="food-cat-pill" data-cat="hamburger"><span>🍔 Hamburger</span></div>
        <div class="food-cat-pill" data-cat="pizza"><span>🍕 Pizza</span></div>
        <div class="food-cat-pill" data-cat="et"><span>🥩 Et & Kebap</span></div>
        <div class="food-cat-pill" data-cat="tavuk"><span>🍗 Tavuk</span></div>
        <div class="food-cat-pill" data-cat="salata"><span>🥗 Salata & Fit</span></div>
        <div class="food-cat-pill" data-cat="tatli"><span>🍰 Tatlı</span></div>
        <div class="food-cat-pill" data-cat="uzakdogu"><span>🍜 Uzak Doğu</span></div>
      </div>

      <div class="section-title"><span>Tüm Restoranlar</span></div>
      ${STATE.restaurants.map(r => `
        <div class="result-card" data-restaurant="${r.id}">
          ${storeIconTile(r.image)}
          <div class="result-body">
            <div class="result-title-row">
              <p class="result-name">${r.name}</p>
              <span class="result-price">${r.priceLevel === 1 ? "₺" : r.priceLevel === 2 ? "₺₺" : "₺₺₺"}</span>
            </div>
            <p class="result-sub">${r.cuisine} · ⭐ ${r.rating} · ${r.deliveryMinutes} dk · ${r.distanceKm} km</p>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  document.querySelectorAll(".food-cat-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".food-cat-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const cat = pill.dataset.cat;
      if (cat === "tumu") {
        renderHome();
      } else {
        const filteredList = STATE.restaurants.filter(r => {
          const c = (r.cuisine || "").toLowerCase();
          const tags = (r.tags || []).map(t => t.toLowerCase());
          const menuTags = (r.menu || []).flatMap(m => (m.tags || []).map(t => t.toLowerCase()));
          const menuNames = (r.menu || []).map(m => (m.name || "").toLowerCase());
          
          if (cat === "salata") {
            return c.includes("salata") || c.includes("bowl") || c.includes("sağlıklı") ||
                   tags.includes("salata") || tags.includes("bowl") || menuTags.includes("salata") ||
                   menuNames.some(n => n.includes("salata") || n.includes("bowl"));
          }
          if (cat === "hamburger") {
            return c.includes("burger") || tags.includes("burger") || menuTags.includes("burger") || menuNames.some(n => n.includes("burger"));
          }
          if (cat === "pizza") {
            return c.includes("pizza") || tags.includes("pizza") || menuTags.includes("pizza") || menuNames.some(n => n.includes("pizza"));
          }
          if (cat === "et") {
            return c.includes("et") || c.includes("kebap") || c.includes("köfte") || c.includes("dürüm") || tags.includes("et") || tags.includes("kebap");
          }
          if (cat === "tavuk") {
            return c.includes("tavuk") || tags.includes("tavuk") || menuNames.some(n => n.includes("tavuk"));
          }
          if (cat === "tatli") {
            return c.includes("tatlı") || c.includes("tatli") || c.includes("fırın") || tags.includes("tatli") || tags.includes("tatlı");
          }
          if (cat === "uzakdogu") {
            return c.includes("uzak doğu") || c.includes("fusion") || c.includes("sushi") || tags.includes("sushi") || tags.includes("uzakdogu");
          }
          return c.includes(cat) || tags.some(t => t.includes(cat));
        });
        const targetList = filteredList.length > 0 ? filteredList : STATE.restaurants.slice(0, 4);
        
        const restSection = document.querySelector(".screen");
        if (restSection) {
          const oldList = restSection.querySelectorAll(".result-card");
          oldList.forEach(node => node.remove());
          const newHtml = targetList.map(r => `
            <div class="result-card" data-restaurant="${r.id}">
              ${storeIconTile(r.image)}
              <div class="result-body">
                <div class="result-title-row">
                  <p class="result-name">${r.name}</p>
                  <span class="result-price">${r.priceLevel === 1 ? "₺" : r.priceLevel === 2 ? "₺₺" : "₺₺₺"}</span>
                </div>
                <p class="result-sub">${r.cuisine} · ⭐ ${r.rating} · ${r.deliveryMinutes} dk · ${r.distanceKm} km</p>
              </div>
            </div>
          `).join("");
          restSection.insertAdjacentHTML("beforeend", newHtml);
          document.querySelectorAll("[data-restaurant]").forEach(el => {
            el.addEventListener("click", () => openRestaurant(el.dataset.restaurant));
          });
        }
      }
    });
  });

  document.querySelectorAll("[data-restaurant]").forEach(el => {
    el.addEventListener("click", () => openRestaurant(el.dataset.restaurant));
  });
  document.querySelectorAll(".prompt-pill").forEach(btn => {
    btn.addEventListener("click", () => openContextualChat(btn.dataset.prompt));
  });

  const momentsById = {};
  getMoments().forEach(m => { momentsById[m.id] = m; });
  document.querySelectorAll("[data-moment]").forEach(el => {
    el.addEventListener("click", () => {
      const m = momentsById[el.dataset.moment];
      if (!m) return;
      if (m.action === "night") renderNightMunchiesPage();
      else if (m.action === "diet") renderDietPicksPage();
      else if (m.action === "birthday") {
        openBirthdayRewardModal();
      }
      else if (m.prompt === "__history_rank__") openHistoryRanking();
      else openContextualChat(m.prompt);
    });
  });

  // 🎭 Senaryo Seçici Butonu
  const scenarioBtn = document.getElementById("scenarioPickerBtn");
  if (scenarioBtn) scenarioBtn.addEventListener("click", openScenarioPicker);

  document.getElementById("qaNear").addEventListener("click", () => {
    STATE.collectionQuery = "";
    renderCollectionPage("near");
  });
  document.getElementById("qaFeatured").addEventListener("click", () => {
    STATE.collectionQuery = "";
    renderCollectionPage("featured");
  });
  document.getElementById("qaLocal").addEventListener("click", () => {
    STATE.collectionQuery = "";
    renderCollectionPage("local");
  });

  const input = document.getElementById("searchInput");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) runAiSearch(input.value.trim());
  });
  document.getElementById("openSearch").addEventListener("click", (e) => {
    if (!e.target.closest("#askAiBtn") && !e.target.closest("#searchCam")) input.focus();
  });
  document.getElementById("searchCam").addEventListener("click", (e) => {
    e.stopPropagation();
    openPhotoSearch();
  });
  document.getElementById("askAiBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const typed = input.value.trim();
    if (typed) openContextualChat(typed, true);
    else renderAiChat(true);
  });

  setActiveTab("home");
  resetScreenChrome();
}

function dishCardHTML(item) {
  let img = item.image;
  if (!img && STATE.restaurants) {
    STATE.restaurants.forEach(r => {
      const found = (r.menu || []).find(m => m.name === item.itemName || m.id === item.itemId);
      if (found && found.image) img = found.image;
    });
  }
  // Kampanyalı kalemde indirim öncesi fiyat gösterilir; "price" ödenen tutardır
  const pct = (typeof MENU_CAMPAIGNS !== "undefined" && MENU_CAMPAIGNS[item.itemId]) || 0;
  const listPrice = pct ? listPriceFor(item.itemId, item.price) : null;
  return `
    <div class="dish-card ${pct ? "has-deal" : ""}" data-item="${item.itemId}" data-restaurant="${item.restaurantId}">
      <div class="dish-art-wrap">
        ${foodIconTile(item.tags, img)}
        ${pct ? `<span class="deal-badge">%${pct}</span>` : ""}
      </div>
      <p class="dish-name">${item.itemName}</p>
      <p class="dish-meta">${item.restaurantName}</p>
      <p class="dish-price">
        ${listPrice ? `<s class="dish-price-old">${listPrice} TL</s>` : ""}
        <span class="${pct ? "dish-price-now" : ""}">${item.price} TL</span>
      </p>
    </div>
  `;
}

/* ---------------- Onboarding Flows ---------------- */
function onbHero(step, title, sub, backId) {
  return `
    <div class="onboarding-hero">
      <div class="onb-top-row">
        ${backId ? `<button class="back-btn white" id="${backId}" aria-label="Geri">‹</button>` : ""}
        ${orbitLogo(18, true)}
      </div>
      <p class="onboarding-eyebrow">Kişiselleştirme · ${step}/3</p>
      <p class="onboarding-title">${title}</p>
      <p class="onboarding-sub">${sub}</p>
      <div class="onboarding-progress">
        ${[1, 2, 3].map(i => `<div class="dot ${i <= step ? "active" : ""}"></div>`).join("")}
      </div>
    </div>`;
}

function renderPreferencesOnboarding() {
  resetScreenChrome();
  const p = (STATE.user && STATE.user.declaredPreferences) || {};
  const draft = { dietStyle: p.dietStyle || null };

  root.innerHTML = `
    <div class="screen onboarding-screen">
      ${onbHero(1, "Beslenme tarzın nedir?",
        "Orbit AI seçimlerine göre sana özel yemekleri belirleyecek — tek seçim yeterli.",
        "onbBack")}

      <div class="onboarding-grid">
        ${(typeof DIET_OPTIONS !== "undefined" ? DIET_OPTIONS : []).map(d => `
          <div class="onboarding-option ${draft.dietStyle === d.id ? "selected" : ""}" data-id="${d.id}">
            <div class="onboarding-option-icon">${d.icon}</div>
            <span>${d.label}</span>
            <em class="onb-hint">${d.hint}</em>
          </div>
        `).join("")}
      </div>

      <button class="btn-primary" id="onbNext" ${draft.dietStyle ? "" : "disabled"}>Devam Et</button>
      <button class="btn-secondary" id="onbSkip">Şimdi Değil</button>
    </div>
  `;

  const options = document.querySelectorAll(".onboarding-option");
  const nextBtn = document.getElementById("onbNext");
  options.forEach(el => {
    el.addEventListener("click", () => {
      draft.dietStyle = draft.dietStyle === el.dataset.id ? null : el.dataset.id;
      options.forEach(o => o.classList.toggle("selected", o.dataset.id === draft.dietStyle));
      nextBtn.disabled = !draft.dietStyle;
    });
  });

  document.getElementById("onbBack").addEventListener("click", renderPreferences);
  document.getElementById("onbSkip").addEventListener("click", renderHome);
  nextBtn.addEventListener("click", () => {
    if (!draft.dietStyle) return;
    p.dietStyle = draft.dietStyle;
    renderAllergenOnboarding();
  });
}

function renderAllergenOnboarding() {
  resetScreenChrome();
  const avoid = new Set((STATE.user && STATE.user.declaredPreferences && STATE.user.declaredPreferences.allergensToAvoid) || []);
  root.innerHTML = `
    <div class="screen onboarding-screen">
      ${onbHero(2, "Kırmızı çizgilerin neler?", "Bu içerikleri barındıran menülerde asistanın seni uyarır ve korur.", "onbBack")}

      <div class="chip-row onboarding-chip-row">
        ${(typeof ALLERGEN_OPTIONS !== "undefined" ? ALLERGEN_OPTIONS : []).map(a => `<div class="chip allergen-chip ${avoid.has(a) ? "selected" : ""}" data-val="${a}">${a}</div>`).join("")}
      </div>

      <button class="btn-primary" id="onbNext">Devam Et</button>
    </div>
  `;
  document.querySelectorAll(".allergen-chip").forEach(el => {
    el.addEventListener("click", () => el.classList.toggle("selected"));
  });
  document.getElementById("onbBack").addEventListener("click", renderPreferencesOnboarding);
  document.getElementById("onbNext").addEventListener("click", () => {
    if (!STATE.user.declaredPreferences) STATE.user.declaredPreferences = {};
    STATE.user.declaredPreferences.allergensToAvoid =
      Array.from(document.querySelectorAll(".allergen-chip.selected")).map(el => el.dataset.val);
    renderDislikeOnboarding();
  });
}

function renderDislikeOnboarding() {
  resetScreenChrome();
  const dislikes = new Set((STATE.user && STATE.user.declaredPreferences && STATE.user.declaredPreferences.dislikes) || []);
  const save = (list) => {
    if (!STATE.user.declaredPreferences) STATE.user.declaredPreferences = {};
    STATE.user.declaredPreferences.dislikes = list;
    STATE.prefsOnboarded = true;
    toast("Tercihlerin kaydedildi.");
    renderPreferences();
  };

  root.innerHTML = `
    <div class="screen onboarding-screen">
      ${onbHero(3, "Damak tadına uymayanlar?", "Bunlar sonuçları kısıtlamaz — sadece sana uygun olanları üste taşırız.", "onbBack")}

      <div class="chip-row onboarding-chip-row">
        ${(typeof DISLIKE_OPTIONS !== "undefined" ? DISLIKE_OPTIONS : []).map(a => `<div class="chip dislike-chip ${dislikes.has(a) ? "selected" : ""}" data-val="${a}">${a}</div>`).join("")}
      </div>

      <button class="btn-primary" id="onbFinish">Tercihlerimi Kaydet</button>
      <button class="btn-secondary" id="onbSkipStep">Bu adımı atla</button>
    </div>
  `;
  document.querySelectorAll(".dislike-chip").forEach(el => {
    el.addEventListener("click", () => el.classList.toggle("selected"));
  });
  document.getElementById("onbBack").addEventListener("click", renderAllergenOnboarding);
  document.getElementById("onbSkipStep").addEventListener("click", () => save(STATE.user.declaredPreferences.dislikes || []));
  document.getElementById("onbFinish").addEventListener("click", () => {
    save(Array.from(document.querySelectorAll(".dislike-chip.selected")).map(el => el.dataset.val));
  });
}

/* ---------------- Preferences & Profile Screen ---------------- */
function tierConditionsHTML(tier) {
  const g = (STATE.user && STATE.user.orbitGrow) || {};
  const spend = g.rolling90DaySpend || { totalAnyMethod: 0, payWalletOnly: 0 };

  const barRow = (opts) => {
    const pct = Math.min(100, Math.round(opts.now / opts.target * 100));
    const done = opts.now >= opts.target;
    const left = Math.max(0, opts.target - opts.now);
    return `
      <div class="tier-condition-item ${done ? "completed" : "pending"}">
        <span class="cond-icon">${done ? "✓" : "🕒"}</span>
        <div class="cond-text">
          <strong>${opts.title}${opts.info ? `<button type="button" class="cond-info" data-tip="${opts.info}" aria-label="${opts.info}">i</button>` : ""}</strong>
          <div class="cond-bar-wrap" data-tip="${done ? "Tamamlandı" : opts.leftLabel(left)}">
            <div class="cond-prog-bar"><div class="cond-prog-fill ${done ? "done" : ""}" style="width:${pct}%"></div></div>
            <div class="cond-bar-scale">
              <span class="cbs-now">${opts.fmt(Math.min(opts.now, opts.target))}</span>
              <span class="cbs-target">${opts.fmt(opts.target)}</span>
            </div>
          </div>
        </div>
      </div>`;
  };

  const plainRow = (state, icon, title, sub) => `
    <div class="tier-condition-item ${state}">
      <span class="cond-icon">${icon}</span>
      <div class="cond-text"><strong>${title}</strong><span class="cond-sub">${sub}</span></div>
    </div>`;

  const money = (n) => tl(n);
  const moneyLeft = (n) => `${tl(n)} daha harcaman gerekiyor`;

  if (tier === "Base") {
    return plainRow(g.martAccountOpen ? "completed" : "pending", g.martAccountOpen ? "✓" : "🕒",
          "Orbit Mart'ta hesap aç",
          g.martAccountOpen ? "Tamamlandı" : "Base için zorunlu")
      + barRow({
          title: "Son 3 ayda en az 2.500 TL harcama yap",
          info: "Orbit Eats ve Orbit Mart içerisinde yaptığın toplam harcama tutarı",
          now: spend.totalAnyMethod, target: BASE_ACTIVITY_THRESHOLD,
          fmt: money, leftLabel: (n) => `${tl(n)} daha harcaman gerekiyor`
        });
  }

  if (tier === "Plus") {
    return plainRow(g.kycVerified ? "completed" : "pending", g.kycVerified ? "✓" : "🕒",
        "Orbit Pay'de hesap aç ve kimliğini doğrula",
        g.kycVerified ? "Tamamlandı" : "Plus için zorunlu")
      + barRow({
          title: `Son 3 ayda Orbit Mart'tan en az ${PLUS_MART_ORDER_TARGET} market siparişi oluştur`,
          now: g.martOrders90d || 0, target: PLUS_MART_ORDER_TARGET,
          fmt: (n) => `${n} sipariş`,
          leftLabel: (n) => `${n} sipariş daha vermen gerekiyor`
        })
      + barRow({
          title: `Son 3 ayda toplam ${TIER_THRESHOLDS.Plus.minSpend90d.toLocaleString("tr-TR")} TL harcama yap`,
          info: "Orbit Eats ve Orbit Mart içerisinde yaptığın toplam harcama tutarı",
          now: spend.totalAnyMethod, target: TIER_THRESHOLDS.Plus.minSpend90d,
          fmt: money, leftLabel: moneyLeft
        });
  }

  const tenureDays = getTenureDays(STATE.user);
  const standing = (g.standingOrders || 0) >= TIER_THRESHOLDS.Prime.minStandingOrders;
  return plainRow(standing ? "completed" : "pending", standing ? "✓" : "🕒",
      "Orbit Pay'den cüzdanına otomatik yükleme talimatı ver",
      standing ? "Tamamlandı" : "Sipariş tutarı cüzdan bakiyenden yüksek olduğunda eksik tutar kayıtlı kartından tamamlanır.")
    + barRow({
        title: `Son 3 ayda toplam ${TIER_THRESHOLDS.Prime.minSpend90d.toLocaleString("tr-TR")} TL harcama yap`,
        info: "Orbit Eats ve Orbit Mart içerisinde yaptığın toplam harcama tutarı",
        now: spend.totalAnyMethod, target: TIER_THRESHOLDS.Prime.minSpend90d,
        fmt: money, leftLabel: moneyLeft
      })
    + barRow({
        title: "Orbit Eats'te 1 yılı tamamla",
        now: tenureDays, target: TIER_THRESHOLDS.Prime.minTenureDays,
        fmt: (n) => `${Math.floor(n / 30)} ay`,
        leftLabel: (n) => `${Math.ceil(n / 30)} ay daha üyelik gerekiyor`
      });
}

function tierBenefitsHTML(tier) {
  const r = CASHBACK_RATES[tier];
  const item = (icon, title, sub) => `
    <div class="benefit-item">
      <span class="benefit-icon">${icon}</span>
      <div class="benefit-text"><strong>${title}</strong><span>${sub}</span></div>
    </div>`;

  /* Base'de teslimat ücreti bir avantaj değil, standart koşuldur — listelenmez */
  const delivery = tier === "Prime"
    ? item("👑", "Her zaman ücretsiz teslimat", "Tüm siparişlerde ücretsiz teslimat.")
    : tier === "Plus"
      ? item("🍔", `${tl(PLUS_FREE_DELIVERY_MIN)} üzeri ücretsiz teslimat`, `Orbit Pay ile yapılan ${tl(PLUS_FREE_DELIVERY_MIN)} ve üzeri Eats ve Mart alışverişlerinde teslimat ücretsiz.`)
      : "";

  const extras = tier === "Prime"
    ? item("⚡", "Öncelikli kurye", "Siparişlerine kurye ve teslimat önceliği tanımlanır.")
    : "";

  return delivery
    + item("🍽️", `Orbit Eats'te %${Math.round(r.eats * 100)} nakit iade`, `Orbit Pay ile ödediğinde sepet tutarının %${Math.round(r.eats * 100)}'i bakiyene geri yatar.`)
    + item("🛒", `Orbit Mart'ta %${Math.round(r.mart * 100)} nakit iade`, `Orbit Pay ile ödediğinde sepet tutarının %${Math.round(r.mart * 100)}'i bakiyene geri yatar.`)
    + extras;
}

function renderPreferences() {
  resetScreenChrome();
  const grow = (STATE.user && STATE.user.orbitGrow) || {};
  const tb = getTierBadge();
  const activeApiKey = typeof getGeminiKey === "function" ? getGeminiKey() : "";

  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <!-- Profil bir sekme ekranı; geri butonu yok -->
        <div>
          <p class="screen-title">Profilim</p>
        </div>
        <!-- Orbit AI aç/kapa: kapalıyken tüm öneriler yerel kural motorundan gelir -->
        <label class="ai-switch ${aiEnabled() ? "on" : ""}" id="aiSwitchRow" title="Orbit AI (canlı LLM)">
          <span class="ais-label">✨ AI</span>
          <span class="ais-track"><input type="checkbox" id="aiToggle" ${aiEnabled() ? "checked" : ""} /><i></i></span>
        </label>
      </div>

      <div class="profile-user-header">
        <!-- Rozet fotoğrafın sağ üstünde; isim doğrudan görselin altında -->
        <div class="profile-avatar-container">
          <img src="baki-avatar.png?v=246000" alt="Baki" class="profile-avatar-img" />
          <span class="avatar-tier-badge ${getTierBadge().cls}">${getTierBadge().label}</span>
        </div>
        <h2 class="profile-user-name">${STATE.user ? STATE.user.name : "Baki"}</h2>
      </div>

      <div class="profile-menu-section" style="margin-top:14px">
        
        <div class="profile-menu-item" id="menuGrowPuan">
          <div class="menu-icon">✨</div>
          <div class="menu-content">
            <p class="menu-title" style="white-space:nowrap">Orbit Eats Avantajları</p>
            <p class="menu-sub">Orbit Grow seviye ayrıcalıkları ve ödül matrisiniz</p>
          </div>
          <span class="menu-arrow">›</span>
        </div>

        <div class="profile-menu-item pref-row ${dietFilterOn() ? "" : "disabled"}">
          <div class="menu-icon">🥗</div>
          <button class="menu-content pref-open" id="menuPrefs" ${dietFilterOn() ? "" : "disabled"}>
            <p class="menu-title">Beslenme Tercihlerim</p>
            <p class="menu-sub" id="prefSummary">${dietSummaryLine()}</p>
          </button>
          <label class="pref-switch ${dietFilterOn() ? "on" : ""}" id="dietSwitchRow" title="Beslenme tercihine göre süzme">
            <input type="checkbox" id="dietToggle" ${dietFilterOn() ? "checked" : ""} />
            <i></i>
          </label>
        </div>

        <div class="profile-menu-item" id="menuCards">
          <div class="menu-icon">💳</div>
          <div class="menu-content">
            <p class="menu-title">Kayıtlı Kartlarım</p>
            <p class="menu-sub">Kayıtlı kartların Orbit Pay'in güvenli altyapısında saklanmaktadır</p>
          </div>
          <span class="menu-arrow">›</span>
        </div>

        <div class="profile-menu-item" id="menuOrders" style="margin-top:4px">
          <div class="menu-icon">📜</div>
          <div class="menu-content">
            <p class="menu-title">Sipariş Geçmişim & Fatura</p>
            <p class="menu-sub">Tüm Orbit Eats siparişleriniz ve faturaları</p>
          </div>
          <span class="menu-arrow">›</span>
        </div>
      </div>

      <!-- Nakit iade dökümü: tek seri sütun grafik (efsane gerekmez, başlık seriyi adlandırır) -->
      <div id="cashbackModal" class="tier-modal-overlay" style="display:none">
        <div class="tier-modal-content">
          <div class="tier-modal-header">
            <button class="modal-close-btn back" id="closeCashbackModal" aria-label="Geri">‹</button>
            <h3><span>💸</span>Nakit İade Dökümü</h3>
          </div>
          <div class="tier-modal-body">
            ${(() => {
              const w = grow.cashbackWeekly || [];
              const max = Math.max(...w.map(x => x.amount), 1);
              const best = w.reduce((a, b) => b.amount > a.amount ? b : a, w[0] || {});
              const total = cashback90d();
              const avg = w.length ? total / w.length : 0;
              return `
                <div class="cb-hero">
                  <span class="cbh-value">${tl(total)}</span>
                  <span class="cbh-sub">${w.length ? `${weekAxisLabel(w[0].start)} – ${weekRangeLabel(w[w.length - 1].start).split("–").pop().trim()} arasında Orbit Pay bakiyene yatan toplam` : "Orbit Pay bakiyene yatan toplam"}</span>
                </div>

                <div class="cb-chart" role="img" aria-label="Haftalık nakit iade dağılımı">
                  <div class="cbc-bars">
                    ${w.map((x, i) => `
                      <div class="cbc-col" data-tip="${weekRangeLabel(x.start)} · ${tl(x.amount)}">
                        <div class="cbc-bar ${x.amount === best.amount ? "best" : ""}" style="height:${Math.round(x.amount / max * 100)}%"></div>
                        <span class="cbc-x">${i % 2 === 1 ? weekAxisLabel(x.start) : ""}</span>
                      </div>
                    `).join("")}
                  </div>
                  <div class="cbc-avg" style="bottom:${Math.round(avg / max * 100)}%"><span>ort. ${tl(avg)}</span></div>
                </div>
                <p class="cb-axis-note">Her sütun bir haftadır; etiketler o haftanın başlangıç tarihidir.</p>

                <div class="cb-stats">
                  <div class="cbs-item"><span>En yüksek hafta</span><strong>${tl(best.amount || 0)}</strong><em>${best.start ? weekRangeLabel(best.start) : ""}</em></div>
                  <div class="cbs-item"><span>Haftalık ortalama</span><strong>${tl(avg)}</strong><em>12 hafta</em></div>
                </div>

                <p class="cb-note">Nakit iade yalnızca Orbit Pay ile ödediğin Orbit Eats ve Orbit Mart siparişlerinden birikir.</p>
              `;
            })()}
          </div>
        </div>
      </div>

      <div id="growModal" class="tier-modal-overlay" style="display:none">
        <div class="tier-modal-content">
          <div class="tier-modal-body">
            <div class="prominent-loyalty-card full-bleed">
              <button class="modal-close-btn on-card back" id="closeGrowModal" aria-label="Geri">‹</button>
              <span class="plc-badge ${tb.cls}">${tb.memberLabel}</span>
              <!-- Tek bir hikâye: dönem + metrik + tutar, ardından tek CTA -->
              <p class="plc-eyebrow">Son 90 günde kazandığın toplam nakit iade</p>
              <div class="plc-pts-val">
                <span>${tl(cashback90d())}</span>
              </div>
              <button class="plc-detail-btn" id="cashbackBtn">
                <span class="plc-detail-spark" aria-hidden="true">
                  ${(grow.cashbackWeekly || []).slice(-7).map(w => {
                    const max = Math.max(...(grow.cashbackWeekly || [{amount:1}]).map(x => x.amount));
                    return `<i style="height:${Math.max(22, Math.round(w.amount / max * 100))}%"></i>`;
                  }).join("")}
                </span>
                Kazanç detaylarını gör
                <span class="plc-detail-go">›</span>
              </button>
            </div>

            <div class="tier-tabs-row">
              ${["Base", "Plus", "Prime"].map(t => `
                <button class="tier-tab-pill ${t === tb.tier ? "active is-current" : ""}" data-tier="${t.toLowerCase()}">${t === "Base" ? "" : "✦ "}${t}</button>
              `).join("")}
            </div>

            <div class="tier-section-block">
              <h4 class="tier-section-title" id="tierSectionTitle">${tb.tier} Statü Şartları</h4>
              <div id="tierConditionsContainer">${tierConditionsHTML(tb.tier)}</div>
            </div>

            <div class="tier-section-block">
              <h4 class="tier-section-title" id="benefitsSectionTitle">${tb.tier} Statü Avantajları</h4>
              <div id="tierBenefitsContainer">${tierBenefitsHTML(tb.tier)}</div>
            </div>

            <div class="tier-rules-card" style="margin-top:14px">
              <div class="tier-rules-header" id="toggleTierRules">
                <h4>ℹ️ Bilgilendirme</h4>
                <span class="tier-rules-arrow" id="tierRulesArrow">▾</span>
              </div>
              <ul id="tierRulesContent" style="display:none; margin-top:10px;">
                <li>Nakit iadeler doğrudan <strong>Orbit Pay bakiyene</strong> yatar.</li>
                <li>Seviyen <strong>son 90 günlük işlem hareketlerine</strong> göre hesaplanır. 3 ay içinde bir üst segmente geçebilirsin; alt segmente düşüş değerlendirmesi <strong>3 aylık periyot sonunda</strong> yapılır.</li>
                <li>Nakit iade yalnızca <strong>Orbit Pay ile yapılan harcamalarda</strong> yüklenir.</li>
                <li>Nakit iadeler <strong>devredilemez</strong> ve nakit olarak transfer edilemez.</li>
                <li>Sadakat programı başladığı anda kullanıcılar <strong>ilave bir işlem yapmaksızın</strong> mevcut durumlarına göre ilgili segmentasyona geçer.</li>
                <li>Orbit Eats, işbu programın detay ve koşullarını <strong>tek taraflı olarak</strong> değiştirebilir; segmentasyonlara yeni görevler ekleyebilir ve farklı avantajlar sağlayabilir.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div id="cardsModal" class="tier-modal-overlay" style="display:none">
        <div class="tier-modal-content">
          <div class="modal-blue-hero-header">
            <span class="eyebrow-tag">ÖDEME YÖNTEMLERİM</span>
            <h3>Kayıtlı Kartlarım</h3>
            <p>Orbit Eats'te doğrudan ödeme için sakladığın banka ve kredi kartların.</p>
            <button class="modal-close-btn back" id="closeCardsModal" aria-label="Geri">‹</button>
          </div>
          
          <div class="tier-modal-body" style="padding-top:4px">
            <div class="saved-card-item default">
              <div class="sc-left">
                <span class="sc-bank-icon">💳</span>
                <div class="sc-info">
                  <div class="sc-name-row">
                    <strong>Garanti BBVA Bonus</strong>
                    <span class="sc-default-badge">Varsayılan</span>
                  </div>
                  <span class="sc-number">•••• •••• •••• 4821</span>
                  <span class="sc-exp">Son Kullanma: 08/28</span>
                </div>
              </div>
              <button class="sc-action-btn" onclick="toast('Kart düzenleme açıldı.')">Düzenle</button>
            </div>

            <div class="saved-card-item">
              <div class="sc-left">
                <span class="sc-bank-icon">💳</span>
                <div class="sc-info">
                  <div class="sc-name-row">
                    <strong>Yapı Kredi World</strong>
                  </div>
                  <span class="sc-number">•••• •••• •••• 9104</span>
                  <span class="sc-exp">Son Kullanma: 11/27</span>
                </div>
              </div>
              <button class="sc-action-btn" onclick="toast('Kart düzenleme açıldı.')">Düzenle</button>
            </div>

            <button class="add-new-card-btn" id="addNewCardBtn">+ Yeni Kart Ekle</button>

          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("menuPrefs").addEventListener("click", renderPreferencesOnboarding);

  const toggleRules = document.getElementById("toggleTierRules");
  if (toggleRules) {
    toggleRules.addEventListener("click", () => {
      const content = document.getElementById("tierRulesContent");
      const arrow = document.getElementById("tierRulesArrow");
      if (!content) return;
      const isHidden = content.style.display === "none";
      content.style.display = isHidden ? "block" : "none";
      if (arrow) arrow.textContent = isHidden ? "▴" : "▾";
    });
  }

  // Diyet süzmesi anahtarı — alerjen korumasına dokunmaz
  const dietToggle = document.getElementById("dietToggle");
  if (dietToggle) {
    dietToggle.addEventListener("change", (e) => {
      const acik = e.target.checked;
      setDietFilter(acik);
      document.getElementById("dietSwitchRow").classList.toggle("on", acik);
      document.querySelector(".pref-row").classList.toggle("disabled", !acik);
      document.getElementById("menuPrefs").disabled = !acik;
      document.getElementById("prefSummary").textContent = dietSummaryLine();

      if (acik) {
        toast("Beslenme tercihine göre süzme açık.");
      } else {
        toast("Süzme kapatıldı — tercihlerin kayıtlı, alerjen koruman sürüyor.");
      }
    });
  }
  document.getElementById("menuOrders").addEventListener("click", renderOrdersHistory);

  // Orbit AI aç/kapa anahtarı
  const aiToggle = document.getElementById("aiToggle");
  if (aiToggle) {
    aiToggle.addEventListener("change", (e) => {
      setAiEnabled(e.target.checked);
      document.getElementById("aiSwitchRow").classList.toggle("on", e.target.checked);
      toast(e.target.checked
        ? "✨ Orbit AI açık — öneriler canlı modelden gelecek."
        : "Orbit AI kapalı — yerel öneri motoru devrede.");
    });
  }

  const cashbackModal = document.getElementById("cashbackModal");
  const cbBtn = document.getElementById("cashbackBtn");
  if (cbBtn) cbBtn.addEventListener("click", () => { mountSheetToShell(cashbackModal); openSheet(cashbackModal); });
  document.getElementById("closeCashbackModal").addEventListener("click", () => { cashbackModal.style.display = "none"; });
  cashbackModal.addEventListener("click", (e) => { if (e.target === cashbackModal) cashbackModal.style.display = "none"; });

  const growModal = document.getElementById("growModal");
  document.getElementById("menuGrowPuan").addEventListener("click", () => {
    mountSheetToShell(growModal);
    openSheet(growModal);
  });
  document.getElementById("closeGrowModal").addEventListener("click", () => {
    growModal.style.display = "none";
  });
  growModal.addEventListener("click", (e) => {
    if (e.target === growModal) growModal.style.display = "none";
  });

  const cardsModal = document.getElementById("cardsModal");
  document.getElementById("menuCards").addEventListener("click", () => {
    mountSheetToShell(cardsModal);
    openSheet(cardsModal);
  });
  document.getElementById("closeCardsModal").addEventListener("click", () => {
    cardsModal.style.display = "none";
  });
  cardsModal.addEventListener("click", (e) => {
    if (e.target === cardsModal) cardsModal.style.display = "none";
  });

  const addNewCardBtn = document.getElementById("addNewCardBtn");
  if (addNewCardBtn) {
    addNewCardBtn.addEventListener("click", () => {
      toast("💳 Yeni kart ekleme ekranı açılıyor…");
    });
  }

  const tierTabs = document.querySelectorAll(".tier-tab-pill");
  const conditionsContainer = document.getElementById("tierConditionsContainer");
  const benefitsContainer = document.getElementById("tierBenefitsContainer");
  const tierTitleElem = document.getElementById("tierSectionTitle");
  const benefitsTitleElem = document.getElementById("benefitsSectionTitle");

  tierTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tierTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const map = { base: "Base", plus: "Plus", prime: "Prime" };
      const selected = map[tab.dataset.tier] || "Base";

      if (tierTitleElem) tierTitleElem.textContent = `${selected} Statü Şartları`;
      if (benefitsTitleElem) benefitsTitleElem.textContent = `${selected} Statü Avantajları`;
      if (conditionsContainer) conditionsContainer.innerHTML = tierConditionsHTML(selected);
      if (benefitsContainer) benefitsContainer.innerHTML = tierBenefitsHTML(selected);
    });
  });
}

/* ---------------- Natural Language & Static Search ---------------- */
function searchStaticCatalog(query) {
  if (!query || !query.trim()) return [];
  const qNorm = (typeof normalizeTerm === "function" ? normalizeTerm(query) : query.toLowerCase().trim());
  const terms = qNorm.split(/\s+/).filter(t => t.length >= 2);
  const results = [];

  const rests = (STATE.restaurants && STATE.restaurants.length) ? STATE.restaurants : (typeof RESTAURANTS !== "undefined" ? RESTAURANTS : []);

  rests.forEach(r => {
    const rName = typeof normalizeTerm === "function" ? normalizeTerm(r.name) : r.name.toLowerCase();
    const rCuisine = typeof normalizeTerm === "function" ? normalizeTerm(r.cuisine) : r.cuisine.toLowerCase();
    const rTags = typeof normalizeTerm === "function" ? normalizeTerm((r.tags || []).join(" ")) : (r.tags || []).join(" ").toLowerCase();

    const isRestMatch = rName.includes(qNorm) || qNorm.includes(rName) || terms.some(t => rName.includes(t) || rCuisine.includes(t) || rTags.includes(t));

    (r.menu || []).forEach(m => {
      const mName = typeof normalizeTerm === "function" ? normalizeTerm(m.name) : m.name.toLowerCase();
      const mIng = typeof normalizeTerm === "function" ? normalizeTerm((m.ingredients || []).join(" ")) : (m.ingredients || []).join(" ").toLowerCase();
      const mTags = typeof normalizeTerm === "function" ? normalizeTerm((m.tags || []).join(" ")) : (m.tags || []).join(" ").toLowerCase();

      const isMenuMatch = isRestMatch || mName.includes(qNorm) || qNorm.includes(mName) || terms.some(t => mName.includes(t) || mIng.includes(t) || mTags.includes(t));

      if (isMenuMatch) {
        results.push({
          itemId: m.id,
          itemName: m.name,
          restaurantId: r.id,
          restaurantName: r.name,
          price: m.price,
          rating: r.rating,
          deliveryMinutes: r.deliveryMinutes,
          distanceKm: r.distanceKm,
          allergens: m.allergens,
          tags: m.tags || [],
          image: m.image || r.image
        });
      }
    });
  });

  return results;
}

function runAiSearch(query) {
  resetScreenChrome();
  STATE.lastQuery = query;
  const staticResults = searchStaticCatalog(query);
  const results = staticResults.length > 0 ? staticResults : aiSearch(query);
  STATE.lastSearchResults = results;
  renderSearchResults(results, query);
}

function renderSearchResults(results, query) {
  resetScreenChrome();
  const groups = [];
  results.forEach(r => {
    let g = groups.find(g => g.restaurantId === r.restaurantId);
    if (!g) { g = { restaurantId: r.restaurantId, restaurantName: r.restaurantName, items: [] }; groups.push(g); }
    g.items.push(r);
  });

  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back-btn" id="back">‹</button>
        <div>
          <p class="screen-title">${results.length === 0 ? "Arama Sonuçları" : "Senin için seçtim"}</p>
          <p class="screen-subtitle">"${query}"</p>
        </div>
      </div>
      ${results.length === 0 ? `
        <div class="empty-search-state">
          <div class="ess-icon">🔍</div>
          <p class="ess-title">Arama kriterlerinize uygun bir sonuç bulunamadı</p>
          <p class="ess-sub">Orbit Eats şu an yalnızca restoran ve yemek siparişleri için hizmet vermektedir. Lütfen restoran, mutfak veya yemek adı (örn: Burger, Kebap, Pizza, Mantı) girerek tekrar deneyiniz.</p>
          <button class="btn-primary" id="essBack">Keşfetmeye devam et</button>
        </div>
      ` : ""}
      ${groups.map(g => `
        <div class="restaurant-group">
          <div class="restaurant-group-header">
            <svg width="15" height="15" viewBox="0 0 48 48"><use href="#icon-store"/></svg>
            <span>${g.restaurantName}</span>
          </div>
          ${g.items.map(r => {
            const tier = currentTier();
            const pct = CASHBACK_RATES[tier].eats;
            const cashbackTRY = Math.round((r.price || 0) * pct * 100) / 100;
            return `
              <div class="result-card" data-item="${r.itemId}" data-restaurant="${r.restaurantId}">
                ${foodIconTile(r.tags)}
                <div class="result-body">
                  <div class="result-title-row">
                    <p class="result-name">${r.itemName}</p>
                    <span class="result-price">${r.price} TL</span>
                  </div>
                  <p class="result-sub">⭐ ${r.rating} · ${r.deliveryMinutes} dk</p>
                  <!-- İade yalnızca cüzdan ödemesinde geçerli; koşul rozetin içinde -->
                  <div class="orbit-points-badge">✦ Orbit Pay ile ${tl(cashbackTRY)} iade</div>
                  ${dietFilterOn() && r.allergens && r.allergens.length ? `<div class="allergen-warning">⚠️ İçerir: ${r.allergens.join(", ")} — restoran beyanıdır, teyit ediniz.</div>` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `).join("")}
    </div>
  `;
  document.getElementById("back").addEventListener("click", renderHome);
  const essBack = document.getElementById("essBack");
  if (essBack) essBack.addEventListener("click", renderHome);
  document.querySelectorAll("[data-restaurant]").forEach(el => {
    el.addEventListener("click", () => openRestaurant(el.dataset.restaurant, el.dataset.item));
  });
}

/* ---------------- Restaurant & Checkout ---------------- */
function openRestaurant(restaurantId, highlightItemId) {
  resetScreenChrome();
  const r = STATE.restaurants.find(x => x.id === restaurantId);
  if (!r) return;
  STATE.activeRestaurant = r;
  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back-btn" id="back">‹</button>
        <div>
          <p class="screen-title">${r.name}</p>
          <p class="screen-subtitle">${r.cuisine} · ⭐ ${r.rating} · ${r.deliveryMinutes} dk</p>
        </div>
      </div>
      <div class="section-title"><span>Menü</span></div>
      ${r.menu.map(m => menuRowHTML(m, m.id === highlightItemId)).join("")}
      <button class="btn-primary go-cart-bar" id="goCart" style="${cartCount() ? "" : "display:none"}">
        <span class="gcb-left">Sepete Git (${cartCount()} ürün)</span>
        <span class="gcb-right">
          <span class="gcb-total">Toplam: <strong>${cartTotal()} TL</strong></span>
          <span class="gcb-arrow">›</span>
        </span>
      </button>
    </div>
  `;
  document.getElementById("back").addEventListener("click", () => STATE.lastSearchResults.length ? renderSearchResults(STATE.lastSearchResults, STATE.lastQuery) : renderHome());
  bindQtyButtons();
  const goCart = document.getElementById("goCart");
  if (goCart) goCart.addEventListener("click", renderCheckout);
}

function menuRowHTML(m, highlight) {
  const inCart = STATE.cart[m.id];
  const qty = inCart ? inCart.qty : 0;
  return `
    <div class="menu-item-row" style="${highlight ? "border:2px solid var(--orbit-ai)" : ""}">
      <div class="menu-item-info">
        <p class="menu-item-name">${m.name} <span class="menu-item-price-text">· ${m.price} TL</span></p>
        <p class="menu-item-tags">${m.calories} kcal</p>
        ${dietFilterOn() && m.allergens && m.allergens.length ? (() => {
          // Kullanıcının kaçındığı alerjen ayrıca vurgulanır; karar her zaman kullanıcıda
          // Süzme kapalıyken kişisel uyarı yapılmaz, yalnızca içerik bilgisi verilir
          const avoided = ((STATE.user && STATE.user.declaredPreferences &&
              STATE.user.declaredPreferences.allergensToAvoid) || [])
              .filter(a => m.allergens.includes(a));
          const digerleri = m.allergens.filter(a => !avoided.includes(a));
          return `<p class="menu-allergen ${avoided.length ? "critical" : ""}">
            <span>⚠️</span>
            <span>${avoided.length
              ? `<strong>Kaçındığın içerik: ${avoided.join(", ")}</strong>${digerleri.length ? ` · Ayrıca içerir: ${digerleri.join(", ")}` : ""}`
              : `İçerir: ${m.allergens.join(", ")}`} — restoran beyanıdır, teyit ediniz.</span>
          </p>`;
        })() : ""}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${qty > 0 ? `<button class="qty-btn" data-action="dec" data-item="${m.id}">−</button><span>${qty}</span>` : ""}
        <button class="qty-btn ${qty > 0 ? "filled" : ""}" data-action="inc" data-item="${m.id}">+</button>
      </div>
    </div>
  `;
}

function bindQtyButtons() {
  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.item;
      const m = STATE.activeRestaurant.menu.find(x => x.id === itemId);
      const r = STATE.activeRestaurant;
      if (btn.dataset.action === "inc") {
        addToCart({ itemId: m.id, itemName: m.name, price: m.price, restaurantId: r.id, restaurantName: r.name });
      } else {
        removeFromCart(itemId);
      }
      openRestaurant(STATE.activeRestaurant.id);
    });
  });
}

/* Otomatik yükleme talimatı: saklı karttan tekrarlayan çekim demek olduğu için
   açık rıza gerektirir ve kullanıcı istediği an geri alabilir. */
function autoTopUpOn() {
  return !!(((STATE.user || {}).orbitPay || {}).autoTopUpConsent);
}
function setAutoTopUp(on) {
  if (STATE.user && STATE.user.orbitPay) STATE.user.orbitPay.autoTopUpConsent = !!on;
}

/* Cüzdan bakiyesi tek noktadan okunur */
function walletBalance() {
  return ((STATE.user || {}).orbitPay || {}).balanceTRY || 0;
}

/* Hızlı yükleme tutarları: önce eksik tutar, sonra yuvarlak paketler.
   Yuvarlak seçenekler her zaman eksik tutarın üstünde kalır. */
function topUpOptions(missing) {
  const exact = Math.round(missing * 100) / 100;
  // Yuvarlak paketler yalnızca hızlı seçim; ek bakiye bilgisi verilmez
  const packs = [500, 1000, 2000, 5000].filter(v => v > exact).slice(0, 2);
  return [{ amount: exact, label: "eksik tutar" }]
    .concat(packs.map(v => ({ amount: v, label: "" })));
}

function renderCheckout() {
  resetScreenChrome();
  setActiveTab("cart");
  const total = cartTotal();
  const u = STATE.user || { orbitPay: { balanceTRY: 0 } };

  // Sekmeden boş sepetle girilebilir
  if (cartCount() === 0) {
    root.innerHTML = `
      <div class="screen checkout-screen">
        <div class="screen-header">
          <button class="back-btn" id="back">‹</button>
          <div><p class="screen-title">Sepetim</p></div>
        </div>
        <div class="empty-cart">
          <div class="ec-art">🛒</div>
          <p class="ec-title">Sepetin şu an boş</p>
          <p class="ec-sub">Bugün canın ne çekiyorsa söyle, Orbit AI senin için seçsin.</p>
          <button class="btn-primary" id="ecBrowse">Keşfetmeye başla</button>
        </div>
      </div>
    `;
    document.getElementById("back").addEventListener("click", renderHome);
    document.getElementById("ecBrowse").addEventListener("click", renderHome);
    return;
  }
  root.innerHTML = `
    <div class="screen checkout-screen">
      <div class="screen-header">
        <button class="back-btn" id="back">‹</button>
        <div>
          <p class="screen-title">Sepetim</p>
        </div>
      </div>

      <!-- 1. blok: ne alıyorsun -->
      <section class="checkout-block order-block">
        <div class="cb-head">
          <span class="cb-step">Siparişin</span>
          <button class="clear-cart-btn" id="clearCartBtn">Sepeti boşalt</button>
        </div>
        ${Object.entries(STATE.cart).map(([id, c]) => `
          <div class="checkout-row">
            <span>${c.qty}x ${c.name}</span>
            <span class="cr-right">
              <span>${c.qty * c.price} TL</span>
              <button class="cart-remove-btn" data-remove="${id}" aria-label="${c.name} ürününü çıkar">✕</button>
            </span>
          </div>
        `).join("")}
        <div class="delivery-block">
          <div class="checkout-row bare">
            <span class="muted">Teslimat</span>
            <span id="deliveryFeeVal"></span>
          </div>
          <p class="delivery-hint" id="deliveryHint"></p>
        </div>
        <div class="checkout-row total"><span>Toplam</span><span id="orderTotalVal"></span></div>
      </section>

      <!-- 2. blok: nasıl ödüyorsun -->
      <div class="cb-divider"></div>
      <section class="checkout-block pay-block">
        <div class="cb-head">
          <span class="cb-step">Ödeme Seçenekleri</span>
        </div>

        <!-- Seçenek 1: cüzdan -->
        <p class="pay-group-title">Orbit Cüzdan ile Öde</p>
        <div class="pay-method-card wallet-method" data-method="orbitpay" id="method-orbitpay">
          <div class="pay-method-head">
            <div class="pay-method-icon wallet">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H17v3"/><path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7H5.5A2.5 2.5 0 0 1 3 7.5Z"/><circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none"/>
              </svg>
            </div>
            <div style="flex:1">
              <p class="pm-title">Orbit Pay Cüzdan</p>
              <span class="pay-gain" data-gain-for="orbitpay"></span>
            </div>
            <input type="radio" name="payMethod" data-method-radio="orbitpay" />
          </div>

          <!-- Cüzdan durumu: bakiye ve yetersizlik uyarısı -->
          <div class="wallet-panel" id="walletPanel">
            <div class="wp-top">
              <span class="wp-label">Cüzdan bakiyesi</span>
              <strong class="wp-balance" id="wpBalance"></strong>
            </div>
            <div class="wp-foot" id="wpFoot"></div>
          </div>
        </div>

        <!-- Seçenek 2: Orbit Eats'te saklı kartlar -->
        <p class="pay-group-title">Kayıtlı Banka / Kredi Kartı ile Öde</p>
        ${STATE.savedCards.map(c => `
          <div class="pay-method-card" data-method="${c.id}" id="method-${c.id}">
            <div class="pay-method-head">
              <div class="pay-method-icon">🏦</div>
              <div style="flex:1">
                <p class="pm-title">${c.label || "Kredi / Banka Kartı"}</p>
                <p class="pm-sub">•••• ${c.last4}</p>
                <span class="pay-gain" data-gain-for="${c.id}"></span>
              </div>
              <input type="radio" name="payMethod" data-method-radio="${c.id}" />
            </div>
          </div>
        `).join("")}

        <button class="btn-secondary" id="addCardBtn" style="border-style:dashed;color:var(--orbit-primary-dark)">+ Yeni Kart Ekle</button>
      </section>

      <div class="checkout-cta">
        <div class="auto-on" id="autoOn">
          <span>⚡ Otomatik yükleme açık</span>
          <button type="button" id="autoTopUpOff">Kapat</button>
        </div>
        <button class="btn-primary" id="placeOrder">Siparişi Onayla</button>
        <p class="cta-note" id="ctaNote"></p>
      </div>

      <!-- Hızlı yükleme sheet'i: kayıtlı karttan cüzdana anında fonlama -->
      <div id="topUpModal" class="tier-modal-overlay" style="display:none">
        <div class="tier-modal-content">
          <div class="tier-modal-header">
            <button class="modal-close-btn back" id="closeTopUp" aria-label="Geri">‹</button>
            <h3><span>⚡</span>Bakiye Yükle</h3>
          </div>
          <div class="tier-modal-body">
            <div class="tu-hero">
              <span class="tu-hero-label">Orbit Pay bakiyen</span>
              <strong class="tu-hero-val" id="tuCurrent"></strong>
              <span class="tu-hero-after" id="tuAfter"></span>
            </div>

            <p class="tu-section">Yüklenecek tutar</p>
            <div class="tu-chips" id="tuChips"></div>
            <!-- Hazır tutarlar yetmediğinde kullanıcı kendi tutarını yazar -->
            <div class="tu-custom" id="tuCustom">
              <label for="tuCustomInput">Farklı tutar</label>
              <div class="tu-custom-field">
                <input id="tuCustomInput" type="number" inputmode="decimal" min="1" step="1" placeholder="0" />
                <span>TL</span>
              </div>
            </div>
            <p class="tu-warn" id="tuWarn"></p>

            <p class="tu-section">Yükleme kaynağı</p>
            <div class="tu-cards" id="tuCards"></div>

            <!-- Otomatik yükleme saklı karttan tekrarlayan çekim doğurur: açık rıza şart -->
            <label class="ac-row" id="autoConsent">
              <input type="checkbox" id="autoTopUpConsent" />
              <span class="ac-box"></span>
              <span class="ac-text">
                Bundan sonra bakiyem yetersiz kaldığında eksik tutarın
                <strong>kayıtlı kartımdan</strong> Orbit Pay cüzdanıma
                otomatik aktarılmasını onaylıyorum.
                <button type="button" class="ac-link" id="autoTopUpTerms">Koşullar</button>
              </span>
            </label>

            <button class="btn-primary" id="doTopUp"></button>
            <p class="tu-note">Onay vermezsen sorun değil — her siparişte buradan tek seferlik yükleme yapabilirsin.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById("back").addEventListener("click", () => STATE.activeRestaurant ? openRestaurant(STATE.activeRestaurant.id) : renderAiChat());

  document.getElementById("clearCartBtn").addEventListener("click", () => {
    STATE.cart = {};
    toast("Sepetin boşaltıldı.");
    renderCheckout();
  });
  document.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = STATE.cart[btn.dataset.remove];
      delete STATE.cart[btn.dataset.remove];
      if (item) toast(`${item.name} sepetten çıkarıldı.`);
      renderCheckout();
    });
  });

  function syncPayMethodUI() {
    document.querySelectorAll(".pay-method-card").forEach(el => {
      const selected = el.dataset.method === STATE.selectedPayMethod;
      el.style.borderColor = selected ? "var(--orbit-primary)" : "var(--orbit-border)";
      const radio = el.querySelector("[data-method-radio]");
      if (radio) radio.checked = selected;
    });
    const orbitSelected = STATE.selectedPayMethod === "orbitpay";
    const tier = currentTier();
    const vertical = "eats";

    const del = getDeliveryFee(total, vertical, STATE.selectedPayMethod, tier);
    const grand = total + del.fee;
    STATE.orderTotal = grand;
    document.getElementById("deliveryFeeVal").innerHTML = del.free
      ? `<span class="fee-struck">${tl(STANDARD_DELIVERY_FEE)}</span> <span class="free-delivery">Ücretsiz 🎉</span>`
      : tl(del.fee);
    const hintEl = document.getElementById("deliveryHint");
    // Tasarruf tutarı kullanıcıya söylenmiyor; yalnızca eşiğe kalan miktar
    hintEl.textContent = (!del.free && orbitSelected && del.hint) ? del.hint : "";
    hintEl.className = "delivery-hint" + (del.free ? " ok" : del.hint ? " warn" : "");
    document.getElementById("orderTotalVal").textContent = tl(grand);

    /* Nakit iade sepet tutarı üzerinden; teslimat ücretine iade verilmez */
    const payCb = getCheckoutCashback("orbitpay", total, vertical, tier);
    const cardCb = getCheckoutCashback("card", total, vertical, tier);
    document.querySelectorAll("[data-gain-for]").forEach(el => {
      const isPay = el.dataset.gainFor === "orbitpay";
      const cb = isPay ? payCb : cardCb;
      if (cb.amount > 0) {
        el.style.display = "";
        el.textContent = `%${cb.ratePct} nakit iade · ${tl(cb.amount)}`;
        el.classList.toggle("best", isPay);
      } else {
        el.style.display = "none";
      }
    });

    const cur = getCheckoutCashback(STATE.selectedPayMethod, total, vertical, tier);
    const placeOrderBtn = document.getElementById("placeOrder");
    const ctaNote = document.getElementById("ctaNote");
    const panel = document.getElementById("walletPanel");

    // ---- Cüzdan paneli: bakiye ve yetersizlik uyarısı ----
    const balance = walletBalance();
    const missing = Math.max(0, Math.round((grand - balance) * 100) / 100);
    const consent = autoTopUpOn();
    STATE.walletShortfall = missing;
    panel.classList.toggle("is-open", orbitSelected);
    document.getElementById("wpBalance").textContent = tl(balance);

    const foot = document.getElementById("wpFoot");
    if (missing > 0 && !consent) {
      // Eksik tutar burada gösterilmez; kullanıcı yükleme ekranında görür
      foot.className = "wp-foot short";
      foot.innerHTML = `
        <span class="wp-short-text">⚠️ Yetersiz bakiye</span>
        <button class="wp-topup-btn" id="openTopUp">Para Yükle</button>`;
      document.getElementById("openTopUp").addEventListener("click", (e) => {
        e.stopPropagation();
        openTopUpSheet(missing, grand);
      });
    } else if (missing > 0) {
      foot.className = "wp-foot auto";
      foot.innerHTML = `<span>⚡ Eksik tutar onayına göre kayıtlı kartından otomatik yüklenecek.</span>`;
    } else {
      foot.className = "wp-foot";
      foot.innerHTML = "";
    }

    document.getElementById("autoOn").classList.toggle("show", orbitSelected && consent);

    // Cüzdan kartının çeperi bakiye durumunu taşır: yeşil yeterli, kırmızı yetersiz
    const walletCard = document.getElementById("method-orbitpay");
    walletCard.classList.toggle("balance-ok", orbitSelected && missing === 0);
    walletCard.classList.toggle("balance-short", orbitSelected && missing > 0 && !consent);

    // ---- Ana buton: her durumda "Siparişi Onayla" ----
    placeOrderBtn.textContent = "Siparişi Onayla";
    placeOrderBtn.classList.remove("split");
    placeOrderBtn.classList.toggle("reward", orbitSelected);

    if (orbitSelected && missing > 0 && !consent) {
      // Rıza yoksa her sipariş için tek seferlik yükleme gerekir
      placeOrderBtn.disabled = true;
      ctaNote.className = "cta-note warn show";
      ctaNote.innerHTML = `Cüzdan bakiyen yetmiyor. <strong>Para Yükle</strong> ile cüzdanını doldur ya da aşağıdaki kayıtlı kartlarından biriyle öde.`;
    } else if (orbitSelected) {
      // İade tutarı zaten cüzdan kartındaki rozette yazıyor, altta tekrar edilmiyor
      placeOrderBtn.disabled = false;
      ctaNote.className = "cta-note";
      ctaNote.textContent = "";
    } else {
      placeOrderBtn.disabled = false;
      ctaNote.className = "cta-note muted show";
      ctaNote.textContent = "Kartla ödemede nakit iade kazanılmaz.";
    }
  }

  /* ---- Hızlı yükleme sheet'i ---- */
  function openTopUpSheet(missing, grand) {
    const modal = document.getElementById("topUpModal");
    const options = topUpOptions(missing);
    STATE.topUpAmount = options[0].amount;
    // Kayıtlı kart olmayabilir; kaynak seçimi boş durumda null kalır
    STATE.topUpSource = STATE.savedCards.length ? STATE.savedCards[0].id : null;

    document.getElementById("tuCurrent").textContent = tl(walletBalance());
    document.getElementById("tuChips").innerHTML = options.map(o => `
      <button class="tu-chip ${o.amount === STATE.topUpAmount ? "active" : ""}" data-amount="${o.amount}">
        <strong>${tl(o.amount)}</strong>
        ${o.label ? `<span>${o.label}</span>` : ""}
      </button>
    `).join("");
    const hasCards = STATE.savedCards.length > 0;
    if (!hasCards) STATE.topUpSource = null;
    // Kayıtlı kart yoksa yükleme yapılamaz; kullanıcı önce kart ekler
    document.getElementById("tuCards").innerHTML = hasCards
      ? STATE.savedCards.map(c => `
          <button class="tu-card ${c.id === STATE.topUpSource ? "active" : ""}" data-card="${c.id}">
            <span class="tuc-icon">🏦</span>
            <span class="tuc-body">
              <strong>${c.label}</strong>
              <em>•••• ${c.last4}</em>
            </span>
            <span class="tuc-tick">✓</span>
          </button>
        `).join("") + `<button class="tu-add-card" id="tuAddCard">+ Başka kart ekle</button>`
      : `<div class="tu-empty">
           <p class="tue-title">Kayıtlı kartın yok</p>
           <p>Cüzdanına yükleme yapmak için önce bir banka veya kredi kartı eklemen gerekiyor.</p>
           <button class="btn-primary" id="tuAddCard" style="margin:12px 0 0">+ Kart Ekle</button>
         </div>`;

    const customInput = document.getElementById("tuCustomInput");
    const warnEl = document.getElementById("tuWarn");
    const doBtn = document.getElementById("doTopUp");

    function refreshSheet() {
      const isPreset = options.some(o => o.amount === STATE.topUpAmount);
      document.querySelectorAll(".tu-chip").forEach(b =>
        b.classList.toggle("active", isPreset && Number(b.dataset.amount) === STATE.topUpAmount));
      document.querySelectorAll(".tu-card").forEach(b =>
        b.classList.toggle("active", b.dataset.card === STATE.topUpSource));
      document.getElementById("tuCustom").classList.toggle("active", !isPreset && STATE.topUpAmount > 0);

      const after = walletBalance() + STATE.topUpAmount;
      document.getElementById("tuAfter").textContent = `yükleme sonrası ${tl(after)}`;

      // Girilen tutar sepeti hâlâ karşılamıyorsa uyar, ama yüklemeyi engelleme
      if (STATE.topUpAmount > 0 && after < grand) {
        warnEl.className = "tu-warn show";
        warnEl.textContent = `Bu tutarla bakiyen sepeti karşılamaz; ${tl(grand - after)} daha gerekir.`;
      } else {
        warnEl.className = "tu-warn";
        warnEl.textContent = "";
      }

      const ready = STATE.topUpAmount > 0 && !!STATE.topUpSource;
      doBtn.disabled = !ready;
      doBtn.textContent = STATE.topUpAmount > 0
        ? `${tl(STATE.topUpAmount)} Yükle`
        : "Tutar seç";
    }

    document.querySelectorAll(".tu-chip").forEach(b => b.addEventListener("click", () => {
      STATE.topUpAmount = Number(b.dataset.amount);
      customInput.value = "";
      refreshSheet();
    }));
    document.querySelectorAll(".tu-card").forEach(b => b.addEventListener("click", () => {
      STATE.topUpSource = b.dataset.card; refreshSheet();
    }));
    customInput.addEventListener("input", () => {
      const v = Math.round(Number(customInput.value) * 100) / 100;
      STATE.topUpAmount = v > 0 ? v : 0;
      refreshSheet();
    });
    const addCardBtnEl = document.getElementById("tuAddCard");
    if (addCardBtnEl) addCardBtnEl.addEventListener("click", () => {
      // Kart eklendikten sonra kullanıcı yükleme akışına geri döner
      STATE.reopenTopUp = true;
      modal.style.display = "none";
      renderAddCard();
    });
    const consentInput = document.getElementById("autoTopUpConsent");
    consentInput.checked = autoTopUpOn();
    consentInput.onchange = (e) => { setAutoTopUp(e.target.checked); };
    document.getElementById("autoTopUpTerms").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toast("Otomatik yükleme yalnızca sepet tutarı bakiyeni aştığında ve yalnızca eksik tutar kadar çalışır. Talimatı istediğin an kapatabilirsin.");
    };
    refreshSheet();

    doBtn.onclick = () => {
      if (doBtn.disabled) return;
      const card = STATE.savedCards.find(c => c.id === STATE.topUpSource);
      STATE.user.orbitPay.balanceTRY = Math.round((walletBalance() + STATE.topUpAmount) * 100) / 100;
      modal.style.display = "none";
      syncPayMethodUI();
      toast(`${tl(STATE.topUpAmount)} yüklendi · ${card.label} •••• ${card.last4}`
        + (autoTopUpOn() ? " · Otomatik yükleme açık." : ""));
    };
    document.getElementById("closeTopUp").onclick = () => { modal.style.display = "none"; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
    mountSheetToShell(modal);
    openSheet(modal);
  }

  document.querySelectorAll("[data-method-radio]").forEach(radio => {
    radio.addEventListener("change", () => {
      STATE.selectedPayMethod = radio.dataset.methodRadio;
      syncPayMethodUI();
    });
  });
  document.querySelectorAll(".pay-method-card").forEach(el => {
    el.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      STATE.selectedPayMethod = el.dataset.method;
      syncPayMethodUI();
    });
  });
  syncPayMethodUI();

  if (STATE.reopenTopUp) {
    STATE.reopenTopUp = false;
    const btn = document.getElementById("openTopUp");
    if (btn) btn.click();
  }

  document.getElementById("autoTopUpOff").addEventListener("click", () => {
    setAutoTopUp(false);
    syncPayMethodUI();
    toast("Otomatik yükleme kapatıldı.");
  });
  document.getElementById("addCardBtn").addEventListener("click", renderAddCard);
  document.getElementById("placeOrder").addEventListener("click", () => {
    STATE.orderPaidWithOrbitPay = STATE.selectedPayMethod === "orbitpay";
    if (STATE.orderPaidWithOrbitPay) {
      // Otomatik bölmede eksik tutar önce karttan cüzdana aktarılır, sonra tek seferde ödenir
      const shortfall = STATE.walletShortfall || 0;
      if (shortfall > 0) {
        const card = STATE.savedCards.find(c => c.id === STATE.topUpSource) || STATE.savedCards[0];
        STATE.user.orbitPay.balanceTRY = Math.round((walletBalance() + shortfall) * 100) / 100;
        toast(`${tl(shortfall)} ${card.label} •••• ${card.last4} kartından cüzdanına aktarıldı.`);
      }
      STATE.user.orbitPay.balanceTRY =
        Math.round((walletBalance() - (STATE.orderTotal || 0)) * 100) / 100;
    }
    renderConfirmation();
  });
}

function renderAddCard() {
  resetScreenChrome();
  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back-btn" id="back">‹</button>
        <div>
          <p class="screen-title">Yeni Kart Ekle</p>
        </div>
      </div>

      <div class="pref-group">
        <div class="pref-label">Kart Üzerindeki İsim</div>
        <input class="text-field" id="cardName" placeholder="Ad Soyad" />
      </div>
      <div class="pref-group">
        <div class="pref-label">Kart Numarası</div>
        <input class="text-field" id="cardNumber" placeholder="•••• •••• •••• ••••" maxlength="19" inputmode="numeric" />
      </div>
      <div style="display:flex;gap:12px">
        <div class="pref-group" style="flex:1">
          <div class="pref-label">Son Kullanma</div>
          <input class="text-field" id="cardExpiry" placeholder="AA/YY" maxlength="5" />
        </div>
        <div class="pref-group" style="flex:1">
          <div class="pref-label">CVV</div>
          <input class="text-field" id="cardCvv" placeholder="•••" maxlength="3" inputmode="numeric" />
        </div>
      </div>

      <button class="btn-primary" id="saveCardBtn">Kartı Kaydet</button>
    </div>
  `;
  document.getElementById("back").addEventListener("click", renderCheckout);
  document.getElementById("saveCardBtn").addEventListener("click", () => {
    const numberInput = document.getElementById("cardNumber").value.replace(/\D/g, "");
    const last4 = numberInput.length >= 4 ? numberInput.slice(-4) : String(1000 + Math.floor((STATE.savedCards.length + 1) * 137) % 9000);
    const id = "card_" + (STATE.savedCards.length + 1) + "_" + last4;
    STATE.savedCards.push({ id, last4, label: "Kredi / Banka Kartı" });
    STATE.selectedPayMethod = id;
    toast("Kartın kaydedildi.");
    renderCheckout();
  });
}

function renderConfirmation() {
  resetScreenChrome();
  root.innerHTML = `
    <div class="screen center-text">
      <div class="confirm-check">✓</div>
      <p class="screen-title">Siparişin alındı!</p>
      <p class="screen-subtitle">Tahmini teslimat: 25-35 dakika</p>
      <button class="btn-primary" id="trackBtn" style="margin-top:24px">Siparişi Takip Et</button>
      <button class="btn-secondary" id="homeBtn">Ana Sayfaya Dön</button>
    </div>
  `;
  document.getElementById("trackBtn").addEventListener("click", renderTracking);
  document.getElementById("homeBtn").addEventListener("click", () => { STATE.cart = {}; renderHome(); });
}

/* ---------------- Tracking & Issues ---------------- */
function initDelivery() {
  if (STATE.delivery) return STATE.delivery;
  const c = (STATE.user && STATE.user.context) || {};
  const rainy = /yağmur/i.test(c.weather || "");
  const ao = typeof activeOrder === "function" ? activeOrder() : null;
  const rest = STATE.activeRestaurant || (ao ? { name: ao.storeName } : null) || { name: "Yeşil Kase" };

  const signals = [
    { id: "courier", icon: "🛵", label: "Kurye konumu", detail: "Eve 5 dk uzaklıkta", delta: 5, base: true },
    { id: "traffic", icon: "🚦", label: "Trafik Yoğunluğu", detail: "yoğun", delta: 5, level: "high" },
    { id: "kitchen", icon: "🍳", label: `Mutfak yoğunluğu · ${rest.name}`, detail: "normal", delta: 0, level: "ok" },
    { id: "weather", icon: "🌧️", label: "Hava Koşulları", detail: rainy ? "yağmurlu" : "açık", delta: rainy ? 2 : 0, level: rainy ? "warn" : "ok" }
  ];

  const etaMin = signals.reduce((s, x) => s + x.delta, 0);
  const delayMin = signals.filter(x => !x.base).reduce((s, x) => s + x.delta, 0);

  STATE.delivery = {
    signals,
    etaMin,
    delayMin,
    startedAt: Date.now(),
    courier: { name: "Mert K.", vehicle: "Motosiklet · 34 KZ 118", rating: 4.9 },
    compensated: false
  };
  return STATE.delivery;
}

function remainingMin() {
  const d = initDelivery();
  const elapsed = Math.floor((Date.now() - d.startedAt) / 60000);
  return Math.max(1, d.etaMin - elapsed);
}

function deliveryClock() {
  const t = new Date(Date.now() + remainingMin() * 60000);
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}

function courierProgress() {
  const d = initDelivery();
  const elapsedMin = (Date.now() - d.startedAt) / 60000;
  const ratio = Math.max(0, Math.min(1, elapsedMin / d.etaMin));
  return (12 + ratio * 80).toFixed(1);
}

function renderTracking() {
  resetScreenChrome();
  const d = initDelivery();
  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back-btn" id="back">‹</button>
        <div>
          <p class="screen-title">Sipariş Takibi</p>
        </div>
      </div>
      <div class="eta-card ${d.delayMin >= 5 ? "has-delay" : ""}">
        <div class="eta-headline">
          <div class="eta-big"><span id="etaMinVal">${remainingMin()}</span><small>dk</small></div>
          <div class="eta-meta">
            <p class="eta-clock">Tahmini teslim <strong id="etaClock">${deliveryClock()}</strong></p>
          </div>
        </div>
        ${d.delayMin >= 5 ? `
          <div class="eta-delay-strip">
            <p class="eds-reason">Güzergâhtaki trafik ve hava koşulları nedeniyle gecikme yaşanıyor — kurye yolda, takipteyim.</p>
            <div class="eds-comp">
              <p class="edsc-note">
                Yaşanan gecikme için özür dileriz. Hesabına, bir sonraki siparişinde
                kullanabilmen için <strong class="edsc-amount">${tl(DELAY_COUPON_TRY)}</strong>'lik
                indirim kuponu tanımladık.
              </p>
            </div>
          </div>` : ""}
      </div>

      <div class="tracking-progress">
        <div class="tracking-step"><div class="tracking-dot done">✓</div><span class="tracking-label">Onaylandı</span></div>
        <div class="tracking-step"><div class="tracking-dot done">✓</div><span class="tracking-label">Hazırlanıyor</span></div>
        <div class="tracking-step"><div class="tracking-dot active">●</div><span class="tracking-label">Yolda</span></div>
        <div class="tracking-step"><div class="tracking-dot">4</div><span class="tracking-label">Teslim</span></div>
      </div>

      <div class="route-map">
        <svg class="route-svg" viewBox="0 0 320 150" preserveAspectRatio="none" aria-hidden="true">
          <path class="route-bg" d="M28,118 C90,118 78,54 150,54 C222,54 214,28 292,28" />
          <path class="route-fg" d="M28,118 C90,118 78,54 150,54 C222,54 214,28 292,28" />
        </svg>
        <span class="route-pin start" title="Restoran">🍽️</span>
        <span class="route-courier" id="routeCourier" style="offset-distance:${courierProgress()}%" aria-label="Kurye konumu">🛵</span>
        <span class="route-pin end" title="Teslimat adresi">🏠</span>
        <span class="route-caption">${d.courier.name} · ${d.signals[0].detail}</span>
      </div>

      <div class="courier-card">
        <div class="cc-avatar">${d.courier.name.charAt(0)}</div>
        <div class="cc-info">
          <p class="cc-name">${d.courier.name} <span class="cc-rating">⭐ ${d.courier.rating}</span></p>
          <p class="cc-vehicle">${d.courier.vehicle}</p>
          ${hasPriorityCourier(currentTier(), STATE.orderPaidWithOrbitPay ? "orbitpay" : "card")
            ? `<span class="priority-courier">⚡ Öncelikli Kurye · Prime</span>` : ""}
        </div>
        <div class="cc-actions">
          <button class="cc-btn" id="courierCall" aria-label="Kuryeyi ara">📞</button>
          <button class="cc-btn" id="courierMsg" aria-label="Kuryeye mesaj">💬</button>
        </div>
      </div>

      <button class="ask-courier-btn" id="askCourierBtn" aria-expanded="false" aria-controls="etaBreakdownSlot">
        <span class="acb-spark">✦</span>
        <span>Siparişim neden gecikti?</span>
        <span class="acb-go">›</span>
      </button>
      <div id="etaBreakdownSlot"></div>

      <button class="ask-courier-btn issue" id="reportIssueBtn">
        <span class="acb-spark">✦</span>
        <span>Siparişimle ilgili farklı bir sorunum var</span>
        <span class="acb-go">›</span>
      </button>
    </div>
  `;
  document.getElementById("back").addEventListener("click", renderHome);
  document.getElementById("reportIssueBtn").addEventListener("click", renderIssueChat);
  document.getElementById("courierCall").addEventListener("click", () => toast(`${d.courier.name} aranıyor…`));
  document.getElementById("courierMsg").addEventListener("click", () => toast("Kuryeye mesaj gönderildi."));

  // Açılır/kapanır: ok kapalıyken yana, açıkken aşağı bakar
  STATE.etaOpen = false;
  const askBtn = document.getElementById("askCourierBtn");
  if (askBtn) askBtn.addEventListener("click", () => {
    const slot = document.getElementById("etaBreakdownSlot");
    STATE.etaOpen = !STATE.etaOpen;
    askBtn.classList.toggle("open", STATE.etaOpen);
    askBtn.setAttribute("aria-expanded", String(STATE.etaOpen));
    if (STATE.etaOpen) {
      showEtaBreakdown();
    } else {
      slot.innerHTML = "";
    }
  });

  // Kupon kullanıcı aksiyonu beklemeden, 5+ dk gecikme algılandığı anda otomatik tanımlanır
  if (d.delayMin >= 5 && !STATE.delivery.compensated) {
    STATE.delivery.compensated = true;
    STATE.coupons = STATE.coupons || [];
    STATE.coupons.push({
      code: "GECIKME" + DELAY_COUPON_TRY,
      amountTRY: DELAY_COUPON_TRY,
      reason: "Teslimat gecikmesi telafisi",
      validForNextOrder: true
    });
    toast(`${tl(DELAY_COUPON_TRY)} indirim kuponu hesabına otomatik tanımlandı.`);
  }

  clearInterval(STATE.etaTimer);
  STATE.etaTimer = setInterval(() => {
    const v = document.getElementById("etaMinVal");
    const c = document.getElementById("etaClock");
    const courier = document.getElementById("routeCourier");
    if (!v || !c) { clearInterval(STATE.etaTimer); return; }
    v.textContent = remainingMin();
    c.textContent = deliveryClock();
    if (courier) courier.style.offsetDistance = courierProgress() + "%";
  }, 4000);
}

/* Takibi açık olan sipariş — telafi bunun nakit iadesinden türetilir */
function activeOrder() {
  return (typeof DETAILED_ORDERS !== "undefined"
    ? DETAILED_ORDERS.find(o => o.status === "active")
    : null) || null;
}

/* Siparişin normalde kazandıracağı nakit iade */
function orderCashbackTRY() {
  const o = activeOrder();
  if (!o) return 0;
  const method = o.payMethod === "orbitpay_wallet" ? "orbitpay" : "card";
  return getCheckoutCashback(method, o.totalTRY || 0, o.vertical || "eats", o.tierAtOrder || currentTier()).amount;
}

/* Gecikme telafisi tek yerden gelir: DELAY_COUPON_TRY engine.js'te tanımlı,
   resolveIssue() de aynı sabiti kullanıyor. İki kanal tek cevap veriyor. */
function delayCompensationTRY() {
  return DELAY_COUPON_TRY;
}

function showEtaBreakdown() {
  const slot = document.getElementById("etaBreakdownSlot");
  if (!slot) return;
  const d = initDelivery();
  const rem = remainingMin();
  const baseDelta = Math.max(1, rem - d.delayMin);
  const currentSignals = d.signals.map(s => s.base ? { ...s, delta: baseDelta } : s);

  slot.innerHTML = `<div class="ai-steps" id="etaSteps"></div>`;
  const stepsEl = document.getElementById("etaSteps");
  const lines = [
    "Kuryenin canlı konumunu okuyorum.",
    "Güzergâhtaki trafik ve restoranın mutfak yoğunluğunu birleştiriyorum.",
    "Tahmini süre hesaplanıyor…"
  ];
  lines.forEach((l, i) => {
    setTimeout(() => {
      if (!document.getElementById("etaSteps") || !STATE.etaOpen) return;
      stepsEl.insertAdjacentHTML("beforeend", `<p class="ai-step ${i === lines.length - 1 ? "" : "active"}">${l}</p>`);
    }, 200 + i * 420);
  });

  setTimeout(() => {
    if (!document.getElementById("etaBreakdownSlot") || !STATE.etaOpen) return;
    slot.innerHTML = `
      <div class="eta-breakdown">
        <p class="ebd-title">Siparişin Detaylı Gecikme Nedenleri</p>
        ${currentSignals.map(s => `
          <div class="ebd-row ${s.level || ""}">
            <span class="ebd-ico">${s.icon}</span>
            <span class="ebd-label">${s.label}<em>${s.detail}</em></span>
            <span class="ebd-delta ${s.base ? "base" : s.delta > 0 ? "plus" : "zero"}">
              ${s.base ? `${s.delta} dk` : s.delta > 0 ? `+${s.delta} dk` : "+0 dk"}
            </span>
          </div>
        `).join("")}
        <div class="ebd-total">
          <span>Tahmini teslim</span>
          <strong>${deliveryClock()} · ${rem} dk</strong>
        </div>
        <p class="ebd-note">Güzergâhtaki yoğunluk ve hava koşulları nedeniyle siparişinde ${d.delayMin} dakika gecikme yaşanıyor.</p>
      </div>
    `;
  }, 200 + lines.length * 420 + 260);
}

/* ---------------- Issue Support & Autonomous Refund ---------------- */
const ISSUE_QUICK_PROMPTS = [
  "Sipariş eksik geldi",
  "Yanlış ürün geldi",
  "Sipariş geç geldi"
];

function renderIssueChat() {
  resetScreenChrome();
  if (!STATE.issueChat) STATE.issueChat = { messages: [] };
  if (STATE.issueChat.messages.length === 0) {
    STATE.issueChat.messages.push({
      role: "assistant",
      text: "Merhaba, siparişinle ilgili bir sorun yaşadığını düşünüyorum. Sana nasıl yardımcı olabilirim?"
    });
  }
  root.innerHTML = `
    <div class="chat-screen">
      <div class="screen-header" style="padding:26px 18px 0">
        <button class="back-btn" id="back">‹</button>
        <div class="chat-header-title">
          ${orbitLogo(18)}
          <p class="screen-title">Sipariş Desteği</p>
        </div>
      </div>
      <div class="chat-body" id="issueChatBody"></div>
      <div class="chat-quick-row" id="issueChatQuick">
        ${ISSUE_QUICK_PROMPTS.map(q => `<button class="chat-quick-chip" data-q="${q}">${q}</button>`).join("")}
      </div>
      <div class="chat-input-bar">
        <button id="issueCam" class="chat-cam-btn" title="Fotoğraf ekle">📷</button>
        <input id="issueChatInput" placeholder="Bir şeyler yaz…" />
        <button id="issueChatSend" class="chat-send-btn"><svg width="16" height="16" viewBox="0 0 24 24"><use href="#icon-send"/></svg></button>
      </div>
    </div>
  `;
  document.getElementById("back").addEventListener("click", renderTracking);

  const input = document.getElementById("issueChatInput");
  const send = () => {
    const val = input.value.trim();
    if (!val) return;
    input.value = "";
    handleIssueChatMessage(val);
  };
  document.getElementById("issueChatSend").addEventListener("click", send);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  document.querySelectorAll("#issueChatQuick .chat-quick-chip").forEach(btn => {
    btn.addEventListener("click", () => handleIssueChatMessage(btn.dataset.q));
  });
  document.getElementById("issueCam").addEventListener("click", handleIssuePhotoUpload);

  renderIssueChatMessages();
}

function renderIssueChatMessages() {
  const body = document.getElementById("issueChatBody");
  if (!body) return;
  body.innerHTML = STATE.issueChat.messages.map(m => {
    if (m.role === "user") {
      return m.src
        ? `<div class="chat-bubble user photo"><img src="${m.src}" alt="Gönderilen fotoğraf" /></div>`
        : `<div class="chat-bubble user">${m.text}</div>`;
    }
    if (m.role === "thinking") {
      return `<div class="chat-bubble assistant thinking"><div class="pulse-dot" style="width:8px;height:8px;box-shadow:0 0 0 4px var(--orbit-ai-soft)"></div>${m.text}</div>`;
    }
    if (m.role === "typing") {
      return `<div class="ai-typing" aria-label="Orbit AI yanıt hazırlıyor"><i></i><i></i><i></i></div>`;
    }
    if (m.role === "steps") {
      return `<div class="ai-steps">
        ${m.lines.map((l, i) => `<p class="ai-step ${!m.done && i === m.lines.length - 1 ? "active" : ""}">${l}</p>`).join("")}
      </div>`;
    }
    let html = `<div class="chat-bubble assistant">${m.text}</div>`;
    if (m.orderCard) {
      const o = (typeof activeOrder === "function" ? activeOrder() : null) || {
        storeName: "Focus Burger & Gurme Mutfak",
        itemsSummary: "1x Trüf Cheddarlı Burger Menu, 1x San Sebastian Cheesecake",
        totalTRY: 460,
        deliveryAddress: "Levent Mah. Konut Sok. No:4 D:8"
      };
      const d = (typeof initDelivery === "function" ? initDelivery() : { delayMin: 10 });
      const rem = (typeof remainingMin === "function" ? remainingMin() : 12);
      const clock = (typeof deliveryClock === "function" ? deliveryClock() : "21:45");

      html += `
        <div class="chat-live-order-card">
          <div class="cloc-header">
            <div class="cloc-title">
              <span class="cloc-icon">🛵</span>
              <div>
                <strong>${o.storeName || "Focus Burger & Gurme Mutfak"}</strong>
                <p class="cloc-status-pill">Siparişin Yolda · Tahmini ${rem} dk (${clock})</p>
              </div>
            </div>
          </div>
          <div class="cloc-details">
            <div class="cloc-detail-row">
              <span class="cloc-label">📦 Sipariş İçeriği</span>
              <span class="cloc-val">${o.itemsSummary || "1x Trüf Cheddarlı Burger Menu, 1x San Sebastian Cheesecake"}</span>
            </div>
            <div class="cloc-detail-row">
              <span class="cloc-label">📍 Teslimat Adresi</span>
              <span class="cloc-val">${o.deliveryAddress || "Levent Mah. Konut Sok. No:4 D:8"}</span>
            </div>
            <div class="cloc-detail-row">
              <span class="cloc-label">💳 Toplam Tutar</span>
              <span class="cloc-val"><strong>${o.totalPrice || `${o.totalTRY || 460} TL`}</strong></span>
            </div>
            <div class="cloc-detail-row">
              <span class="cloc-label">🚦 Yol & Trafik Durumu</span>
              <span class="cloc-val ${d.delayMin > 0 ? "text-warn" : "text-ok"}">
                ${d.delayMin > 0 ? `Yoğunluk nedeniyle +${d.delayMin} dk gecikme` : "Normal seyrediyor"}
              </span>
            </div>
          </div>
          <button class="cloc-btn" data-action="track" data-id="${o.id || "active"}">🚀 Canlı Sipariş Haritası & Detayı</button>
        </div>
      `;
    }

    if (m.checks && m.checks.length) {
      html += `<div class="cv-checks">
        <p class="cvc-title">Fotoğraf analizi</p>
        ${m.checks.map(c => `
          <div class="cvc-row">
            <span class="cvc-mark ${c.ok ? "ok" : "no"}">${c.ok ? "✓" : "!"}</span>
            <span class="cvc-text"><strong>${c.label}</strong><em>${c.detail}</em></span>
          </div>
        `).join("")}
      </div>`;
    }
    if (m.escalated) {
      html += `<div class="issue-resolution-card escalated">
        <p class="irc-status">Destek ekibine aktarıldı</p>
        <button class="btn-primary" data-escalated-done="1">Temsilciyle görüş</button>
      </div>`;
    }
    if (m.resolution) {
      html += `
        <div class="issue-resolution-card">
          <div class="refund-amount">${m.resolution.refundAmount} TL iade</div>
          ${m.resolution.settled ? `
            <div class="reason-chip" style="background:var(--orbit-ai-soft);color:var(--orbit-ai-dark)">✓ ${m.resolution.refundAmount} TL Orbit Pay cüzdanına iade edildi.</div>
            <button class="btn-secondary" data-done="1">Tamam</button>
          ` : `
            <button class="btn-primary ai" data-approve="1">Otomatik iadeyi onayla</button>
            <button class="btn-secondary" data-human="1">Bunun yerine destek ekibiyle konuş</button>
          `}
        </div>
      `;
    }
    return html;
  }).join("");
  body.scrollTop = body.scrollHeight;

  body.querySelectorAll(".cloc-btn").forEach(btn => {
    btn.addEventListener("click", () => renderTracking());
  });
  const approveBtn = body.querySelector("[data-approve]");
  if (approveBtn) approveBtn.addEventListener("click", approveIssueRefund);
  const humanBtn = body.querySelector("[data-human]");
  if (humanBtn) humanBtn.addEventListener("click", renderLiveSupport);
  const escBtn = body.querySelector("[data-escalated-done]");
  if (escBtn) escBtn.addEventListener("click", renderLiveSupport);
  const doneBtn = body.querySelector("[data-done]");
  if (doneBtn) doneBtn.addEventListener("click", renderHome);
}

/* Canlı destek: prototipte statik bir temsilci görüşmesi (AI bağlı değil) */
function renderLiveSupport() {
  resetScreenChrome();
  clearChatTimers();
  const o = typeof activeOrder === "function" ? activeOrder() : null;
  const konu = (STATE.issueChat && STATE.issueChat.issueType) || "sipariş sorunu";
  STATE.liveSupport = { messages: [], connected: false };

  root.innerHTML = `
    <div class="chat-screen">
      <div class="screen-header" style="padding:26px 18px 0">
        <button class="back-btn" id="back">‹</button>
        <div class="chat-header-title">
          <p class="screen-title">Canlı Destek</p>
        </div>
      </div>

      <div class="ls-agent" id="lsAgent">
        <div class="lsa-avatar">EK</div>
        <div class="lsa-info">
          <strong id="lsAgentName">Sıraya alındın</strong>
          <span id="lsAgentRole">Bağlanıyor…</span>
        </div>
        <span class="lsa-status" id="lsStatus">
          <i></i>Bekleniyor
        </span>
      </div>

      <div class="ls-context">
        <span class="lsc-label">Görüşme konusu</span>
        <strong>${konu}${o ? ` · ${o.storeName} · ${o.totalPrice}` : ""}</strong>
      </div>

      <div class="chat-body" id="lsBody"></div>

      <div class="chat-input-bar">
        <input id="lsInput" placeholder="Mesajını yaz…" />
        <button id="lsSend" class="chat-send-btn"><svg width="16" height="16" viewBox="0 0 24 24"><use href="#icon-send"/></svg></button>
      </div>
    </div>
  `;
  document.getElementById("back").addEventListener("click", renderIssueChat);

  const send = () => {
    const inp = document.getElementById("lsInput");
    const val = inp.value.trim();
    if (!val) return;
    inp.value = "";
    STATE.liveSupport.messages.push({ role: "user", text: val });
    renderLiveSupportMessages();
    // Statik akış: temsilci her mesaja aynı sakin cevabı verir
    chatTimers.push(setTimeout(() => {
      STATE.liveSupport.messages.push({
        role: "agent",
        text: "Not aldım, hemen kontrol ediyorum. Birkaç dakika içinde sana dönüş yapacağım."
      });
      renderLiveSupportMessages();
    }, 1100));
  };
  document.getElementById("lsSend").addEventListener("click", send);
  document.getElementById("lsInput").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });

  chatTimers.push(setTimeout(() => {
    const st = document.getElementById("lsStatus");
    const nm = document.getElementById("lsAgentName");
    const rl = document.getElementById("lsAgentRole");
    if (!st) return;
    STATE.liveSupport.connected = true;
    st.className = "lsa-status online";
    st.innerHTML = "<i></i>Çevrimiçi";
    nm.textContent = "Elif K.";
    rl.textContent = "Müşteri Temsilcisi";
    STATE.liveSupport.messages.push({
      role: "agent",
      text: `Merhaba ${firstName(STATE.user ? STATE.user.name : "Baki")}, ben Elif. "${konu}" konulu talebini ve Orbit AI'ın yaptığı incelemeyi görüyorum.`
    });
    renderLiveSupportMessages();
  }, 1400));

  chatTimers.push(setTimeout(() => {
    STATE.liveSupport.messages.push({
      role: "agent",
      text: "Kaydını inceledim, yaşadığın aksaklık için üzgünüm. Talebini öncelikli kuyruğa aldım; sonucu en geç bugün içinde bildirimle ileteceğim."
    });
    renderLiveSupportMessages();
  }, 3400));

  renderLiveSupportMessages();
}

function renderLiveSupportMessages() {
  const body = document.getElementById("lsBody");
  if (!body) return;
  const msgs = (STATE.liveSupport && STATE.liveSupport.messages) || [];
  body.innerHTML = msgs.length
    ? msgs.map(m => m.role === "user"
        ? `<div class="chat-bubble user">${m.text}</div>`
        : `<div class="chat-bubble assistant">${m.text}</div>`).join("")
    : `<p class="ls-waiting">Temsilcimize bağlanıyorsun, ortalama bekleme süresi 1 dakika.</p>`;
  body.scrollTop = body.scrollHeight;
}

function classifyIssue(text) {
  const t = (text || "").toLowerCase();
  if (/eksik|gelmedi|yok/.test(t)) return "eksik ürün";
  if (/yanlış|farklı|başka/.test(t)) return "yanlış ürün";
  if (/geç|gecik|bekle/.test(t)) return "geç teslimat";
  if (/dökül|soğu|bozuk|ezil/.test(t)) return "hasarlı teslimat";
  return "sipariş sorunu";
}

/* Destek sohbetinin modele verilecek bağlamı — sipariş, statü ve geçmiş talep */
function supportContext(extra) {
  const o = typeof activeOrder === "function" ? activeOrder() : null;
  return Object.assign({
    order: o || {},
    tier: currentTier(),
    priorClaims: 0,
    history: STATE.issueChat.messages
  }, extra || {});
}

async function handleIssueChatMessage(text) {
  // Kullanıcı ana sayfaya dönmek isterse
  if (/ana\s*sayfa|anasayfa/i.test(text)) {
    renderHome();
    return;
  }
  // Kullanıcı siparişi tekrarlamak isterse (ürünleri sepete ekler ve sepetim ekranını açar)
  if (/siparişi\s*tekrarla|siparişi\s*yenile|tekrarla/i.test(text)) {
    const order = typeof activeOrder === "function" ? activeOrder() : null;
    const itemsToReorder = (order && order.items) || [
      { name: "Trüf Cheddarlı Burger Menu", price: 340, qty: 1 },
      { name: "San Sebastian Cheesecake", price: 120, qty: 1 }
    ];
    itemsToReorder.forEach((item, idx) => {
      const itemId = `reorder-${idx + 1}`;
      addToCart({
        itemId: itemId,
        itemName: item.name,
        price: item.price,
        restaurantId: "r1",
        restaurantName: (order && order.storeName) || "Focus Burger & Gurme Mutfak"
      });
      if (STATE.cart[itemId] && item.qty) {
        STATE.cart[itemId].qty = item.qty;
      }
    });
    renderCheckout();
    return;
  }
  // Kullanıcı doğrudan insana bağlanmak isterse AI'ı devreden çıkar
  if (/destek ekibine aktar|temsilciy?e? bağla|canlı destek/i.test(text)) {
    renderLiveSupport();
    return;
  }
  STATE.issueChat.messages.push({ role: "user", text });
  const typingMsg = { role: "typing" };
  STATE.issueChat.messages.push(typingMsg);
  renderIssueChatMessages();

  // Canlı sipariş ve destek sorularında 2.6-3sn düşünme adımları ve net kibar AI cevabı çalıştırılır:
  if (handleOrderSupportFlow(text, typingMsg)) {
    return;
  }

  // Kullanıcı iade onay sorusuna olumlu yanıt verdiyse:
  if (STATE.issueChat.pendingRefund && /onay|evet|kabul|tamam|istiyorum/i.test(text)) {
    const pr = STATE.issueChat.pendingRefund;
    STATE.issueChat.pendingRefund = null;
    const i = STATE.issueChat.messages.indexOf(typingMsg);
    if (i > -1) STATE.issueChat.messages.splice(i, 1);

    if (STATE.user && STATE.user.orbitPay) {
      STATE.user.orbitPay.balanceTRY = (STATE.user.orbitPay.balanceTRY || 0) + pr.amount;
    }

    STATE.issueChat.messages.push({
      role: "assistant",
      text: `Harika, onayını aldım! ${pr.amount} TL iaden Orbit Pay cüzdanına başarıyla tanımlandı.`,
      checks: [
        { label: "Müşteri onayı", detail: "Kullanıcı iade çözümünü onayladı", ok: true },
        { label: "Cüzdan aktarımı", detail: `${pr.amount} TL bakiyene eklendi`, ok: true }
      ],
      resolution: {
        refundAmount: pr.amount,
        settled: true
      }
    });
    setIssueQuickChips(["Siparişi tekrarla", "Ana sayfaya dön"]);
    renderIssueChatMessages();
    return;
  }

  const tip = classifyIssue(text);
  STATE.issueChat.issueType = tip;

  // Eğer kullanıcı önceden fotoğraf atıp sorunu şimdi açıkladıysa, bekleyen fotoğrafı değerlendir
  if (STATE.issueChat.pendingPhoto) {
    const pending = STATE.issueChat.pendingPhoto;
    STATE.issueChat.pendingPhoto = null;
    const i = STATE.issueChat.messages.indexOf(typingMsg);
    if (i > -1) STATE.issueChat.messages.splice(i, 1);

    await evaluatePhotoEvidenceWithIssue(pending, tip);
    return;
  }

  // Geç teslimat bir ürün sorunu değil: fotoğraf istenmez, iade önerilmez
  const ai = await callGeminiSupport(text, supportContext(
    tip === "geç teslimat" ? { mode: "late_delivery" } : null
  ));
  STATE.issueChat.issueType = ai.issueType;

  const i = STATE.issueChat.messages.indexOf(typingMsg);
  if (i > -1) STATE.issueChat.messages.splice(i, 1);

  STATE.issueChat.messages.push({ role: "assistant", text: ai.reply });
  // Alt çip şeridi bağlama göre yenilenir
  if (ai.followups && ai.followups.length) setIssueQuickChips(ai.followups);
  renderIssueChatMessages();
}

/* Hazır sorular yerine modelin önerdiği devam adımlarını göster */
function setIssueQuickChips(chips) {
  const row = document.getElementById("issueChatQuick");
  if (!row) return;
  row.innerHTML = chips.map(q => `<button class="chat-quick-chip" data-q="${q}">${q}</button>`).join("");
  row.querySelectorAll(".chat-quick-chip").forEach(btn => {
    btn.addEventListener("click", () => handleIssueChatMessage(btn.dataset.q));
  });
}

/* Model açıklamasını cümle içine gömerken baş harfi ve noktayı temizler */
function describeVision(vision) {
  const d = (vision && vision.description) ? String(vision.description).trim() : "";
  if (!d) return "siparişine ait bir içerik göremedim";
  const temiz = d.replace(/^görselde\s+/i, "").replace(/[.…]+$/, "");
  return "görselde " + temiz.charAt(0).toLowerCase() + temiz.slice(1);
}

/* Gerçek bir görsel seçtirir, küçültür ve modele kanıt olarak gönderir */
function handleIssuePhotoUpload() {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";
  picker.onchange = () => {
    const file = picker.files && picker.files[0];
    if (file) processIssuePhoto(file);
  };
  picker.click();
}

/* Uzun kenarı küçültüp base64'e çevirir. Küçük görsel daha az görsel token
   demek; analiz süresi doğrudan buna bağlı, 900px'te istek sınıra dayanıyordu. */
function shrinkImage(file, maxEdge) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, (maxEdge || 900) / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve({ dataUrl, base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function processIssuePhoto(file) {
  const shrunk = await shrinkImage(file, 512);
  STATE.issueChat.messages.push({
    role: "user",
    text: "Fotoğraf gönderildi",
    photo: true,
    src: shrunk ? shrunk.dataUrl : null
  });

  const issueType = STATE.issueChat.issueType;

  // Kullanıcı henüz sorunun ne olduğunu belirtmediyse (direkt fotoğraf attıysa):
  if (!issueType || issueType === "sipariş sorunu") {
    STATE.issueChat.pendingPhoto = shrunk;
    STATE.issueChat.messages.push({
      role: "assistant",
      text: "Fotoğrafı aldım, teşekkürler! Siparişinde tam olarak nasıl bir sorun yaşadın? Kısaca anlatabilir misin?",
      checks: [
        { label: "Görüntü alındı", detail: "Fotoğraf sisteme yüklendi", ok: true },
        { label: "Talep nedeni", detail: "Kullanıcıdan detay bekleniyor", ok: false }
      ]
    });
    setIssueQuickChips(["Siparişim eksik geldi", "Yanlış ürün geldi", "Paket/Ürün hasarlı"]);
    renderIssueChatMessages();
    return;
  }

  // Sorun türü biliniyorsa fotoğrafı doğrudan o sorun çerçevesinde değerlendir
  await evaluatePhotoEvidenceWithIssue(shrunk, issueType);
}

async function evaluatePhotoEvidenceWithIssue(shrunk, issueType) {
  const order = typeof activeOrder === "function" ? activeOrder() : null;
  const orderTotal = (order && order.totalTRY) || STATE.orderTotal || 165;

  const stepMsg = { role: "steps", lines: [], done: false };
  STATE.issueChat.messages.push(stepMsg);
  renderIssueChatMessages();

  const lines = [
    "Görüntüyü inceliyorum…",
    "Sipariş içeriğiyle karşılaştırıyorum…",
    "Hesap geçmişini ve risk skorunu kontrol ediyorum…"
  ];
  lines.forEach((l, i) => {
    setTimeout(() => {
      stepMsg.lines.push(l);
      renderIssueChatMessages();
    }, 260 + i * 460);
  });

  const vision = shrunk ? await analyzePhotoEvidence(shrunk.base64, shrunk.mimeType, order) : null;
  const karar = decidePhotoClaim(vision, order, issueType);

  setTimeout(async () => {
    stepMsg.done = true;

    if (karar.outcome === "irrelevant_photo") {
      STATE.issueChat.messages.push({
        role: "assistant",
        text: `Bu görsel siparişinle ilgili bir kanıt oluşturmuyor — ${describeVision(vision)}. ` +
              `Değerlendirmeyi yapabilmem için yemeğin ya da paketin fotoğrafını paylaşır mısın? ` +
              `İstersen konuyu doğrudan destek ekibimize de aktarabilirim.`,
        checks: [
          { label: "Görüntü içeriği", detail: (vision && vision.description) || "Siparişe ait içerik bulunamadı", ok: false },
          { label: "Sipariş eşleşmesi", detail: "Görsel sipariş içeriğiyle ilişkilendirilemedi", ok: false }
        ]
      });
      setIssueQuickChips(["Yeni fotoğraf ekleyeyim", "Destek ekibine aktar"]);

    } else if (karar.outcome === "escalate_human") {
      let textMsg = "";
      let checks = [];

      if (karar.reason === "no_vision") {
        textMsg = `Gönderdiğin fotoğrafı şu an inceleyemedim, bu yüzden talebi kendi başıma sonuçlandırmıyorum. Dosyanı fotoğrafınla birlikte destek ekibimize aktarıyorum; kısa süre içinde seninle iletişime geçecekler.`;
        checks = [
          { label: "Görüntü doğrulaması", detail: "Görsel analizi tamamlanamadı", ok: false },
          { label: "Otomatik iade", detail: "Doğrulanmamış kanıtla otomatik iade yapılmaz", ok: false }
        ];
      } else if (karar.reason === "item_unclear") {
        textMsg = `Fotoğrafı inceledim ancak eksik veya sorunlu olan ürünü fotoğraftan net olarak ayırt edemedim. Sana doğru şekilde yardımcı olabilmem ve tespiti yapabilmem için teslim edilen tüm yemekleri aynı karede görebileceğim yeni bir görsel iletebilir misin?`;
        checks = [
          { label: "Görüntü incelendi", detail: (vision && vision.description) || "Görsel analizi yapıldı", ok: true },
          { label: "Ürün tespiti", detail: "Sorunlu ürün net olarak ayırt edilemedi", ok: false }
        ];
      } else {
        textMsg = `Fotoğrafı inceledim, anlattığınla örtüşüyor. Ancak sipariş tutarı ${tl(orderTotal)} (≥ 1.000 TL) olduğu için bu talebi otomatik sonuçlandırma yetkim yok — dosyanı tüm kanıtlarla birlikte destek ekibimize aktarıyorum. Ekibimiz kısa süre içinde seninle iletişime geçecek.`;
        checks = [
          { label: "Görüntü doğrulandı", detail: (vision && vision.description) || "Sipariş içeriği görünüyor", ok: true },
          { label: "Sipariş eşleşmesi", detail: `"${issueType}" ile tutarlı`, ok: true },
          { label: "Otomatik iade sınırı", detail: `${tl(orderTotal)} · ${tl(AUTO_REFUND_ORDER_CAP_TRY)} ve üzeri talepler ekibe aktarılır`, ok: false }
        ];
      }

      STATE.issueChat.messages.push({
        role: "assistant",
        text: textMsg,
        checks,
        escalated: karar.reason !== "item_unclear"
      });
      setIssueQuickChips(karar.reason === "item_unclear"
        ? ["Yeni fotoğraf ekleyeyim", "Temsilciye bağlan"]
        : ["Temsilciye bağlan", "Siparişi tekrarla"]);

    } else {
      const storeName = (order && order.storeName) || "Focus Burger & Gurme Mutfak";
      const itemName = karar.itemName || "San Sebastian Cheesecake";
      const amount = karar.refundAmount || 120;

      STATE.issueChat.pendingRefund = {
        amount,
        itemName,
        storeName,
        basis: karar.basis,
        vision
      };

      const customText = `${storeName} siparişin özelinde tatlı siparişinin (${itemName}) iletilmediğini görüyorum. Eksik ürün için çok özür dilerim. ${tl(amount)} iadeni hesabına tanımlamamı onaylıyor musun? Eğer bu çözüm senin için uygun değilse canlı destek ekibimizle farklı alternatifleri de konuşabilirsin.`;

      STATE.issueChat.messages.push({
        role: "assistant",
        text: customText,
        checks: [
          { label: "Görüntü doğrulandı", detail: (vision && vision.description) || "Görselde burger, patates ve kola var", ok: true },
          { label: "Sipariş eşleşmesi", detail: `${itemName} fotoğrafta yer almıyor`, ok: true },
          { label: "Geçmiş talep örüntüsü", detail: "Son 90 günde benzer talep yok", ok: true },
          { label: "İade teklifi", detail: `${itemName} karşılığı ${tl(amount)}`, ok: true }
        ]
      });
      setIssueQuickChips(["İadeyi Onaylıyorum", "Canlı Destek"]);
    }
    renderIssueChatMessages();
  }, 260 + lines.length * 460 + 260);
}

function approveIssueRefund() {
  const last = STATE.issueChat.messages.filter(m => m.resolution).pop();
  if (!last) return;
  last.resolution.settled = true;
  toast(`${last.resolution.refundAmount} TL Orbit Pay cüzdanına iade edildi.`);
  renderIssueChatMessages();
}

function renderBridges() {
  resetScreenChrome();
  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back-btn" id="back">‹</button>
        <div>
          <p class="screen-title">Sana özel</p>
        </div>
      </div>

      <div class="bridge-card">
        <span class="tag">Orbit Mart</span>
        <p>Bu tarifi (Mercimek Köftesi) evde de yapabilirsin. Malzemelerini Orbit Mart'tan 12 dk içinde teslim edebilirim, ister misin?</p>
        <button class="btn-secondary" id="mart">Orbit Mart'ta malzemelere bak</button>
      </div>

      <div class="bridge-card pay">
        <span class="tag">Orbit Pay</span>
        <p>Bir sonraki siparişinde Orbit Pay ile ödersen ${currentTier()} statünle <strong>%${Math.round(CASHBACK_RATES[currentTier()].eats * 100)} nakit iade</strong> kazanırsın. Bildirimlerini açık tutayım mı?</p>
        <button class="btn-secondary" id="pay">Kampanyayı gör</button>
      </div>
    </div>
  `;
  document.getElementById("back").addEventListener("click", renderHome);
  document.getElementById("mart").addEventListener("click", () => toast("Orbit Mart'a yönlendiriliyor."));
  document.getElementById("pay").addEventListener("click", () => toast("Orbit Pay kampanya ekranı."));
}

/* ---------------- Companion AI Chat (Live Gemini / Hybrid) ---------------- */
const CHAT_QUICK_PROMPTS = [
  "Akşam yemeği için hafif bir şey",
  "Bütçem 150 TL, doyurucu bir şey",
  "Vegan seçenekler"
];

function openContextualChat(promptText, isUserTyped) {
  renderAiChat(true);

  if (isUserTyped) {
    handleChatMessage(promptText);
    return;
  }

  // Otomatik başlatılan akış (Banner / Moment kartı tıklaması)
  if (promptText && (promptText.includes("Kahvaltılık") || promptText.includes("Öğle arası") || promptText.includes("kahvalti") || promptText.includes("ogle"))) {
    const isKahvalti = promptText.includes("Kahvaltılık") || promptText.includes("kahvalti");
    const scKey = isKahvalti ? "sabah" : "ogle";
    const sc = SCENARIO_DEFS[scKey];

    if (sc && sc.swipeRestaurants) {
      STATE.chatMessages = [
        {
          role: "assistant",
          swipeRestaurants: sc.swipeRestaurants,
          text: "Yukarıdaki seçeneklerin sana uygun olabileceğini düşündüm. Değilse bana nasıl bir şeyler yemek istediğini söyleyebilirsin."
        }
      ];
      renderChatMessages();
      return;
    }
  }

  // 1. AI 1. Karşılama Mesajı (Tek olarak açılır)
  STATE.chatMessages = [
    {
      role: "assistant",
      text: getScenarioGreeting()
    }
  ];
  renderChatMessages();

  // 2. Kullanıcı balonu gösterilmeden arka planda yüklenip altında sonuçlar listelenir
  handleChatMessage(promptText || "Günün bu saatine uygun lezzetleri öner", { silent: true });
}

/* Geçmişe dayalı akıllı sıralama: AI önce neye baktığını söyler, sonra
   siparişleri kullanıcının saatine ve bütçesine göre sıralayıp sorar. */
function openHistoryRanking() {
  /* Karşılama metni atlanır: kullanıcı arama niyetiyle geldi, doğrudan
     analiz cümlesiyle başlıyoruz. Fiyat aralığı gibi iç detaylar
     kullanıcıya söylenmez — sadece ne yapılacağı söylenir. */
  renderAiChat(true);
  STATE.chatMessages = [];

  const h = orderHistoryInsights();
  const dilim = (h && h.dayPart) || "günün bu saatlerinde";

  STATE.chatMessages.push({
    role: "assistant",
    text: `Günün ${dilim} saatlerinde en çok sipariş vermekten keyif aldığın lezzetleri senin için derliyorum…`
  });
  renderChatMessages();

  handleChatMessage(
    `Geçmiş siparişlerimi ${dilim} alışkanlığıma ve alıştığım bütçe aralığına göre sırala. ` +
    `Bana en uygun olanı seçmemde yardım et, gerekiyorsa tek bir soru sorarak daralt. ` +
    `Yanıtında fiyat aralığı, sipariş adedi gibi analiz detaylarını yazma.`,
    { silent: true }
  );
}

function getContextualQuickPrompts() {
  const scKey = STATE.activeScenario || (function() {
    const h = (STATE.user && STATE.user.context && STATE.user.context.localHour) ?? new Date().getHours();
    if (h >= 5 && h < 11) return "sabah";
    if (h >= 11 && h < 18) return "ogle";
    return "aksam";
  })();

  const map = {
    sabah: [
      "Güne enerjik başlama kahvaltısı 🥐",
      "Sıcak fırın simit & poğaça 🥖",
      "Taze meyveli granola kasesi 🫐"
    ],
    ogle: [
      "25 dk altı hızlı ofis öğlesi ⚡",
      "Doyurucu tavuk dürüm menü 🌯",
      "Hafif & proteinli salata 🥗"
    ],
    aksam: [
      "Akşam yemeği için hafif bir şey 🍲",
      "Sıcak ev yemeği & çorba 🥣",
      "Bütçem 500 TL, doyurucu bir şey 💳"
    ],
    dogumgunu: [
      "Bugün kendimi mutlu hissediyorum! 🎉",
      "Mum koyabileceğim mini pasta 🎂",
      "Kutlama için 4 kişilik party box 🎁"
    ],
    mac: [
      "Taraftar boy paylaşımlık pizza 🍕",
      "20'li çıtır tavuk kovası & dip sos 🍗",
      "Maç başlamadan 25 dk hızlı teslimat ⏱️"
    ]
  };

  return map[scKey] || map.aksam;
}

function getScenarioGreeting() {
  const name = firstName(STATE.user ? STATE.user.name : "Baki");
  if (STATE.activeScenario === "sabah") {
    return `Günaydın ${name} ☀️. Güne harika başlaman için buradayım. Hadi lezzetli bir şeyler seçelim.`;
  }
  if (STATE.activeScenario === "ogle") {
    return `İyi günler ${name} ⚡. Öğle aranı en doyurucu ve hızlı şekilde değerlendirmen için buradayım.`;
  }
  if (STATE.activeScenario === "aksam") {
    return `İyi akşamlar ${name} 🌙. Günün yorgunluğunu unutturacak lezzetleri birlikte belirleyelim.`;
  }
  if (STATE.activeScenario === "dogumgunu") {
    return `İyi ki doğdun ${name}! 🎉 Bugün senin günün, Bu yıl en çok sipariş ettiğin pizza'yı tekrarlamak ister misin?`;
  }
  if (STATE.activeScenario === "mac") {
    return `Kalpler Kırmızı-Beyaz, ${name}! 🇹🇷 Maç heyecanına yakışır taraftar menülerini senin için derleyelim.`;
  }

  return `${greetingByHour()} ${name}. Dilediğin yemeği bulmana yardımcı olmak için buradayım. Canın ne çekiyorsa sana destek olabilirim`;
}

function renderAiChat(fresh) {
  resetScreenChrome();
  if (fresh) {
    clearChatTimers();
    STATE.chatGenerating = false;
    STATE.chatMessages = [];
    STATE.chatAddedToCart = false;
  }
  if (STATE.chatMessages.length === 0) {
    STATE.chatMessages.push({
      role: "assistant",
      text: getScenarioGreeting()
    });
  }
  root.innerHTML = `
    <div class="chat-screen">
      <div class="screen-header" style="padding:26px 18px 0">
        <button class="back-btn" id="back">‹</button>
        <div class="chat-header-title">
          ${orbitLogo(18)}
          <p class="screen-title">Orbit AI</p>
        </div>
      </div>
      <div class="chat-body" id="chatBody"></div>
      <div class="chat-quick-row" id="chatQuick">
        ${getContextualQuickPrompts().map(q => `<button class="chat-quick-chip" data-q="${q}">${q}</button>`).join("")}
      </div>
      <div class="chat-input-bar">
        <button id="chatCam" class="chat-cam-btn" title="Fotoğrafla ara">📷</button>
        <input id="chatInput" placeholder="Bir şeyler sor ya da yaz…" />
        <button id="chatSend" class="chat-send-btn" title="Gönder">
          <svg class="send-ico" width="16" height="16" viewBox="0 0 24 24"><use href="#icon-send"/></svg>
          <span class="stop-ico"></span>
        </button>
      </div>
      <div class="chat-cart-bar" id="chatCartBar" style="display:none">
        <span id="chatCartLabel">${cartCount()} ürün · ${cartTotal()} TL</span>
        <button class="btn-primary" id="chatGoCart" style="width:auto;margin:0;padding:10px 18px">Sepete Git</button>
      </div>
    </div>
  `;
  document.getElementById("back").addEventListener("click", renderHome);
  document.getElementById("chatGoCart").addEventListener("click", renderCheckout);

  const input = document.getElementById("chatInput");
  const send = () => {
    if (STATE.chatGenerating) { stopChatGeneration(); return; }
    const val = input.value.trim();
    if (!val) return;
    input.value = "";
    handleChatMessage(val);
  };
  document.getElementById("chatSend").addEventListener("click", send);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  document.querySelectorAll(".chat-quick-chip").forEach(btn => {
    btn.addEventListener("click", () => { if (!STATE.chatGenerating) handleChatMessage(btn.dataset.q); });
  });
  document.getElementById("chatCam").addEventListener("click", () => {
    if (!STATE.chatGenerating) openPhotoSearch();
  });

  setChatGenerating(false);
  renderChatMessages();
}

/* Orbit Mart'a devir: ekosistem butonundakiyle aynı geçiş ekranı */
function handoffToMart() {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  const ov = document.createElement("div");
  ov.className = "a2a-overlay";
  ov.innerHTML = `
    <div class="a2a-card mart">
      <div class="a2a-logos">
        <span class="a2a-app from">Eats</span>
        <span class="a2a-dots"><i></i><i></i><i></i></span>
        <span class="a2a-app to">Mart</span>
      </div>
      <p class="a2a-title">Orbit Mart'a yönlendiriliyorsun</p>
      <p class="a2a-sub">Malzemeler sepetine eklendi · ${currentTier()} ayrıcalıkların geçerli</p>
    </div>`;
  shell.appendChild(ov);
  setTimeout(() => ov.remove(), 3000);
}

function renderChatMessages() {
  const body = document.getElementById("chatBody");
  if (!body) return;
  body.innerHTML = STATE.chatMessages.map(m => {
    if (m.role === "user") {
      return m.src
        ? `<div class="chat-bubble user photo"><img src="${m.src}" alt="Gönderilen fotoğraf" /></div>`
        : `<div class="chat-bubble user">${m.text}</div>`;
    }
    if (m.role === "thinking") {
      return `<div class="chat-bubble assistant thinking"><div class="pulse-dot" style="width:8px;height:8px;box-shadow:0 0 0 4px var(--orbit-ai-soft)"></div>${m.text}</div>`;
    }
    if (m.role === "typing") {
      return `<div class="ai-typing" aria-label="Orbit AI yanıt hazırlıyor"><i></i><i></i><i></i></div>`;
    }
    if (m.role === "steps") {
      return `<div class="ai-steps">
        ${m.lines.map((l, i) => `<p class="ai-step ${!m.done && i === m.lines.length - 1 ? "active" : ""}">${l}</p>`).join("")}
      </div>`;
    }
    let html = "";
    if (m.swipeRestaurants && m.swipeRestaurants.length) {
      html += `
        <div class="h-scroll scenario-swipe-rail" style="margin: 8px 0 12px; padding: 0 4px;">
          ${m.swipeRestaurants.map(r => `
            <div class="dish-card scenario-rest-card" data-open-rest="${r.id || 'r24'}" style="cursor:pointer;">
              <div class="dish-art-wrap" style="height:92px; border-radius:12px; overflow:hidden;">
                <img src="${r.image}" class="food-img-thumb" alt="${r.name}" style="width:100%; height:100%; object-fit:cover;" />
              </div>
              <p class="dish-name" style="font-weight:800; margin-top:6px; font-size:12.5px;">${r.name}</p>
              <p class="dish-meta" style="font-size:11px;">${r.cuisine} · ⭐ ${r.rating} · ${r.deliveryMinutes} dk</p>
            </div>
          `).join("")}
        </div>
      `;
    }
    html += `<div class="chat-bubble assistant">${m.text}</div>`;

    if (m.groups && m.groups.length) {
      m.groups.forEach(g => {
        html += `
          <div class="ai-rest-card">
            <p class="airc-blurb">${g.blurb}</p>
            ${g.image ? `<img class="airc-hero" src="${g.image}" alt="" loading="lazy" />` : ""}
            <div class="airc-head">
              <p class="airc-name" data-open-rest="${g.restaurantId}">${g.restaurantName}</p>
              <span class="airc-meta">⭐ ${g.rating} · ${g.deliveryMinutes} dk · ${g.distanceKm} km</span>
            </div>
            <div class="airc-items">
              ${g.items.map(it => {
                const qty = STATE.cart[it.itemId] ? STATE.cart[it.itemId].qty : 0;
                return `
                  <div class="airc-item">
                    ${it.image ? `<img class="airc-item-img" src="${it.image}" alt="" loading="lazy" />` : foodIconTile(it.tags)}
                    <div class="airc-item-info">
                      <p class="airc-item-name">${it.itemName}</p>
                      <p class="airc-item-price">${it.price} TL</p>
                    </div>
                    <div class="airc-item-actions">
                      ${qty > 0 ? `<button class="qty-btn" data-chat-dec="${it.itemId}">−</button><span class="airc-qty">${qty}</span>` : ""}
                      <button class="qty-btn ${qty > 0 ? "filled" : ""}" data-chat-inc="${it.itemId}" aria-label="Sepete ekle">+</button>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      });
    }

    if (m.martHandoff) {
      const mh = m.martHandoff;
      html += `
        <div class="mart-bridge" data-mart-bridge="1">
          <div class="mb-head">
            <span class="mb-tag">🛒 Orbit Mart</span>
            <span class="mb-perk">${mh.perkLine}</span>
          </div>
          <p class="mb-text">
            ${mh.dish} evde de yapılabilir — malzemeleri Orbit Mart'tan
            <strong>15 dk</strong> içinde getirebilirim. Hazırlayayım mı?
          </p>
          <div class="mb-items">
            ${mh.items.map(i => `<span class="mb-item">${i}</span>`).join("")}
          </div>
          <button class="mb-btn" data-mart-go="1">Malzemeleri Orbit Mart'ta hazırla</button>
        </div>`;
    }
    if (m.orderCard) {
      const o = (typeof activeOrder === "function" ? activeOrder() : null) || {
        storeName: "Yeşil Kase",
        itemsSummary: "Avokado Roka Bowl (2x), Taze Sıkma Portakal Suyu",
        totalTRY: 380,
        deliveryAddress: "Levent Mah. Konut Sok. No:4 D:8"
      };
      const d = (typeof initDelivery === "function" ? initDelivery() : { delayMin: 5 });
      const rem = (typeof remainingMin === "function" ? remainingMin() : 15);
      const clock = (typeof deliveryClock === "function" ? deliveryClock() : "21:40");

      html += `
        <div class="chat-live-order-card">
          <div class="cloc-header">
            <div class="cloc-title">
              <span class="cloc-icon">🛵</span>
              <div>
                <strong>${o.storeName || "Yeşil Kase"}</strong>
                <p class="cloc-status-pill">Siparişin Yolda · Tahmini ${rem} dk (${clock})</p>
              </div>
            </div>
          </div>
          <div class="cloc-details">
            <div class="cloc-detail-row">
              <span class="cloc-label">📦 Sipariş İçeriği</span>
              <span class="cloc-val">${o.itemsSummary || "Taze Menü Siparişi"}</span>
            </div>
            <div class="cloc-detail-row">
              <span class="cloc-label">📍 Teslimat Adresi</span>
              <span class="cloc-val">${o.deliveryAddress || "Levent Mah. Konut Sok. No:4"}</span>
            </div>
            <div class="cloc-detail-row">
              <span class="cloc-label">💳 Toplam Tutar</span>
              <span class="cloc-val"><strong>${o.totalTRY || 380} TL</strong></span>
            </div>
            <div class="cloc-detail-row">
              <span class="cloc-label">🚦 Yol & Trafik Durumu</span>
              <span class="cloc-val ${d.delayMin > 0 ? "text-warn" : "text-ok"}">
                ${d.delayMin > 0 ? `Yoğunluk nedeniyle +${d.delayMin} dk gecikme` : "Normal seyrediyor"}
              </span>
            </div>
          </div>
          <button class="cloc-btn" data-action="track" data-id="${o.id || "active"}">🚀 Canlı Sipariş Haritası & Detayı</button>
        </div>
      `;
    }

    if (m.followups && m.followups.length) {
      html += `<div class="ai-followups">
        ${m.followups.map(f => `<button class="ai-followup-chip" data-followup="${f}">${f}</button>`).join("")}
      </div>`;
    }
    return html;
  }).join("");

  /* En alta inmek kullanıcıyı kartların sonuna atıyordu; asıl okunacak yer
     yanıt metni. Son asistan balonunun başına hizalanıyoruz. */
  const balonlar = body.querySelectorAll(".chat-bubble.assistant");
  const sonBalon = balonlar[balonlar.length - 1];
  if (sonBalon) {
    body.scrollTop = Math.max(0, sonBalon.offsetTop - body.offsetTop - 12);
  } else {
    body.scrollTop = body.scrollHeight;
  }

  document.querySelectorAll("[data-chat-inc]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.chatInc;
      const all = STATE.chatMessages.flatMap(m => [
        ...(m.items || []),
        ...((m.groups || []).flatMap(g => g.items || []))
      ]);
      const it = all.find(x => x.itemId === id);
      if (it) { addToCart(it); STATE.chatAddedToCart = true; }
      renderChatMessages();
      syncChatCartBar();
    });
  });
  document.querySelectorAll("[data-chat-dec]").forEach(btn => {
    btn.addEventListener("click", () => {
      removeFromCart(btn.dataset.chatDec);
      renderChatMessages();
      syncChatCartBar();
    });
  });
  document.querySelectorAll("[data-followup]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (STATE.chatGenerating) return;
      handleChatMessage(btn.dataset.followup);
    });
  });
  document.querySelectorAll(".cloc-btn").forEach(btn => {
    btn.addEventListener("click", () => renderTracking());
  });
  // Mart köprüsü: mevcut A2A devir teslim ekranıyla dikeyler arası geçiş
  document.querySelectorAll("[data-mart-go]").forEach(btn => {
    btn.addEventListener("click", () => handoffToMart());
  });
  document.querySelectorAll("[data-open-rest]").forEach(el => {
    el.addEventListener("click", () => openRestaurant(el.dataset.openRest));
  });
}

/* Sepet çubuğu yalnızca kullanıcı BU sohbette ürün eklediyse görünür.
   Aksi halde önceki akışlardan kalan sepet, alakasız bir ekranda beliriyordu. */
function syncChatCartBar() {
  const bar = document.getElementById("chatCartBar");
  if (bar && !STATE.chatAddedToCart) { bar.style.display = "none"; return; }
  const label = document.getElementById("chatCartLabel");
  if (!bar) return;
  if (cartCount() > 0) {
    bar.style.display = "flex";
    label.textContent = `${cartCount()} ürün · ${cartTotal()} TL`;
  } else {
    bar.style.display = "none";
  }
}

let chatTimers = [];

function clearChatTimers() {
  chatTimers.forEach(clearTimeout);
  chatTimers = [];
}

function setChatGenerating(on) {
  STATE.chatGenerating = on;
  const bar = document.querySelector(".chat-input-bar");
  if (bar) bar.classList.toggle("generating", !!on);
  const sendBtn = document.getElementById("chatSend");
  if (sendBtn) sendBtn.classList.toggle("stop-mode", !!on);
  const input = document.getElementById("chatInput");
  if (input) input.placeholder = on ? "Yanıt hazırlanıyor…" : "Bir şeyler sor ya da yaz…";
}

function stopChatGeneration() {
  clearChatTimers();
  const last = STATE.chatMessages[STATE.chatMessages.length - 1];
  if (last && last.role === "steps") last.done = true;
  setChatGenerating(false);
  renderChatMessages();
}

function restaurantBlurb(r, items) {
  const names = items.slice(0, 2).map(i => i.itemName).join(" ve ");
  const t = (r.tags || []).join(" ");
  let tone = "Sevilen bir adres";
  if (/hafif|saglikli|vejetaryen|vegan/.test(t)) tone = "Hafif ve taze tarafta güçlü";
  else if (/acili/.test(t)) tone = "Acı sevenler için";
  else if (/corba|geleneksel/.test(t)) tone = "Sıcak ve geleneksel";
  else if (/ev-yemegi/.test(t)) tone = "Ev yemeği tadında";
  else if (/hizli|fast-food/.test(t)) tone = "Hızlı teslimatta iyi";
  else if (/sushi|uzakdogu/.test(t)) tone = "Uzak Doğu lezzetleri";
  return `${tone} — özellikle ${names} öne çıkıyor.`;
}

function buildResultGroups(results) {
  const groups = [];
  results.forEach(res => {
    let g = groups.find(x => x.restaurantId === res.restaurantId);
    if (!g) {
      const r = STATE.restaurants.find(x => x.id === res.restaurantId) || {};
      g = {
        restaurantId: res.restaurantId,
        restaurantName: res.restaurantName,
        image: r.image,
        rating: r.rating,
        deliveryMinutes: r.deliveryMinutes,
        distanceKm: r.distanceKm,
        _r: r,
        items: []
      };
      groups.push(g);
    }
    g.items.push(res);
  });
  groups.forEach(g => { g.blurb = restaurantBlurb(g._r, g.items); });
  return groups;
}

/* ---------------- ASYNC GEMINI CHAT HANDLER ---------------- */
function handleOrderSupportFlow(text, typingMsg) {
  const t = (text || "").toLowerCase();
  const o = (typeof activeOrder === "function" ? activeOrder() : null) || {
    storeName: "Focus Burger & Gurme Mutfak",
    itemsSummary: "1x Trüf Cheddarlı Burger Menu, 1x San Sebastian Cheesecake",
    totalTRY: 460,
    totalPrice: "460,00 TL",
    deliveryAddress: "Levent Mah. Konut Sok. No:4 D:8"
  };
  const d = (typeof initDelivery === "function" ? initDelivery() : { delayMin: 10 });
  const rem = typeof remainingMin === "function" ? remainingMin() : 10;
  const clock = typeof deliveryClock === "function" ? deliveryClock() : "21:45";
  const storeName = o.storeName || "Focus Burger & Gurme Mutfak";

  const isIssueScreen = !!document.getElementById("issueChatBody");
  const msgArray = isIssueScreen ? (STATE.issueChat ? STATE.issueChat.messages : []) : STATE.chatMessages;
  const renderFn = isIssueScreen ? renderIssueChatMessages : renderChatMessages;

  // 1. Kuryeyi arayabilir misin? (AYRI AYRI 2 AŞAMALI AKIŞ)
  if (/kurye.*(ara|iletişim|telefon)/i.test(t)) {
    const idx = msgArray.indexOf(typingMsg);
    if (idx > -1) msgArray.splice(idx, 1);

    // 1. Balon Mesajı
    msgArray.push({
      role: "assistant",
      text: "Kurye ile doğrudan iletişim kuramıyorum ama sistem üzerinden konumunu takip etmeye devam ediyorum."
    });

    // Düşünme / Yüklenme Kartı (3 saniye gösterim)
    const stepsMsg = {
      role: "steps",
      lines: [
        "🛵 Kurye GPS konumu ve canlı harita sinyali sorgulanıyor…",
        "Tahmini varış süresi hesaplanıyor…"
      ],
      done: false
    };
    msgArray.push(stepsMsg);
    renderFn();

    // 3 saniye sonra Düşünme Kartı kaybolur ve 2. Balon Mesajı basılır:
    const timer = setTimeout(() => {
      stepsMsg.done = true;
      const sIdx = msgArray.indexOf(stepsMsg);
      if (sIdx > -1) msgArray.splice(sIdx, 1);

      const followups = ["Sipariş durumunu tekrar kontrol et", "Başka bir konuda yardım istiyorum"];
      msgArray.push({
        role: "assistant",
        text: `Siparişin tahminen ${rem} dakika içerisinde adresine teslim edilecektir.`,
        followups: followups
      });

      if (isIssueScreen) setIssueQuickChips(followups);
      renderFn();
      setChatGenerating(false);
    }, 3000);

    chatTimers.push(timer);
    return true;
  }

  // 2. İptal etmek istiyorum
  let steps = [];
  let responseText = "";
  let orderCard = false;
  let followups = [];

  if (/iptal/i.test(t)) {
    steps = [
      `🧾 Restoran ve kurye sisteminden canlı sipariş durumu doğrulanıyor…`,
      "Kurye teslimat hattı kontrol ediliyor…"
    ];
    responseText = "Aldığım bilgiler sonrasında siparişinin yolda olduğunu teyit ettim. Ne yazık ki dağıtıma çıkartılan siparişleri sistem üzerinden iptal edemiyoruz. Sipariş adresine ulaştığında dilersen teslim almayabilirsin, bir sorun yaşarsan hemen bana yazabilirsin.";
    followups = ["Sipariş ne zaman gelir?", "Kurye nerede?"];
  }
  // 3. Tahmini süre nedir?
  else if (/tahmini.*süre|teslimat.*süre|kalan.*süre/i.test(t)) {
    steps = [
      "⏱️ Anlık güzergâh trafiği ve kurye hızı hesaplanıyor…",
      "Tahmini varış süresi güncelleniyor…"
    ];
    responseText = `${storeName} siparişinin adresine ulaşması için tahmini kalan süre: ${rem} dakika (${clock}). Mutfak ve yol yoğunluğu nedeniyle ${d.delayMin || 10} dakika gecikme yaşanmaktadır. Kuryemiz Mert K. şu an yaklaşık 1.8 km mesafede ve lokasyonuna doğru sorunsuz ilerliyor.`;
    followups = ["Kuryeyi arayabilir misin?", "Siparişim nerede"];
  }
  // 4. Sipariş nerede? / Sipariş durumunu tekrar kontrol et
  else if (/sipariş.*(nerede|durum|kontrol)/i.test(t)) {
    steps = [
      `🍔 Aktif sipariş verisi ve restoran bilgileri çekiliyor (${storeName})…`,
      `🛵 Kurye GPS konumu ve güzergâh gecikmesi doğrulanıyor (+${d.delayMin || 10} dk gecikme)…`
    ];
    responseText = `${storeName} siparişin yolda! Mutfak ve yol yoğunluğu nedeniyle ${d.delayMin || 10} dakika gecikme yaşanmaktadır. Canlı sipariş ve teslimat detaylarını aşağıda senin için hazırladım:`;
    orderCard = true;
    followups = ["Tahmini süre nedir?", "Kuryeyi arayabilir misin?"];
  }
  // 5. Müşteri hizmetlerine bağlan / Başka bir konuda yardım istiyorum
  else if (/müşteri (hizmetleri|temsilcisi)|temsilci|canlı destek|bağlan|yardım istiyorum/i.test(t)) {
    steps = [
      "💬 Kullanıcı profil bilgileri ve aktif sipariş geçmişi hazırlanıyor…",
      "Canlı destek hattına bağlanılıyor…"
    ];
    responseText = "Sana yardım etmek için buradayım, yaşadığın deneyimi anlatır mısın?";
    followups = ["İptal etmek istiyorum", "Siparişim nerede"];
  }

  if (steps.length === 0) return false;

  const stepsMsg = { role: "steps", lines: steps, done: false };
  const idx = msgArray.indexOf(typingMsg);
  if (idx > -1) {
    msgArray[idx] = stepsMsg;
  } else {
    msgArray.push(stepsMsg);
  }
  renderFn();

  const timer = setTimeout(() => {
    stepsMsg.done = true;
    const sIdx = msgArray.indexOf(stepsMsg);
    if (sIdx > -1) msgArray.splice(sIdx, 1);

    msgArray.push({
      role: "assistant",
      text: responseText,
      orderCard: orderCard,
      followups: followups
    });

    if (isIssueScreen) setIssueQuickChips(followups);
    renderFn();
    setChatGenerating(false);
  }, 2600);

  chatTimers.push(timer);
  return true;
}

/* ---------------- ASYNC GEMINI CHAT HANDLER ---------------- */
async function handleChatMessage(text, opts) {
  clearChatTimers();
  // Otomatik başlatılan akışlarda kullanıcı balonu gösterilmez
  if (!opts || !opts.silent) STATE.chatMessages.push({ role: "user", text });

  const typingMsg = { role: "typing" };
  STATE.chatMessages.push(typingMsg);
  setChatGenerating(true);
  renderChatMessages();

  // Canlı sipariş ve destek sorularında 2.6sn düşünme adımları ve net kibar AI cevabı çalıştırılır:
  if (handleOrderSupportFlow(text, typingMsg)) {
    return;
  }

  try {
    // Gemini API veya Yerel Fallback
    const aiData = await callGeminiCompanion(text);
    const results = (aiData && aiData.results) || [];
    const groups = buildResultGroups(results);

    const i = STATE.chatMessages.indexOf(typingMsg);
    if (i > -1) STATE.chatMessages.splice(i, 1);

    if (results.length === 0) {
      STATE.chatMessages.push({
        role: "assistant",
        text: (aiData && aiData.companionMessage) || "Bu tarife uygun bir restoran menüsü bulamadım — dilersen evde hazırlamak için market malzemelerini aşağıya ekledim!",
        martHandoff: aiData && aiData.martHandoff,
        followups: (aiData && aiData.followups) || ["Daha uygun fiyatlı olsun", "Başka bir şey öner"]
      });
    } else {
      STATE.chatMessages.push({
        role: "assistant",
        text: aiData.companionMessage,
        groups,
        martHandoff: aiData.martHandoff,
        followups: aiData.followups
      });
    }
  } catch (err) {
    console.error("⚠️ [Orbit AI] Chat işleme hatası:", err);
    const i = STATE.chatMessages.indexOf(typingMsg);
    if (i > -1) STATE.chatMessages.splice(i, 1);

    const fallback = typeof fallbackLocalAi === "function" ? fallbackLocalAi(text) : null;
    const fallbackResults = (fallback && fallback.results) || [];
    STATE.chatMessages.push({
      role: "assistant",
      text: (fallback && fallback.companionMessage) || "Aradığın lezzet için seçenekleri ve evde hazırlama tarif malzemelerini derledim.",
      groups: buildResultGroups(fallbackResults),
      martHandoff: typeof getMartHandoff === "function" ? getMartHandoff(text) : null,
      followups: ["Akşam yemeği için hafif bir şey 🍲", "Sıcak ev yemeği & çorba 🥣"]
    });
  } finally {
    setChatGenerating(false);
    renderChatMessages();
  }
}

function reflectIntent(text, signals) {
  const t = text.toLowerCase();
  if (/çorba|corba|sıcak|sicak/.test(t)) return "Canın sıcak ve içini ısıtacak bir şey çekiyor.";
  if (/tatlı|tatli|dessert/.test(t)) return "Tatlı bir mola arıyorsun.";
  if (/hafif|light/.test(t)) return "Hafif ve ağır olmayan bir akşam yemeği istiyorsun.";
  if (/vegan|vejetaryen/.test(t)) return "Et içermeyen seçenekler arıyorsun.";
  if (/doyurucu|aç|ac /.test(t)) return "İyice doyurucu bir şey arıyorsun.";
  if (signals && signals.budget) return `Bütçeni ${signals.budget} TL civarında tutmak istiyorsun.`;
  return `"${text}" için en uygun seçenekleri arıyorum.`;
}

/* Fotoğrafla arama: görsel seçtirir, yemeği tanır ve normal öneri akışını
   bu sorguyla çalıştırır. Ana sayfadaki arama çubuğu da bunu kullanır. */
function openPhotoSearch() {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";
  picker.onchange = () => {
    const file = picker.files && picker.files[0];
    if (!file) return;
    if (!document.getElementById("chatBody")) renderAiChat(true);
    handlePhotoSearch(file);
  };
  picker.click();
}

async function handlePhotoSearch(file) {
  clearChatTimers();
  const shrunk = await shrinkImage(file, 512);
  STATE.chatMessages.push({
    role: "user",
    text: "Fotoğraf gönderildi",
    photo: true,
    src: shrunk ? shrunk.dataUrl : null
  });

  const typingMsg = { role: "typing" };
  STATE.chatMessages.push(typingMsg);
  setChatGenerating(true);
  renderChatMessages();

  // Tanıma ve öneri tek istekte geliyor
  const seen = shrunk ? await photoSearchWithGemini(shrunk.base64, shrunk.mimeType) : null;
  const i = STATE.chatMessages.indexOf(typingMsg);
  if (i > -1) STATE.chatMessages.splice(i, 1);

  if (seen && seen.isFood === false) {
    STATE.chatMessages.push({
      role: "assistant",
      text: "Bu fotoğrafta bir yemek göremedim. Aradığın lezzetin fotoğrafını paylaşabilir ya da ne canın çektiğini yazabilirsin.",
      followups: ["Akşam yemeği için hafif bir şey", "Bütçem 150 TL, doyurucu olsun"]
    });
    setChatGenerating(false);
    renderChatMessages();
    return;
  }

  // Model ulaşılamazsa yerel motor devreye girer
  const results = (seen && seen.results && seen.results.length)
    ? seen.results
    : aiSearch("doyurucu");

  STATE.chatMessages.push({
    role: "assistant",
    text: seen && seen.dishName
      // note ile companionMessage aynı şeyi söylüyordu; tek cümle yeter
      ? `Fotoğrafta <strong>${seen.dishName}</strong> görüyorum. ${seen.companionMessage || "Buna en yakın seçenekler:"}`
      : "Fotoğraftaki lezzete en yakın seçenekler:",
    groups: buildResultGroups(results),
    followups: (seen && seen.followups && seen.followups.length)
      ? seen.followups
      : ["Daha uygun fiyatlı olsun", "Başka bir şey öner"]
  });
  setChatGenerating(false);
  renderChatMessages();
}

function renderOrdersHistory() {
  resetScreenChrome();
  setActiveTab("orders");
  const orders = (typeof DETAILED_ORDERS !== "undefined" ? DETAILED_ORDERS : []).slice().sort((a, b) => b.timestamp - a.timestamp);

  root.innerHTML = `
    <div class="screen">
      <div class="screen-header">
        <button class="back-btn" id="back">‹</button>
        <div>
          <p class="screen-title">Siparişlerim</p>
        </div>
      </div>

      <div class="orders-clean-list">
        ${orders.map(o => `
          <div class="clean-order-card ${o.status === "active" ? "active-order" : ""}">
            <div class="coc-main-row">
              <img src="${o.image}" alt="" class="coc-thumb-compact" />
              <div class="coc-info">
                <div class="coc-title-row">
                  <h4 class="coc-name">${o.storeName}</h4>
                  <span class="coc-price">${o.totalPrice}</span>
                </div>
                <p class="coc-date">${o.date} ${o.status === "active" ? "· 🚀 Yolda" : "tarihinde teslim edildi"}</p>
                <p class="coc-summary">${o.itemsSummary}</p>
                ${(() => {
                  const method = o.payMethod === "orbitpay_wallet" ? "orbitpay" : "card";
                  const cb = getCheckoutCashback(method, o.totalTRY || 0, o.vertical, o.tierAtOrder || "Base");
                  // Oran/kanal rozeti kaldırıldı; kazanılan tutar tek başına yeterli
                  return cb.amount > 0
                    ? `<p class="coc-cashback"><span class="cocb-amount">${tl(cb.amount)} nakit iade</span></p>`
                    : "";
                })()}
              </div>
            </div>

            <div class="coc-action">
              ${o.status === "active" ? `
                <button class="coc-btn navy-btn" data-action="track" data-id="${o.id}">🚀 Canlı Sipariş Takibi</button>
              ` : `
                <button class="coc-btn outline-btn" data-action="reorder" data-id="${o.id}">Siparişi Tekrarla</button>
              `}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  document.getElementById("back").addEventListener("click", renderHome);
  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const act = btn.dataset.action;
      if (act === "track") {
        renderTracking();
      } else if (act === "reorder") {
        const order = (typeof DETAILED_ORDERS !== "undefined" ? DETAILED_ORDERS : []).find(o => o.id === btn.dataset.id);
        if (order && order.items) {
          STATE.cart = {};
          const rest = STATE.restaurants.find(r => r.name === order.storeName);
          order.items.forEach(it => {
            const menuItem = rest && (rest.menu || []).find(m => m.name === it.name);
            for (let i = 0; i < (it.qty || 1); i++) {
              addToCart({
                itemId: menuItem ? menuItem.id : `reorder-${it.name}`,
                itemName: it.name,
                price: it.price,
                restaurantId: rest ? rest.id : null,
                restaurantName: order.storeName
              });
            }
          });
          if (rest) STATE.activeRestaurant = rest;
        }
        toast("Sipariş ürünleri sepete eklendi!");
        renderCheckout();
      }
    });
  });
}

/* ---------------- Collection Pages ---------------- */
/* Koleksiyon sayfaları filtresiz açılır; "Tercihlerim" filtresi kullanıcının
   kendi seçimiyle uygulanır — sayfaya girer girmez süzülmüş liste gösterilmez. */
if (!STATE.nightFilters) {
  STATE.nightFilters = {
    sortBy: "featured",
    cuisine: null,
    preferences: []
  };
}

/* Filtre çiplerinin restoran eşleştirmesi. Hem listeyi süzerken hem de
   modaldaki canlı sonuç sayacında aynı fonksiyon kullanılıyor. */
const DIET_FILTER_CHIPS = [
  { key: "vegetarian",  icon: "🌱", label: "Vejetaryen" },
  { key: "vegan",       icon: "🌿", label: "Vegan" },
  { key: "glutensiz",   icon: "🌾", label: "Glutensiz" },
  { key: "pesketaryen", icon: "🐟", label: "Pesketaryen" }
];

function matchesDietPref(r, p) {
  const tags = (r.tags || []).join(" ");
  const menu = r.menu || [];
  if (p === "vegetarian") return /vejetaryen|vegan/.test(tags) || menu.some(m => (m.tags || []).some(t => /vejetaryen|vegan/.test(t)));
  if (p === "vegan") return /vegan/.test(tags) || menu.some(m => (m.tags || []).includes("vegan"));
  if (p === "glutensiz") return menu.some(m => !(m.allergens || []).includes("gluten"));
  if (p === "pesketaryen") return /deniz|sushi|balık/.test(tags + " " + r.cuisine.toLowerCase())
    || menu.some(m => (m.ingredients || []).some(i => /somon|balık|deniz/.test(i)))
    || matchesDietPref(r, "vegetarian");
  return false;
}

/* Seçili çiplere uyan restoran sayısı — butonda canlı gösterilir. */
function countMatchingRestaurants(prefs) {
  if (!prefs.length) return STATE.restaurants.length;
  return STATE.restaurants.filter(r => prefs.every(p => matchesDietPref(r, p))).length;
}

const COLLECTIONS = {
  night: {
    emoji: "🌙",
    title: "Akşam Molası",
    sub: "Gece boyunca kesintisiz teslimat · Tek tıkla sipariş ver",
    listLabel: "Gece Açık Restoranlar",
    searchPlaceholder: "Gece açık restoran veya lezzet ara…",
    base: () => STATE.restaurants.slice()
  },
  near: {
    emoji: "📍",
    title: "Yakınımda",
    sub: "Sana en yakın işletmeler · Kısa teslimat mesafesi",
    listLabel: "Yakındaki İşletmeler",
    searchPlaceholder: "Yakınındaki restoranlarda ara…",
    base: () => STATE.restaurants.slice().sort((a, b) => a.distanceKm - b.distanceKm)
  },
  featured: {
    emoji: "✦",
    title: "Öne Çıkanlar",
    sub: "En yüksek puanlı lezzet noktaları · Topluluk favorileri",
    listLabel: "Öne Çıkan Lezzet Noktaları",
    searchPlaceholder: "Öne çıkan restoranlarda ara…",
    base: () => STATE.restaurants.slice().sort((a, b) => b.rating - a.rating)
  },
  local: {
    emoji: "🍽",
    title: "Yerel İşletmeler",
    sub: "Mahallenin küçük ve butik mutfakları · Uygun fiyat",
    listLabel: "Yerel & Butik İşletmeler",
    searchPlaceholder: "Yerel işletmelerde ara…",
    base: () => STATE.restaurants.filter(r => r.priceLevel <= 2)
  }
};

function renderNightMunchiesPage() {
  renderCollectionPage("night");
}

function dietMatchesItem(m, prefs) {
  const tags = (m.tags || []).join(" ");
  const reasons = [];

  if (prefs.style === "vegan") {
    if (!/vegan/.test(tags)) return null;
    reasons.push("vegan");
  } else if (prefs.style === "vejetaryen") {
    if (!/vejetaryen|vegan/.test(tags)) return null;
    reasons.push(/vegan/.test(tags) ? "vegan" : "vejetaryen");
  } else if (prefs.style === "et-agirlikli") {
    if (/vegan/.test(tags) || !/protein|doyurucu|kebap|burger|tavuk/.test(tags + " " + (m.ingredients || []).join(" "))) return null;
    reasons.push("et ağırlıklı");
  } else if (prefs.style === "dengeli") {
    reasons.push("dengeli beslenmeye uygun");
  }

  if (prefs.allergens && prefs.allergens.length) {
    const hit = (m.allergens || []).filter(a => prefs.allergens.includes(a));
    if (hit.length) return null;
    reasons.push(`${prefs.allergens.join(", ")} içermiyor`);
  }
  return reasons;
}

/* Diyet süzmesi açık mı? Alerjen koruması bundan bağımsızdır. */
function dietFilterOn() {
  const p = (STATE.user && STATE.user.declaredPreferences) || {};
  return p.dietFilterActive !== false;
}
function setDietFilter(on) {
  if (STATE.user && STATE.user.declaredPreferences) {
    STATE.user.declaredPreferences.dietFilterActive = !!on;
  }
}

/* Profil satırındaki durum metni */
function dietSummaryLine() {
  return dietFilterOn()
    ? "Orbit AI tüm aramalarda tercihlerine saygı duyar."
    : "Beslenme alışkanlıklarına göre tercihlerini yapabilirsin";
}

function dietStyleId() {
  if (!dietFilterOn()) return null;
  return (STATE.user && STATE.user.declaredPreferences && STATE.user.declaredPreferences.dietStyle) || null;
}

function renderDietPicksPage() {
  resetScreenChrome();
  const p = (STATE.user && STATE.user.declaredPreferences) || {};
  const prefs = {
    style: dietStyleId(),
    allergens: p.allergensToAvoid || []
  };

  const picks = [];
  STATE.restaurants.forEach(r => {
    (r.menu || []).forEach(m => {
      const reasons = dietMatchesItem(m, prefs);
      if (reasons) picks.push({ r, m, reasons });
    });
  });
  picks.sort((a, b) => b.r.rating - a.r.rating);

  const chips = [];
  if (dietFilterOn() && p.dietStyle) {
    chips.push({ icon: dietStyleIcon(p.dietStyle), label: dietStyleLabel(p.dietStyle), step: "Beslenme tarzı" });
  }
  (p.dislikes || []).forEach(d => chips.push({ icon: "👎", label: d, step: "Damak tadı" }));
  if (dietFilterOn()) {
    (p.allergensToAvoid || []).forEach(a => {
      chips.push({ icon: "⚠️", label: a, step: "Kaçındığın içerik" });
    });
  }

  root.innerHTML = `
    <div class="screen" style="padding-top:0">
      <div class="night-hero-header">
        <div class="nhh-top-row">
          <button class="back-btn white" id="dietBack">‹</button>
          <h2 class="nhh-title">🥗&nbsp; Beslenme Tercihlerin</h2>
        </div>
        <p class="nhh-sub">Ayarlarındaki seçimlere göre süzüldü · ${picks.length} uygun seçenek</p>
      </div>

      <div class="diet-prefs-panel">
        <div class="dpp-head">
          <span class="dpp-title">Kayıtlı tercihlerin</span>
          <button class="dpp-edit" id="dietEditBtn">Düzenle ›</button>
        </div>
        <div class="dpp-chips">
          ${chips.length
            ? chips.map(c => `<span class="dpp-chip" title="${c.step}"><i>${c.icon}</i>${c.label}</span>`).join("")
            : `<span class="dpp-empty">Henüz tercih kaydetmemişsin.</span>`}
        </div>
      </div>

      <div class="section-title"><span>Tercihlerine Uyan Yemekler (${picks.length})</span></div>

      ${picks.length ? picks.map(({ r, m, reasons }) => `
        <div class="result-card diet-pick" data-restaurant="${r.id}" data-item="${m.id}">
          ${m.image ? `<div class="food-art img-art"><img src="${m.image}" alt="" class="food-img-thumb" /></div>` : foodIconTile(m.tags)}
          <div class="result-body">
            <div class="result-title-row">
              <p class="result-name">${m.name}</p>
              <span class="result-price">${m.price} TL</span>
            </div>
            <p class="result-sub">${r.name} · ⭐ ${r.rating} · ${r.deliveryMinutes} dk</p>
            <div class="diet-reason-row">
              ${reasons.map(x => `<span class="diet-reason-chip">✓ ${x}</span>`).join("")}
            </div>
          </div>
        </div>
      `).join("") : `
        <div class="empty-state" style="padding:26px 12px;text-align:center">
          <p style="font-size:13px;color:var(--orbit-muted)">Kayıtlı tercihlerine tam uyan bir yemek bulamadım.</p>
          <button class="btn-secondary" id="dietEditBtn2" style="margin-top:10px">Tercihlerimi düzenle</button>
        </div>
      `}
    </div>
  `;

  document.getElementById("dietBack").addEventListener("click", renderHome);
  ["dietEditBtn", "dietEditBtn2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", renderPreferencesOnboarding);
  });
  document.querySelectorAll(".diet-pick").forEach(el => {
    el.addEventListener("click", () => openRestaurant(el.dataset.restaurant, el.dataset.item));
  });
}
window.renderDietPicksPage = renderDietPicksPage;
window.renderNightMunchiesPage = renderNightMunchiesPage;
window.renderCollectionPage = renderCollectionPage;

function renderCollectionPage(key) {
  resetScreenChrome();
  const col = COLLECTIONS[key] || COLLECTIONS.night;
  STATE.activeCollection = key;
  const u = STATE.user || {};
  const filters = STATE.nightFilters || { preferences: [], sortBy: "featured", cuisine: null };
  const prefsData = {
    allergens: (u.declaredPreferences && u.declaredPreferences.allergensToAvoid) || [],
    dislikes: (u.declaredPreferences && u.declaredPreferences.dislikes) || []
  };

  let list = col.base();
  const localQuery = (STATE.collectionQuery || "").trim().toLowerCase();
  if (localQuery) {
    list = list.filter(r =>
      r.name.toLowerCase().includes(localQuery) ||
      r.cuisine.toLowerCase().includes(localQuery) ||
      (r.tags || []).some(t => t.toLowerCase().includes(localQuery)) ||
      (r.menu || []).some(m => m.name.toLowerCase().includes(localQuery))
    );
  }

  if (filters.cuisine) {
    const c = filters.cuisine.toLowerCase();
    list = list.filter(r => 
      r.cuisine.toLowerCase().includes(c) || 
      (r.tags && r.tags.some(t => t.toLowerCase().includes(c)))
    );
  }

  const matchesPref = (r, p) => {
    if (p === "vegetarian") return !!(r.tags && r.tags.some(t => /vejetaryen|vegan/.test(t)));
    if (p === "fast") return r.deliveryMinutes <= 25;
    return false;
  };
  const prefScore = (r) => filters.preferences.reduce((s, p) => s + (matchesPref(r, p) ? 1 : 0), 0);
  list.forEach(r => { r._aiPick = filters.preferences.length > 0 && prefScore(r) === filters.preferences.length; });

  if (filters.sortBy === "rating") {
    list.sort((a, b) => b.rating - a.rating);
  } else if (filters.sortBy === "delivery") {
    list.sort((a, b) => a.deliveryMinutes - b.deliveryMinutes);
  } else if (filters.sortBy === "distance") {
    list.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  if (filters.preferences.length > 0) {
    list.sort((a, b) => prefScore(b) - prefScore(a));
  }

  root.innerHTML = `
    <div class="screen" style="padding-top:0">
      <div class="night-hero-header">
        <div class="nhh-top-row">
          <button class="back-btn white" id="nightBack">‹</button>
          <h2 class="nhh-title">${col.emoji}&nbsp; ${col.title}</h2>
        </div>
        <p class="nhh-sub">${col.sub}</p>

        <div class="search-bar hero-search night-search">
          <span class="icon search-glass"><svg width="17" height="17" viewBox="0 0 24 24"><use href="#icon-search"/></svg></span>
          <input id="nightSearchInput" placeholder="${col.searchPlaceholder}" value="${STATE.collectionQuery || ""}" />
          ${STATE.collectionQuery ? `<button class="ns-clear" id="nightSearchClear" aria-label="Aramayı temizle">✕</button>` : ""}
        </div>
      </div>

      <div class="filter-pills-scroll">
        <button class="filter-pill-btn ${filters.sortBy !== "featured" ? "active" : ""}" id="openSortModal">
          <span>⇅ Sırala: ${filters.sortBy === "rating" ? "Puan" : filters.sortBy === "delivery" ? "Hız" : filters.sortBy === "distance" ? "Mesafe" : "Öne Çıkan"}</span>
          <span class="pill-arrow">▾</span>
        </button>

        <button class="filter-pill-btn ${filters.cuisine ? "active" : ""}" id="openCuisineModal">
          <span>🍲 Mutfak: ${filters.cuisine || "Tümü"}</span>
          <span class="pill-arrow">▾</span>
        </button>

        ${dietFilterOn() ? `
          <div class="filter-pill-btn active pref-locked-chip" style="cursor:default; pointer-events:none; background:rgba(16, 185, 129, 0.12); border-color:#10b981; color:#065f46; font-weight:700;" title="Profil tercihleriniz otomatik uygulanmaktadır">
            <span>🌱 Tercihlerim <span style="font-size:10.5px; background:#10b981; color:#fff; padding:2px 7px; border-radius:10px; margin-left:4px; font-weight:800;">Aktif ✓</span></span>
          </div>
        ` : `
          <button class="filter-pill-btn ${filters.preferences.length > 0 ? "active" : ""}" id="openPrefsModal">
            <span>🌱 Tercihlerim ${filters.preferences.length > 0 ? `(${filters.preferences.length})` : ""}</span>
            <span class="pill-arrow">▾</span>
          </button>
        `}
      </div>

      ${(filters.cuisine || filters.preferences.length > 0 || filters.sortBy !== "featured") ? `
        <div class="active-filters-strip">
          <span class="af-label">Aktif Filtreler:</span>
          ${filters.cuisine ? `<span class="af-chip" id="clearCuisineChip">${filters.cuisine} ✕</span>` : ""}
          ${filters.preferences.map(p => `<span class="af-chip" data-clear-pref="${p}">${p === "vegetarian" ? "Vejetaryen" : "25 dk Altı"} ✕</span>`).join("")}
          <button class="af-clear-all" id="clearAllFilters">Temizle</button>
        </div>
      ` : ""}

      <div class="night-restaurants-list">
        <div class="section-title">
          <span>${col.listLabel} (${list.length})</span>
          ${(dietFilterOn() || filters.preferences.length > 0) ? `<span class="link" style="color:var(--orbit-ai-dark); font-weight:700;">✦ Orbit AI tercihlerine göre belirledi</span>` : ""}
        </div>

        ${list.length > 0 ? list.map(r => `
          <div class="result-card night-card ${r._aiPick ? "ai-pick" : ""}" data-restaurant="${r.id}">
            ${storeIconTile(r.image)}
            <div class="result-body">
              <div class="result-title-row">
                <p class="result-name">${r.name}</p>
                <span class="result-price">${r.priceLevel === 1 ? "₺" : r.priceLevel === 2 ? "₺₺" : "₺₺₺"}</span>
              </div>
              <p class="result-sub">${r.cuisine} · ⭐ ${r.rating} · ${r.deliveryMinutes} dk · ${r.distanceKm} km</p>
              <div class="night-tag-row">
                ${r._aiPick ? `<span class="ai-pick-badge">✦ Tercihlerine uygun</span>` : ""}
                <span class="night-open-badge">🌙 04:00'e kadar</span>
                <span class="night-cashback-badge">✦ %${Math.round(CASHBACK_RATES[currentTier()].eats * 100)} nakit iade</span>
              </div>
            </div>
          </div>
        `).join("") : `
          <div class="empty-state" style="padding:30px 10px;text-align:center">
            <p style="font-size:13px;color:var(--orbit-muted)">Seçilen filtrelere uygun gece açık restoran bulunamadı.</p>
            <button class="btn-secondary" id="resetNightFilters" style="margin-top:10px">Filtreleri Temizle</button>
          </div>
        `}
      </div>

      <div id="sortModal" class="tier-modal-overlay" style="display:none">
        <div class="tier-modal-content">
          <div class="tier-modal-header">
            <h3>⇅ Sıralama Seçenekleri</h3>
          </div>
          <div class="tier-modal-body">
            <div class="modal-radio-list">
              <label class="modal-radio-item ${filters.sortBy === "featured" ? "selected" : ""}">
                <input type="radio" name="sortBy" value="featured" ${filters.sortBy === "featured" ? "checked" : ""} />
                <span>Öne Çıkanlar (Varsayılan)</span>
              </label>
              <label class="modal-radio-item ${filters.sortBy === "rating" ? "selected" : ""}">
                <input type="radio" name="sortBy" value="rating" ${filters.sortBy === "rating" ? "checked" : ""} />
                <span>⭐ Puan (Yüksekten Düşüğe)</span>
              </label>
              <label class="modal-radio-item ${filters.sortBy === "delivery" ? "selected" : ""}">
                <input type="radio" name="sortBy" value="delivery" ${filters.sortBy === "delivery" ? "checked" : ""} />
                <span>⚡ Teslimat Süresi (En Hızlı)</span>
              </label>
              <label class="modal-radio-item ${filters.sortBy === "distance" ? "selected" : ""}">
                <input type="radio" name="sortBy" value="distance" ${filters.sortBy === "distance" ? "checked" : ""} />
                <span>📍 Mesafe (En Yakın)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div id="cuisineModal" class="tier-modal-overlay" style="display:none">
        <div class="tier-modal-content">
          <div class="tier-modal-header">
            <h3>🍲 Mutfaklar (Cuisines)</h3>
          </div>
          <div class="tier-modal-body">
            <div class="cuisines-grid">
              ${[
                { id: "hamburger", label: "Hamburger", icon: "🍔" },
                { id: "pizza", label: "Pizza", icon: "🍕" },
                { id: "et", label: "Kebap", icon: "🥩" },
                { id: "tavuk", label: "Tavuk", icon: "🍗" },
                { id: "salata", label: "Salata", icon: "🥗" },
                { id: "tatli", label: "Tatlı", icon: "🍰" },
                { id: "uzakdogu", label: "Uzak Doğu", icon: "🍜" },
                { id: "evyemegi", label: "Ev Yemekleri", icon: "🍲" },
                { id: "italyan", label: "İtalyan", icon: "🍝" },
                { id: "kahve", label: "Kahve", icon: "☕" },
                { id: "vejetaryen", label: "Vejetaryen", icon: "🌱" },
                { id: "deniz", label: "Deniz Ürünleri", icon: "🐟" }
              ].map(c => `
                <div class="cuisine-tile ${filters.cuisine === c.label ? "selected" : ""}" data-cuisine="${c.label}">
                  <span class="cuisine-tile-icon">${c.icon}</span>
                  <span class="cuisine-tile-label">${c.label}</span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </div>

      <div id="prefsModal" class="tier-modal-overlay" style="display:none">
        <div class="tier-modal-content">
          <div class="tier-modal-header">
            <h3>🌱 Beslenme & Filtreler</h3>
          </div>
          <div class="tier-modal-body">

            <!-- Alerjen koruması: kutu değil, tek satır şerit -->
            ${(prefsData.allergens || []).length ? `
              <div class="guard-strip">
                <span class="gs-lock">🔒</span>
                <div class="gs-chips">
                  ${prefsData.allergens.map(a => `<span class="gs-chip">${a} <em>korumalı</em></span>`).join("")}
                </div>
                <button class="gs-edit" id="editAllergensBtn">Düzenle ›</button>
              </div>` : ""}

            <!-- Tek dokunuşla açılıp kapanan diyet çipleri -->
            <p class="filter-section-label">Hızlı diyet tercihleri</p>
            <div class="diet-chip-row">
              ${DIET_FILTER_CHIPS.map(c => `
                <button class="diet-chip ${filters.preferences.includes(c.key) ? "on" : ""}" data-diet="${c.key}">
                  <span>${c.icon}</span>${c.label}
                  ${dietFilterDefaults().includes(c.key) ? `<i class="dc-dot" title="Profilinden"></i>` : ""}
                </button>
              `).join("")}
            </div>

            <!-- AI ipucu: paragraf değil, tek satır -->
            ${(prefsData.dislikes || []).length
              ? `<p class="ai-microhint">✨ Profiline göre ${prefsData.dislikes.join(", ")} içermeyen seçenekler otomatik öne çıkarılır.</p>`
              : ""}

            <button class="btn-primary" id="applyPrefsBtn" style="margin-top:16px">
              Sonuçları Göster <span id="prefCount">(${countMatchingRestaurants(filters.preferences)} restoran)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("nightBack").addEventListener("click", () => {
    STATE.collectionQuery = "";
    renderHome();
  });

  const sortModal = document.getElementById("sortModal");
  const cuisineModal = document.getElementById("cuisineModal");
  const prefsModal = document.getElementById("prefsModal");

  bindBottomSheet(sortModal, "openSortModal", "closeSortModal");
  bindBottomSheet(cuisineModal, "openCuisineModal", "closeCuisineModal");
  bindBottomSheet(prefsModal, "openPrefsModal", "closePrefsModal");

  document.querySelectorAll('input[name="sortBy"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      STATE.nightFilters.sortBy = e.target.value;
      closeSheet(sortModal);
      renderCollectionPage(key);
    });
  });

  document.querySelectorAll(".cuisine-tile").forEach(tile => {
    tile.addEventListener("click", () => {
      const selected = tile.dataset.cuisine;
      STATE.nightFilters.cuisine = STATE.nightFilters.cuisine === selected ? null : selected;
      closeSheet(cuisineModal);
      renderCollectionPage(key);
    });
  });

  /* Çipler anlık açılıp kapanıyor; buton üzerindeki sonuç sayısı canlı güncelleniyor
     — kullanıcı uygulamadan önce kaç restoran kalacağını görüyor. */
  const countEl = document.getElementById("prefCount");
  const selectedChips = () =>
    [...document.querySelectorAll(".diet-chip.on")].map(c => c.dataset.diet);

  document.querySelectorAll(".diet-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      chip.classList.toggle("on");
      if (countEl) countEl.textContent = `(${countMatchingRestaurants(selectedChips())} restoran)`;
    });
  });

  document.getElementById("applyPrefsBtn").addEventListener("click", () => {
    STATE.nightFilters.preferences = selectedChips();
    closeSheet(prefsModal);
    renderCollectionPage(key);
  });

  const editAllergens = document.getElementById("editAllergensBtn");
  if (editAllergens) editAllergens.addEventListener("click", (e) => {
    e.stopPropagation();
    renderAllergenOnboarding();
  });

  const clearCuisineChip = document.getElementById("clearCuisineChip");
  if (clearCuisineChip) {
    clearCuisineChip.addEventListener("click", () => {
      STATE.nightFilters.cuisine = null;
      renderCollectionPage(key);
    });
  }
  document.querySelectorAll("[data-clear-pref]").forEach(el => {
    el.addEventListener("click", () => {
      const p = el.dataset.clearPref;
      STATE.nightFilters.preferences = STATE.nightFilters.preferences.filter(item => item !== p);
      renderCollectionPage(key);
    });
  });
  const clearAllBtn = document.getElementById("clearAllFilters");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      STATE.nightFilters = { sortBy: "featured", cuisine: null, preferences: [] };
      renderCollectionPage(key);
    });
  }
  const resetBtn = document.getElementById("resetNightFilters");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      STATE.nightFilters = { sortBy: "featured", cuisine: null, preferences: [] };
      renderCollectionPage(key);
    });
  }

  document.querySelectorAll("[data-restaurant]").forEach(el => {
    el.addEventListener("click", () => openRestaurant(el.dataset.restaurant));
  });

  const nightInput = document.getElementById("nightSearchInput");
  if (nightInput) {
    let t;
    nightInput.addEventListener("input", () => {
      clearTimeout(t);
      const val = nightInput.value;
      t = setTimeout(() => {
        STATE.collectionQuery = val;
        renderCollectionPage(key);
        const again = document.getElementById("nightSearchInput");
        if (again) { again.focus(); again.setSelectionRange(val.length, val.length); }
      }, 220);
    });
  }
  const nsClear = document.getElementById("nightSearchClear");
  if (nsClear) {
    nsClear.addEventListener("click", () => {
      STATE.collectionQuery = "";
      renderCollectionPage(key);
    });
  }
}

function setActiveTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  syncCartTabBadge();
}

/* Sepet sekmesindeki ürün adedi rozeti */
function syncCartTabBadge() {
  const badge = document.getElementById("cartTabBadge");
  if (!badge) return;
  const n = cartCount();
  badge.textContent = n > 9 ? "9+" : String(n);
  badge.hidden = n === 0;
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    setActiveTab(btn.dataset.tab);
    if (btn.dataset.tab === "home") renderHome();
    else if (btn.dataset.tab === "orders") renderOrdersHistory();
    else if (btn.dataset.tab === "cart") renderCheckout();
    else goToPreferences();
  });
});

/* ---------------- Ecosystem Switcher (SSO / A2A) ---------------- */
(function setupEcosystemSwitch() {
  const slot = document.getElementById("ecoFabGroup");
  const btn = document.getElementById("ecoSwitch");
  const shell = document.querySelector(".app-shell");
  if (!slot || !btn || !shell) return;

  let backdrop = null;

  function close() {
    slot.classList.remove("eco-open");
    btn.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    if (backdrop) backdrop.remove();
    backdrop = null;
  }

  function open() {
    backdrop = document.createElement("div");
    backdrop.className = "eco-backdrop";
    backdrop.addEventListener("click", close);
    shell.appendChild(backdrop);

    slot.classList.add("eco-open");
    btn.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }

  // Sabit konumlu buton: sürükleme yok, tek dokunuşla açılıp kapanır
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    slot.classList.contains("eco-open") ? close() : open();
  });

  function handoff(appName, tone) {
    close();
    const ov = document.createElement("div");
    ov.className = "a2a-overlay";
    ov.innerHTML = `
      <div class="a2a-card ${tone}">
        <div class="a2a-logos">
          <span class="a2a-app from">Eats</span>
          <span class="a2a-dots"><i></i><i></i><i></i></span>
          <span class="a2a-app to">${appName}</span>
        </div>
        <p class="a2a-title">Orbit ${appName}'a yönlendiriliyorsun</p>
        <p class="a2a-sub">Tek Orbit hesabınla · yeniden giriş gerekmiyor</p>
      </div>`;
    shell.appendChild(ov);
    setTimeout(() => ov.remove(), 3000);
  }

  const mart = document.getElementById("ecoMart");
  const pay = document.getElementById("ecoPay");
  if (mart) mart.addEventListener("click", (e) => { e.stopPropagation(); handoff("Mart", "mart"); });
  if (pay) pay.addEventListener("click", (e) => { e.stopPropagation(); handoff("Pay", "pay"); });
})();

/* ---------------- Push Notification for New Device Visits ---------------- */
async function notifyNewDeviceVisit() {
  try {
    if (typeof window === "undefined" || !window.location) return;

    // Kendi cihazını işaretlemek için ?owner=true
    if (window.location.search.includes("owner=true") || window.location.search.includes("admin=true")) {
      localStorage.setItem("orbit_is_owner", "true");
      return;
    }

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const isOwner = localStorage.getItem("orbit_is_owner") === "true";
    if (isLocal || isOwner) return;

    if (sessionStorage.getItem("orbit_visit_notified")) return;
    sessionStorage.setItem("orbit_visit_notified", "true");

    // 1. Benzersiz Cihaz ID (Device ID)
    let devId = localStorage.getItem("orbit_device_id");
    if (!devId) {
      devId = "DEV-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem("orbit_device_id", devId);
    }

    // 2. Ekran Çözünürlüğü & Cihaz Türü
    const sw = window.screen ? window.screen.width : 0;
    const sh = window.screen ? window.screen.height : 0;
    const screenRes = sw && sh ? `${sw}x${sh}px` : "";

    const ua = navigator.userAgent || "";
    let devType = "Bilgisayar";
    if (/iPhone|iPad|iPod/i.test(ua)) devType = `📱 iPhone (${screenRes})`;
    else if (/Android/i.test(ua)) devType = `🤖 Android (${screenRes})`;
    else devType = `💻 Masaüstü (${screenRes})`;

    const timeStr = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    // 3. Detaylı İlçe, Şehir ve İnternet Servis Sağlayıcısı (ISP / Şirket Ağı)
    let locationStr = "Bilinmiyor";
    let ispStr = "";
    try {
      const fetchGeo = fetch("https://ipwho.is/").then(res => res.json());
      const timeout = new Promise((_, reject) => setTimeout(() => reject("timeout"), 2200));
      const geo = await Promise.race([fetchGeo, timeout]);

      if (geo && geo.success) {
        const parts = [];
        if (geo.district) parts.push(geo.district);
        if (geo.city) parts.push(geo.city);
        if (geo.country) parts.push(geo.country);
        locationStr = parts.join(" / ");

        if (geo.connection && geo.connection.isp) {
          ispStr = geo.connection.isp;
        } else if (geo.connection && geo.connection.org) {
          ispStr = geo.connection.org;
        }
      }
    } catch (e) {
      try {
        const fallbackRes = await fetch("https://ipapi.co/json/").then(r => r.json());
        if (fallbackRes && fallbackRes.city) {
          locationStr = `${fallbackRes.city}, ${fallbackRes.country_name || "TR"}`;
          if (fallbackRes.org) ispStr = fallbackRes.org;
        }
      } catch (err) {}
    }

    // 4. Zenginleştirilmiş Bildirim Gönder
    const title = encodeURIComponent("🚀 Orbit Eats'e Yeni Ziyaretçi Girdi!");
    let bodyText = `📱 Cihaz: ${devType}\n🆔 Cihaz ID: ${devId}\n📍 Konum: ${locationStr}`;
    if (ispStr) bodyText += `\n🌐 Ağ/ISP: ${ispStr}`;
    bodyText += `\n🕒 Saat: ${timeStr}`;

    const msg = encodeURIComponent(bodyText);
    const publishUrl = `https://ntfy.sh/orbit-eats-baki-alert/publish?title=${title}&message=${msg}`;

    fetch(publishUrl, { method: "GET", mode: "no-cors" }).catch(() => {});
    const beacon = new Image();
    beacon.src = publishUrl;
  } catch (e) {}
}

/* ---------------- Mobile Release Note Pop-up Modal ---------------- */
function checkMobileReleaseNoteModal() {
  try {
    if (typeof window === "undefined") return;

    const isMobileDevice = window.innerWidth <= 600 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
    if (!isMobileDevice) return;

    if (sessionStorage.getItem("orbit_mobile_release_shown")) return;

    setTimeout(() => {
      if (sessionStorage.getItem("orbit_mobile_release_shown")) return;
      sessionStorage.setItem("orbit_mobile_release_shown", "true");

      const modal = document.createElement("div");
      modal.className = "tier-modal-overlay mobile-release-overlay";
      modal.innerHTML = `
        <div class="mobile-release-card bottom-sheet-panel open">
          <div class="scenario-picker-handle"></div>
          <div class="mrc-icon">📱✨</div>
          <p class="mrc-tag">RELEASE NOTE</p>
          <h3 class="mrc-title">Tam mobil uyumluluk sağlandı. :)</h3>
          <p class="mrc-sub">Orbit Eats artık mobil cihazında kusursuz ve tam ekran deneyim sunuyor.</p>
          <div class="mrc-actions">
            <button class="mrc-btn primary" id="mrcOkBtn">Tamam</button>
            <button class="mrc-btn secondary" id="mrcCloseBtn">Kapat</button>
          </div>
        </div>
      `;

      const shell = document.querySelector(".app-shell") || document.body;
      shell.appendChild(modal);

      requestAnimationFrame(() => {
        modal.style.display = "flex";
      });

      const closeModal = () => {
        const card = modal.querySelector(".mobile-release-card");
        if (card) card.classList.remove("open");
        modal.style.opacity = "0";
        setTimeout(() => modal.remove(), 300);
      };

      document.getElementById("mrcOkBtn").addEventListener("click", closeModal);
      document.getElementById("mrcCloseBtn").addEventListener("click", closeModal);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });
    }, 600);
  } catch (e) {}
}

notifyNewDeviceVisit();
checkMobileReleaseNoteModal();
bootstrap();