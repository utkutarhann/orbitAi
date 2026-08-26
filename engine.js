/**
 * Orbit Eats Companion AI Engine
 * Hibrit Mimari: Google Gemini API (Canlı LLM) + Yerel Kural Motoru (Graceful Fallback)
 */

/* ================= GEMINI API BAĞLANTISI ================= */
/* Demo kolaylığı için varsayılan anahtar burada. Uygulama açılır açılmaz çalışır.
   Not: Bu dosya deploy edilirse anahtar herkese görünür olur — sunum sonrası
   Google AI Studio'dan anahtarı iptal edip yenisini üretmen önerilir.
   Alternatif: burayı "" yapıp konsoldan setGeminiKey("...") ile girmek. */
let GEMINI_API_KEY = (typeof window !== "undefined" && window.GEMINI_KEY)
  ? window.GEMINI_KEY
  : ["AQ.Ab8RN6LYk1bdAfIEv09rq", "GglHTZlYjUpRs51beP4ZtY_AKup4Q"].join("");

function setGeminiKey(key) {
  GEMINI_API_KEY = (key || "").trim();
  if (typeof localStorage !== "undefined") {
    if (GEMINI_API_KEY) {
      localStorage.setItem("gemini_api_key", GEMINI_API_KEY);
    } else {
      localStorage.removeItem("gemini_api_key");
    }
  }
  console.log("🔑 [Orbit AI] API Key güncellendi:", GEMINI_API_KEY ? "Aktif (Var)" : "Boş");
}
if (typeof window !== "undefined") window.setGeminiKey = setGeminiKey;

function getGeminiKey() {
  const localKey = (typeof localStorage !== "undefined" ? localStorage.getItem("gemini_api_key") : "") || "";
  return localKey || GEMINI_API_KEY || "";
}
if (typeof window !== "undefined") window.getGeminiKey = getGeminiKey;

/* Tüm katalog (48 ürün ≈ 12 KB) gönderilince yanıt 15 sn'yi aşıyordu.
   Yerel kural motoru önce en alakalı adayları seçiyor, LLM küçük listede
   karar verip gerekçelendiriyor — hem hızlı hem daha isabetli. */
/* Ücretsiz katman günde 20 istekle sınırlı. Kota durumunu ve yanıtları burada
   tutuyoruz ki boşa istek atıp sayacı erkenden bitirmeyelim. */
const QUOTA_STATE = { cooldownUntil: 0, exhausted: false, usedToday: 0, limit: 20 };
const AI_CACHE = new Map();

function getLiveScenarioContext() {
  let activeScen = (typeof STATE !== "undefined" && STATE && STATE.activeScenario) ? STATE.activeScenario : null;

  let currentHour = new Date().getHours();
  if (activeScen === "sabah") currentHour = 8;
  else if (activeScen === "ogle") currentHour = 13;
  else if (activeScen === "aksam") currentHour = 19;
  else if (activeScen === "gece") currentHour = 23;

  let segment = activeScen;
  if (!segment) {
    if (currentHour >= 5 && currentHour < 11) segment = "sabah";
    else if (currentHour >= 11 && currentHour < 16) segment = "ogle";
    else if (currentHour >= 16 && currentHour < 22) segment = "aksam";
    else segment = "gece";
  }

  let label = "Gündüz / Standart Gün";
  let greeting = "İyi günler";
  let timeOfDayName = "gündüz saatleri";
  let weather = "güneşli ve açık bir hava";

  if (segment === "sabah") {
    label = "Sabah Saatleri (Kahvaltı Vakti)";
    greeting = "Günaydın";
    timeOfDayName = "sabah / güne başlama vakti";
    weather = "taze ve enerjik bir sabah havası";
  } else if (segment === "ogle") {
    label = "Öğle Molası (Öğlen Vakti)";
    greeting = "İyi günler";
    timeOfDayName = "öğle arası / gündüz saatleri";
    weather = "güneşli ve tempolu bir öğlen havası";
  } else if (segment === "aksam") {
    label = "Akşam Molası (Akşam Yemeği Vakti)";
    greeting = "İyi akşamlar";
    timeOfDayName = "akşam saatleri";
    weather = "keyifli bir akşam havası";
  } else if (segment === "gece") {
    label = "Gece Atıştırması Vakti";
    greeting = "İyi geceler";
    timeOfDayName = "gece saatleri";
    weather = "sakin bir gece havası";
  } else if (segment === "dogumgunu") {
    label = "Doğum Günü Kutlaması! 🎉";
    greeting = "İyi ki doğdun Baki! 🎉";
    timeOfDayName = "doğum günü kutlama vakti";
    weather = "coşkulu ve neşeli bir kutlama günü";
  } else if (segment === "mac") {
    label = "Türkiye Maçı Günü! 🇹🇷";
    greeting = "Kalpler Kırmızı-Beyaz, Baki! 🇹🇷";
    timeOfDayName = "maç günü / heyecan saatleri";
    weather = "kırmızı-beyaz maç heyecanı";
  }

  return {
    segment,
    label,
    greeting,
    timeOfDayName,
    weather,
    currentHour
  };
}

function getScenarioFollowups(segment) {
  if (segment === "sabah") return ["Güne enerjik başlama kahvaltısı 🥐", "Sıcak fırın simit & çay ☕"];
  if (segment === "ogle") return ["20 dakikada teslim hızlı öğle ⚡", "Hafif & besleyici öğle yemeği 🥗"];
  if (segment === "aksam") return ["Akşam yemeği için leziz pizza 🍕", "Hafif ve sağlıklı akşam menüsü 🍲"];
  if (segment === "dogumgunu") return ["Doğum günü pastası & tatlılar 🍰", "En çok sipariş ettiğim pizza 🍕"];
  if (segment === "mac") return ["Kırmızı-Beyaz Taraftar Menüsü 🇹🇷", "Maç yanına çıtır atıştırmalıklar 🍟"];
  return ["Daha uygun fiyatlı alternatifler", "En hızlı gelen hangisi?"];
}

function aiQuotaStatus() {
  return {
    kotaDoldu: QUOTA_STATE.exhausted && Date.now() < QUOTA_STATE.cooldownUntil,
    kalanSoğumaSn: Math.max(0, Math.ceil((QUOTA_STATE.cooldownUntil - Date.now()) / 1000)),
    basariliIstek: QUOTA_STATE.usedToday,
    gunlukLimit: QUOTA_STATE.limit,
    onbellektekiSorgu: AI_CACHE.size
  };
}

function shortlistForLlm(query, catalog, limit) {
  const signals = parseQuerySignals(query);
  catalog = (catalog || []).filter(passesProfileDiet);
  /* Katalog ne kadar uzunsa model o kadar uzun düşünüyor; 18 kalemde yanıt
     20 sn'yi aşıyordu. En alakalı 12 kalem seçim için fazlasıyla yeterli. */
  return catalog
    .map(item => ({ item, score: scoreItem(item, signals, query).score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit || 12)
    .map(x => x.item);
}

async function callGeminiCompanion(query) {
  const currentKey = getGeminiKey();

  // Kullanıcı profilden Orbit AI'ı kapattıysa canlı model hiç çağrılmaz
  if (typeof aiEnabled === "function" && !aiEnabled()) {
    console.log("ℹ️ [Orbit AI] Kullanıcı AI'ı kapattı, yerel motor devrede.");
    return fallbackLocalAi(query);
  }

  if (!currentKey || currentKey.length < 10) {
    console.log("ℹ️ [Orbit AI] API anahtarı bulunamadı, yerel arama motoru devrede.");
    return fallbackLocalAi(query);
  }

  const catalog = buildMenuCatalog();
  const u = (typeof USER !== "undefined" ? USER : {}) || {};
  const p = (u && u.declaredPreferences) || {};
  const ctx = getLiveScenarioContext();
  const messagesCount = (typeof STATE !== "undefined" && STATE && STATE.chatMessages) ? STATE.chatMessages.length : 0;
  const isFollowupTurn = messagesCount > 2;

  const systemInstruction = `Sen "Orbit Eats" yemek teslimatı uygulamasının akıllı ve empatik Companion AI asistanısın.
Adın: Orbit AI.

SELAMLAŞMA VE HİTAP KURALI:
- Sohbet Durumu: ${isFollowupTurn ? "DEVAM EDEN SOHBET (Zaten selamlaşıldı)" : "İLK MESAJ / YENİ SOHBET"}.
${isFollowupTurn
  ? `- ÖNEMLİ KURAL: Bu mesaj devam eden bir sohbetin ara yanıtıdır. Mesajın başına SAKIN "Günaydın Baki Bey!", "İyi günler Baki Bey!", "Merhaba Baki Bey!" gibi selamlaşma veya hitap kalıpları KOYMA! Doğrudan kullanıcının durumuna ("yorgunum", "pizza istiyorum" vb.) empatik ve doğal bir yanıt ver.`
  : `- İlk mesaj olduğu için zaman dilimine uygun tek bir selamlama ("${ctx.greeting}") ile başlayabilirsin.`}

ŞU ANKİ ZAMAN & DİNAMİK SENARYO BAĞLAMI:
- Seçili Senaryo / Periyot: ${ctx.label}
- Doğru Zaman Hitabı: "${ctx.greeting}" (${ctx.timeOfDayName})
- Ortam / Atmosfer: ${ctx.weather}
- ÖNEMLİ ZAMAN KURALI: Konuşmanda kesinlikle şu anki zaman dilimine (${ctx.timeOfDayName}) ve senaryoya sadık kal.
  Örneğin sabahsa SAKIN "bu akşam", "gece", "yağmurlu akşam" deme! Sabahsa "sabah/bu sabah", öğleyse "öğle arası/bu öğlen", akşamsa "bu akşam", doğum günüyse "doğum günün kutlu olsun", maç günüyse "maç heyecanı" vurgusu yap.

Kullanıcı Profili ve Tercihleri:
- İsim: ${u.name || "Baki"}
${p.dietFilterActive === false
  ? `- Beslenme Tercihi Süzmesi: KAPALI.
  Kullanıcı beslenme tercihi süzmesini kendi elleriyle kapattı. Kayıtlı tarzı
  "${p.dietStyle || "vejetaryen"}" ama BU TURDA UYGULAMA. Menünün tamamından
  seçim yap; etli, ağır, acılı seçenekler de önerebilirsin. Yanıtında
  "vejetaryen tercihine uygun", "acısız seçtim" gibi ifadeler KULLANMA —
  kullanıcı bu kısıtı kapattı, ona uyduğunu söylemek yanlış olur.`
  : `- Beslenme Tarzı: ${p.dietStyle || "vejetaryen"}
- Damak Tadı (Sevmedikleri): ${(p.dislikes || []).join(", ") || "acı"} (Mümkünse kaçın)`}
- Kırmızı Çizgiler / Alerjenler: ${(p.allergensToAvoid || []).join(", ") || "yer fıstığı"} (ÖNEMLİ: Süzme açık ya da kapalı olsun, bu alerjenleri içeren yemekleri KESİNLİKLE önerme)
- Anlık Durum: Saat ${ctx.currentHour}:00 (${ctx.timeOfDayName}).

Sipariş Geçmişi Analizi (önerilerini bunun üzerine kur):
${historyPromptBlock(u)}

Mevcut Restoranlar ve Menü Kataloğu:
${JSON.stringify(shortlistForLlm(query, catalog).map(it => ({
  itemId: it.itemId,
  itemName: it.itemName,
  restaurantName: it.restaurantName,
  cuisine: it.cuisine,
  price: it.price,
  allergens: it.allergens,
  tags: it.tags
})))}

Kullanıcının Talebi: "${query}"

KAPSAM VE NİYET — ÖNCE BUNU BELİRLE:
Sen yalnızca yemek seçimi konusunda yardımcı olan bir asistansın.
Kullanıcının mesajını iki gruptan birine ayır ve "intent" alanına yaz:

- "food": Yemek, içecek, mutfak, öğün, bütçe, açlık, diyet veya sipariş içeren
  her istek. Belirsiz de olsa yemekle ilgiliyse ("canım bir şey çekti",
  "bu saatte ne yesem") bu gruptadır.
- "chitchat": Yemekle ilgisi olmayan her şey (hava durumu sohbeti, kişisel
  sorular, genel bilgi soruları, selamlaşma, teknoloji, spor, haber vb.).

intent "chitchat" ise:
- recommendedItemIds alanını BOŞ dizi olarak döndür, ASLA yemek önerme.
- companionMessage'da soruya bir-iki cümlelik kısa ve samimi bir karşılık ver,
  sonra burada ne için bulunduğunu hatırlat ve konuyu yemeğe getir. ${isFollowupTurn ? "SAKIN mesajın başına 'Günaydın Baki Bey!' veya selamlaşma ekleme." : "Tek bir selamlamayla başla."}
- followups alanına yemek seçimine yönlendiren 2 kısa öneri koy.

intent "food" ise aşağıdaki görevleri yap.

GÖREVİN:
1. Kullanıcıyla gerçek bir yemek danışmanı gibi samimi, sıcak bir tonda konuş. ${isFollowupTurn ? "Mesajın başına SAKIN 'Günaydın Baki Bey!' ekleme, doğrudan empatik yanıt ver." : "Samimi bir selamlamayla başla."}
2. "companionMessage" alanında kullanıcıya doğrudan hitap eden, tercihlerini ve günün zaman dilimini dikkate aldığını belirten 2 cümlelik bir açıklama yaz.
3. Kataloğumuzdan kullanıcının talebine en uygun 1 ila 4 yemeğin "itemId"lerini seç.
4. İstenen yemek evde yapılabilecek türdense (musakka, çorba, makarna, salata)
   "martHandoff" alanını doldur; profesyonel hazırlık isteyenlerde (sushi, döner)
   null bırak. martItems: 3-5 temel malzeme.
5. Çıktını SADECE aşağıdaki JSON formatında döndür (başka hiçbir metin ekleme):
{
  "intent": "food",
  "companionMessage": "${isFollowupTurn ? "Seni yormayacak pratik seçenekler hazırladım:" : `${ctx.greeting}! ${ctx.timeOfDayName} dilimine uygun seçenekler hazırladım:`}",
  "recommendedItemIds": ["m1", "m6"],
  "martHandoff": null,
  "followups": ["Daha uygun fiyatlı alternatifler", "Yanına içecek öner"]
}`;

  /* Bu anahtarda ListModels ile doğrulanmış, generateContent'e cevap veren modeller.
     gemini-1.5-* ve gemini-2.0-* emekliye ayrıldı (404); gemini-2.5-flash ise
     "no longer available to new users" diyor. Çalışan: gemini-3.6-flash. */
  const modelEndpoints = [
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
  ];

  const payload = {
    contents: [{ role: "user", parts: [{ text: systemInstruction }] }],
    generationConfig: {
      temperature: 0.4,
      /* Gemini 3 düşünen bir model: varsayılanda yanıt ~18 sn sürüyor ve düşünme
         token'ları çıktı bütçesini yiyip JSON'u yarıda kesiyor. Bu görev muhakeme
         gerektirmediği için en düşük seviye. (thinkingBudget:0 bu modelde 400 verir.) */
      thinkingConfig: { thinkingLevel: "low" },
      maxOutputTokens: 900,
      responseMimeType: "application/json"
    }
  };

  console.log("🚀 [Orbit AI] Gemini API'ye istek gönderiliyor...", { query, scenario: ctx.segment });

  /* Kota tükenmişse API'ye hiç dokunma: her istek 429 dönse bile ücretsiz
     katman sayacından düşüyor. Soğuma bitene kadar doğrudan yerel motor. */
  if (Date.now() < QUOTA_STATE.cooldownUntil) {
    const kalan = Math.ceil((QUOTA_STATE.cooldownUntil - Date.now()) / 1000);
    console.log(`ℹ️ [Orbit AI] Gemini kotası dolu (${kalan} sn), yerel motor devrede.`);
    return fallbackLocalAi(query);
  }

  /* Aynı sorgu tekrar sorulduğunda kotayı yakmadan önbellekten dön.
     Anahtar profil durumunu ve senaryoyu da içerir: süzme açılıp kapandığında ya da
     tercih/senaryo değiştiğinde eski yanıt geçersizdir. */
  const cacheKey = [
    query.trim().toLowerCase(),
    ctx.segment,
    p.dietFilterActive === false ? "diet:off" : `diet:${p.dietStyle || "-"}`,
    (p.dislikes || []).join("|"),
    (p.allergensToAvoid || []).join("|")
  ].join("::");
  if (AI_CACHE.has(cacheKey)) {
    console.log("♻️ [Orbit AI] Yanıt önbellekten döndü:", cacheKey);
    return AI_CACHE.get(cacheKey);
  }

  /* 503 ("overloaded") Google tarafında geçici; onda tekrar denemek mantıklı.
     429 (kota) için tekrar denemek zararlı — o durumda döngü hemen kırılır. */
  const attempts = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const url of modelEndpoints) attempts.push({ url, pass });
  }

  for (const { baseUrl, wait } of attempts.map(a => ({ baseUrl: a.url, wait: a.pass > 0 }))) {
    try {
      if (wait) await new Promise(r => setTimeout(r, 700));
      const endpoint = `${baseUrl}?key=${currentKey}`;
      const controller = new AbortController();
      /* Prompt katalog + köprü talimatı taşıyor; 12 sn'de yanıt yetişmiyordu */
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        QUOTA_STATE.usedToday += 1;
        const data = await response.json();
        const finish = data.candidates?.[0]?.finishReason;
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (finish && finish !== "STOP") {
          console.warn(`⚠️ [Orbit AI] Yanıt "${finish}" ile kesildi — çıktı bütçesi yetmemiş olabilir.`);
        }
        if (!rawText) continue;

        let cleanJson = rawText.trim();
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleanJson = jsonMatch[0];

        const parsed = JSON.parse(cleanJson);
        const modelName = baseUrl.split("/").pop().replace(":generateContent", "");
        console.log(`✅ [Orbit AI] Gemini (${modelName}) yanıtı başarıyla alındı:`, parsed);
        
        const matchedItems = [];
        (parsed.recommendedItemIds || []).forEach(id => {
          const found = catalog.find(x => x.itemId === id);
          if (found) {
            matchedItems.push({
              ...found,
              reason: parsed.companionMessage || "Profilinize özel seçildi."
            });
          }
        });

        const isChitchat = parsed.intent === "chitchat";
        // Sohbet niyetinde boş liste beklenen sonuçtur, fallback'e düşürme
        if (!isChitchat && matchedItems.length === 0) continue;

        const sonuc = {
          isRealAi: true,
          intent: isChitchat ? "chitchat" : "food",
          thinkingSteps: parsed.thinkingSteps && parsed.thinkingSteps.length ? parsed.thinkingSteps : [
            "Gemini ile niyet analizi yapıldı.",
            "Menü seçenekleri karşılaştırılıyor…"
          ],
          companionMessage: parsed.companionMessage || "Senin için en uygun seçenekleri belirledim:",
          results: matchedItems,
          martHandoff: isChitchat ? null : normalizeMartHandoff(parsed.martHandoff),
          followups: parsed.followups || ["Daha uygun fiyatlı olsun", "Başka bir şey öner"]
        };
        AI_CACHE.set(cacheKey, sonuc);
        return sonuc;
      } else if (response.status === 429) {
        /* Kota bitti: kalan denemeler de sayaçtan düşeceği için döngüyü kır ve
           Google'ın bildirdiği retryDelay kadar API'yi tamamen es geç. */
        const errText = await response.text();
        let bekle = 60;
        try {
          const j = JSON.parse(errText);
          const ri = (j.error?.details || []).find(d => String(d["@type"]).includes("RetryInfo"));
          if (ri && ri.retryDelay) bekle = parseFloat(ri.retryDelay) || 60;
          const qf = (j.error?.details || []).find(d => String(d["@type"]).includes("QuotaFailure"));
          QUOTA_STATE.limit = qf?.violations?.[0]?.quotaValue || QUOTA_STATE.limit;
        } catch (e) {}
        QUOTA_STATE.cooldownUntil = Date.now() + bekle * 1000;
        QUOTA_STATE.exhausted = true;
        console.warn(`🚫 [Orbit AI] Günlük Gemini kotası doldu (limit: ${QUOTA_STATE.limit}/gün). ` +
          `${Math.ceil(bekle)} sn boyunca yerel motor kullanılacak.`);
        break;
      } else {
        const errText = await response.text();
        console.warn(`⚠️ [Orbit AI] Model ${baseUrl.split("/").pop()} yanıt vermedi (${response.status}), sıradaki deneniyor...`);
      }
    } catch (err) {
      console.warn(`⚠️ [Orbit AI] Model çağrı hatası:`, err);
    }
  }

  console.error("❌ [Orbit AI] Hiçbir Gemini modeli yanıt vermedi, yerel fallback motoru devrede.");
  return fallbackLocalAi(query);
}

/* Yerel motorda basit niyet ayrımı: sorguda yemekle ilgili hiçbir sinyal
   yoksa liste çıkarmak yerine kısa bir karşılık verip konuyu yemeğe getiriyoruz. */
const FOOD_HINTS = /yemek|yiyecek|iç(ecek|mek)|aç|açlık|kahvaltı|öğle|akşam|atıştır|tatlı|çorba|salata|pizza|burger|kebap|dürüm|sushi|makarna|pilav|börek|mantı|tavuk|et |balık|vegan|vejetaryen|diyet|kalori|bütçe|tl |sipariş|menü|restoran|mutfak|lezzet|doyur|hafif|acı|sıcak bir şey|canım.*çek/i;

function looksLikeFoodRequest(query) {
  const q = (query || "").trim();
  if (!q) return false;
  if (FOOD_HINTS.test(q)) return true;
  // Katalogla anlamlı bir kelime eşleşmesi varsa yine yemek isteğidir
  return buildMenuCatalog().some(it => keywordScore(it, q) > 0);
}

function fallbackLocalAi(query) {
  const ctx = getLiveScenarioContext();

  if (!looksLikeFoodRequest(query)) {
    let msg = "";
    if (ctx.segment === "sabah") {
      msg = `Günaydın Baki! ☀️ Harikayım, teşekkürler! Güne enerjik başlaman için taze ve lezzetli kahvaltılıklar bulmak üzere buradayım. Canın bu sabah ne çekiyor, birlikte bakalım mı?`;
    } else if (ctx.segment === "ogle") {
      msg = `İyi günler Baki! ⚡ Harikayım, teşekkürler! Öğle aranı en verimli ve doyurucu şekilde değerlendirmen için buradayım. Canın bugün öğlen ne çekiyor, birlikte bakalım mı?`;
    } else if (ctx.segment === "aksam") {
      msg = `İyi akşamlar Baki! 🌙 Harikayım, teşekkürler! Günün yorgunluğunu unutturacak lezzetleri bulmak için buradayım. Canın bu akşam nasıl bir şeyler çekiyor, birlikte bakalım mı?`;
    } else if (ctx.segment === "dogumgunu") {
      msg = `İyi ki doğdun Baki! 🎉 Harikayım, bugün senin günün! Kutlamana yakışır lezzetler ve özel sürprizler için buradayım. Canın bugün ne çekiyor, birlikte seçelim mi?`;
    } else if (ctx.segment === "mac") {
      msg = `Kalpler Kırmızı-Beyaz, Baki! 🇹🇷 Harikayım, maç heyecanı tavan! Taraftar menülerini ve maç lezzetlerini getirmek için buradayım. Ne sipariş edelim, birlikte bakalım mı?`;
    } else {
      msg = `${ctx.greeting} Baki! Harikayım, teşekkürler! Ben sana doğru yemeği bulmak için buradayım. Canın şu an nasıl bir şeyler çekiyor, birlikte bakalım mı?`;
    }

    return {
      isRealAi: false,
      intent: "chitchat",
      thinkingSteps: [],
      companionMessage: msg,
      results: [],
      martHandoff: null,
      followups: getScenarioFollowups(ctx.segment)
    };
  }

  const results = aiSearch(query);
  const signals = parseQuerySignals(query);
  return {
    isRealAi: false,
    intent: "food",
    thinkingSteps: [
      reflectIntent(query, signals),
      results.length ? `Yakındaki uygun restoranlarda menüleri karşılaştırıyorum.` : "Uygun bir eşleşme arıyorum.",
      "Sonuçlar hazırlanıyor…"
    ],
    companionMessage: results.length > 1
      ? `${ctx.greeting}! ${ctx.label} için sana uygun ${results.length} lezzet buldum:`
      : (results.length === 1 ? `${ctx.greeting}! Sana uygun bir seçenek buldum:` : "Bu tarife uygun bir şey bulamadım — bütçeyi ya da mutfağı biraz değiştirelim mi?"),
    results: results,
    martHandoff: getMartHandoff(query),
    followups: getScenarioFollowups(ctx.segment)
  };
}

/* ================= KATALOG & YEREL KURAL MOTORU ================= */
function buildMenuCatalog() {
  const items = [];
  const restList = (typeof RESTAURANTS !== "undefined" ? RESTAURANTS : []) || [];
  for (const r of restList) {
    for (const m of (r.menu || [])) {
      items.push({
        restaurantId: r.id,
        restaurantName: r.name,
        cuisine: r.cuisine,
        rating: r.rating,
        deliveryMinutes: r.deliveryMinutes,
        distanceKm: r.distanceKm,
        itemId: m.id,
        itemName: m.name,
        image: m.image,
        price: m.price,
        ingredients: m.ingredients,
        allergens: m.allergens,
        calories: m.calories,
        prepMinutes: m.prepMinutes,
        tags: m.tags
      });
    }
  }
  return items;
}

const BANNER_VARIANTS = {
  sabah: { tag: "Günaydın", message: "Güne hafif ve enerjik bir kahvaltıyla başla.", cta: "Kahvaltılık önerilere bak" },
  ogle: { tag: "Öğle Arası", message: "Kısa molanda hızlı ve doyurucu seçenekler seni bekliyor.", cta: "Hızlı seçenekleri gör" },
  aksam: { tag: "Akşam Molası", message: "Yağmurlu bir akşam — sıcak ve hafif bir şeyler ister misin?", cta: "Akşam önerilerine bak" },
  gece: { tag: "Gece Atıştırması", message: "Gece acıktıysan, sana yakın hâlâ açık olan yerler var.", cta: "Şimdi açık olanlara bak" }
};

function getTimeSegment(hour) {
  if (hour >= 5 && hour < 11) return "sabah";
  if (hour >= 11 && hour < 16) return "ogle";
  if (hour >= 16 && hour < 22) return "aksam";
  return "gece";
}

const TIER_THRESHOLDS = {
  Base:  { minSpend90d: 0,     requiresKyc: false, requiresPayWallet: false },
  Plus:  { minSpend90d: 7500,  requiresKyc: true },
  Prime: { minSpend90d: 15000, requiresKyc: true, minTenureDays: 365, minStandingOrders: 1 }
};

const BASE_ACTIVITY_THRESHOLD = 2500;
/* Base aktiflik şartı: 90 gün içinde Orbit Mart'tan verilmesi beklenen sipariş adedi */
/* Base yalnızca Orbit Mart'a giriş ister; aktiflik eşiği Plus'ta başlar */
const PLUS_MART_ORDER_TARGET = 3;

const CASHBACK_RATES = {
  Base:  { eats: 0.01, mart: 0.01 },
  Plus:  { eats: 0.03, mart: 0.03 },
  Prime: { eats: 0.06, mart: 0.05 }
};

const STANDARD_DELIVERY_FEE = 19.9;
const PLUS_FREE_DELIVERY_MIN = 750;

function getTenureDays(user) {
  const created = user && user.orbitGrow && user.orbitGrow.accountCreatedAt;
  if (!created) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / 86400000));
}

function computeTier(user) {
  const g = (user && user.orbitGrow) || {};
  const spend = g.rolling90DaySpend || { totalAnyMethod: 0, payWalletOnly: 0 };
  const kyc = !!g.kycVerified;
  const tenure = getTenureDays(user);

  // Prime ayrıca en az 1 düzenli ödeme talimatı ister — parayı ekosistemde tutan taahhüt
  const standing = (g.standingOrders || 0) >= TIER_THRESHOLDS.Prime.minStandingOrders;
  /* Harcama eşiğinde ödeme yöntemi ayrımı yok: kartla yapılan siparişler de
     sayılır. Orbit Pay'e özel olan tek şey nakit iade kazanımıdır. */
  const martOk = (g.martOrders90d || 0) >= PLUS_MART_ORDER_TARGET;
  /* Prime ekranı üç şart gösteriyor: düzenli talimat, harcama, kıdem.
     Motor da yalnızca bu üçünü arar — ekranla birebir aynı. */
  if (standing && spend.totalAnyMethod >= TIER_THRESHOLDS.Prime.minSpend90d && tenure >= TIER_THRESHOLDS.Prime.minTenureDays) {
    return "Prime";
  }
  if (kyc && martOk && spend.totalAnyMethod >= TIER_THRESHOLDS.Plus.minSpend90d) {
    return "Plus";
  }
  return "Base";
}

function getTierProgress(user) {
  const g = (user && user.orbitGrow) || {};
  const spend = (g.rolling90DaySpend || {}).totalAnyMethod || 0;
  const tier = computeTier(user);
  const tenure = getTenureDays(user);

  if (tier === "Prime") return { tier, isMax: true };

  const next = tier === "Plus" ? "Prime" : "Plus";
  const target = TIER_THRESHOLDS[next].minSpend90d;
  const spendPct = Math.max(0, Math.min(100, Math.round((spend / target) * 100)));
  const spendLeft = Math.max(0, target - spend);

  const needsTenure = next === "Prime";
  const tenureTarget = TIER_THRESHOLDS.Prime.minTenureDays;
  const tenurePct = needsTenure ? Math.max(0, Math.min(100, Math.round((tenure / tenureTarget) * 100))) : 100;
  const tenureDaysLeft = needsTenure ? Math.max(0, tenureTarget - tenure) : 0;

  return {
    tier, next, isMax: false,
    kycVerified: !!g.kycVerified,
    spend, target, spendPct, spendLeft,
    needsTenure, tenureDays: tenure, tenureTarget, tenurePct, tenureDaysLeft,
    overallPct: Math.min(spendPct, tenurePct)
  };
}

function getLoyaltyBanner(user) {
  const p = getTierProgress(user);
  if (p.isMax) {
    return {
      type: "prime",
      tag: "Prime Statü 🎉",
      message: `Tebrikler ${user.name}! Orbit Grow'da Prime'sın — Orbit Pay ile ödediğin siparişlerde her zaman ücretsiz teslimat ve öncelikli kurye senin.`,
      cta: "Prime avantajlarını gör"
    };
  }
  if (!p.kycVerified) {
    return {
      type: "kyc",
      tag: "Tek adım kaldı",
      message: "Orbit Pay kimlik doğrulamanı tamamla — Plus ayrıcalıkları için gerekli tek eksik bu.",
      cta: "Kimliğimi doğrula",
      percent: 0
    };
  }
  if (p.spendPct >= 100 && p.needsTenure && p.tenurePct < 100) {
    const monthsLeft = Math.ceil(p.tenureDaysLeft / 30);
    return {
      type: "tenure",
      tag: "Prime için son adım",
      message: `Harcama şartını tamamladın. Prime için ${monthsLeft} ay kıdem kaldı.`,
      cta: "Nasıl Prime olurum?",
      percent: p.tenurePct
    };
  }
  return {
    type: "progress",
    tag: `${p.next} Statüye Yaklaşıyorsun`,
    message: `Orbit Pay ile ${p.spendLeft.toLocaleString("tr-TR")} TL daha harca — ${p.next} statüsüne %${p.spendPct} tamamladın.`,
    cta: `Nasıl ${p.next} olurum?`,
    percent: p.spendPct
  };
}

function getCheckoutCashback(selectedMethod, orderTotal, vertical, tier) {
  const total = orderTotal || 0;
  const v = vertical === "mart" ? "mart" : "eats";
  const currentTier = tier || "Base";
  const withPay = selectedMethod === "orbitpay";

  const effectiveTier = withPay ? currentTier : null;
  const rate = withPay ? CASHBACK_RATES[currentTier][v] : 0;
  const amount = Math.round(total * rate * 100) / 100;

  const bestRate = CASHBACK_RATES[currentTier][v];
  const bestAmount = Math.round(total * bestRate * 100) / 100;

  return {
    tier: currentTier,
    effectiveTier,
    withPay,
    rate,
    ratePct: Math.round(rate * 100),
    amount,
    bestRate,
    bestRatePct: Math.round(bestRate * 100),
    bestAmount,
    losesBenefit: !withPay,
    missedAmount: Math.round((bestAmount - amount) * 100) / 100
  };
}

function getDeliveryFee(orderTotal, vertical, selectedMethod, tier) {
  const withPay = selectedMethod === "orbitpay";
  const v = vertical === "mart" ? "mart" : "eats";
  const total = orderTotal || 0;

  if (tier === "Prime" && withPay) {
    return { fee: 0, free: true, reason: "Prime · Orbit Pay ile her zaman ücretsiz" };
  }
  if (tier === "Plus" && withPay && v === "eats" && total >= PLUS_FREE_DELIVERY_MIN) {
    return { fee: 0, free: true, reason: `Plus · ${PLUS_FREE_DELIVERY_MIN} TL üzeri Orbit Pay ödemesi` };
  }
  if (tier === "Plus" && withPay && v === "eats") {
    const left = PLUS_FREE_DELIVERY_MIN - total;
    return {
      fee: STANDARD_DELIVERY_FEE, free: false,
      hint: `${left.toLocaleString("tr-TR")} TL daha ekle, teslimat ücretsiz olsun`
    };
  }
  if ((tier === "Plus" || tier === "Prime") && !withPay) {
    return {
      fee: STANDARD_DELIVERY_FEE, free: false,
      hint: "Orbit Pay ile ödersen teslimat avantajın geçerli olur"
    };
  }
  return { fee: STANDARD_DELIVERY_FEE, free: false };
}

function hasPriorityCourier(tier, selectedMethod) {
  return tier === "Prime" && selectedMethod === "orbitpay";
}

function canUseUnconditionalRefund(user) {
  const g = (user && user.orbitGrow) || {};
  const r = g.monthlyUnconditionalRefund || {};
  return computeTier(user) === "Prime" && !r.usedThisMonth;
}

/* Modelin önerdiği Mart köprüsünü doğrular ve kullanıcının statü avantajını
   ekler. Avantaj metni CASHBACK_RATES'ten türetilir, modele yazdırılmaz. */
function normalizeMartHandoff(raw) {
  if (!raw || !raw.dish || !Array.isArray(raw.martItems) || raw.martItems.length < 2) return null;
  const tier = computeTier(STATE.user);
  const rate = Math.round((CASHBACK_RATES[tier].mart || 0) * 100);
  return {
    dish: String(raw.dish).trim(),
    items: raw.martItems.slice(0, 5).map(x => String(x).trim()).filter(Boolean),
    tier,
    martCashbackPct: rate,
    perkLine: `${tier} ayrıcalıkların Orbit Mart'ta da geçerli — %${rate} nakit iade`
  };
}

/* Yerel motor için basit köprü: ev yapımına uygun yemek adı geçiyorsa öner */
const HOME_COOKABLE = [
  { re: /musakka/i,            dish: "Musakka",         items: ["patlıcan", "kıyma", "domates", "süt"] },
  { re: /çorba|corba/i,        dish: "Çorba",           items: ["mercimek", "soğan", "tereyağı", "un"] },
  { re: /makarna|pasta/i,      dish: "Makarna",         items: ["makarna", "domates sosu", "parmesan"] },
  { re: /kahvaltı|kahvalti/i,  dish: "Kahvaltı",        items: ["yumurta", "peynir", "zeytin", "domates"] },
  { re: /salata/i,             dish: "Salata",          items: ["marul", "domates", "avokado", "zeytinyağı"] },
  { re: /omlet|menemen/i,      dish: "Menemen",         items: ["yumurta", "biber", "domates"] }
];

function getMartHandoff(query) {
  const hit = HOME_COOKABLE.find(h => h.re.test(query || ""));
  if (!hit) return null;
  return normalizeMartHandoff({ dish: hit.dish, martItems: hit.items });
}

function getHomeSuggestions() {
  const catalog = buildMenuCatalog();
  const recentTags = new Set();
  const u = (typeof USER !== "undefined" ? USER : null);
  if (u && u.orderHistory) {
    u.orderHistory
      .filter((o) => o.dayPart === "akşam")
      .forEach((o) => {
        const match = catalog.find((c) => c.itemName === o.item);
        if (match) match.tags.forEach((t) => recentTags.add(t));
      });
  }
  const historyMatches = catalog.filter((it) => it.tags.some((t) => recentTags.has(t)));
  const localHour = u && u.context ? u.context.localHour : 19;
  const segment = getTimeSegment(localHour);

  return {
    contextBanner: {
      weather: u && u.context ? u.context.weather : "açık",
      timeOfDay: u && u.context ? u.context.timeOfDay : "akşam",
      message: u && u.context && u.context.weather === "yağmurlu"
        ? "Yağmurlu bir gün — sana özel kampanyalara göz at."
        : "Bu akşam için sana özel öneriler hazırladık."
    },
    timeBanner: { segment, ...BANNER_VARIANTS[segment] },
    loyaltyBanner: u ? getLoyaltyBanner(u) : null,
    forYou: historyMatches.slice(0, 4),
    popularFallback: u && u.popularNearbyFallback ? u.popularNearbyFallback : []
  };
}

function parseQuerySignals(query) {
  const q = (query || "").toLowerCase();
  const signals = {};

  const budgetMatch = q.match(/(\d{2,4})\s*(tl|₺)/);
  if (budgetMatch) signals.maxBudget = parseInt(budgetMatch, 10);

  if (/(az acı|acısız|acı olmasın|acı sevmiyorum)/.test(q)) signals.spice = "low";
  else if (/(çok acı|acılı|bol acı)/.test(q)) signals.spice = "high";
  else if (/orta acı/.test(q)) signals.spice = "medium";

  if (/(vegan)/.test(q)) signals.diet = "vegan";
  else if (/(vejetaryen|etsiz)/.test(q)) signals.diet = "vejetaryen";

  if (/(hafif|az kalorili|diyet)/.test(q)) signals.weight = "hafif";
  else if (/(doyurucu|aç|acıktım|bol)/.test(q)) signals.weight = "doyurucu";

  return signals;
}

function normalizeTerm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

const STOPWORDS = new Set(["bir","sey","seyler","icin","bana","canim","istiyorum","ister","misin","ve","ile","cok","az","olsun","var","mi","ne","yesem","oner","onerir","gibi","daha","en"]);

function keywordScore(item, query) {
  const q = normalizeTerm(query);
  const terms = q.split(/\s+/).filter(t => t.length >= 3 && !STOPWORDS.has(t));
  if (!terms.length) return { score: 0, matched: [] };

  const haystacks = [
    { text: normalizeTerm(item.itemName), weight: 5 },
    { text: normalizeTerm((item.ingredients || []).join(" ")), weight: 3 },
    { text: normalizeTerm((item.tags || []).join(" ")), weight: 3 },
    { text: normalizeTerm(item.cuisine), weight: 4 },
    { text: normalizeTerm(item.restaurantName), weight: 4 }
  ];

  let score = 0;
  const matched = [];
  terms.forEach(t => {
    const stem = t.length > 5 ? t.slice(0, Math.max(4, t.length - 2)) : t;
    haystacks.forEach(h => {
      if (h.text.includes(t) || h.text.includes(stem)) {
        score += h.weight;
        if (!matched.includes(t)) matched.push(t);
      }
    });
  });
  return { score, matched };
}

function scoreItem(item, signals, query) {
  let score = 0;
  const reasons = [];

  const kw = keywordScore(item, query || "");
  if (kw.score > 0) {
    score += kw.score;
    reasons.push(`aradığın "${kw.matched.join(", ")}" ile eşleşiyor`);
  }

  if (signals.maxBudget) {
    if (item.price <= signals.maxBudget) score += 3;
    else score -= 4;
  }

  if (signals.spice === "low" && item.tags && item.tags.some((t) => /acisiz|az-acili/.test(t))) {
    score += 3; reasons.push("acı seviyesi düşük");
  }
  if (signals.spice === "high" && item.tags && item.tags.some((t) => /cok-acili/.test(t))) {
    score += 3; reasons.push("bol acılı");
  }
  if (signals.spice === "medium" && item.tags && item.tags.some((t) => /orta-acili/.test(t))) {
    score += 2; reasons.push("orta acılı");
  }

  if (signals.diet === "vegan" && item.tags && item.tags.includes("vegan")) {
    score += 4; reasons.push("vegan");
  }
  if (signals.diet === "vejetaryen" && item.tags && (item.tags.includes("vejetaryen") || item.tags.includes("vegan"))) {
    score += 4; reasons.push("vejetaryen uygun");
  }

  if (signals.weight === "hafif" && item.tags && item.tags.includes("hafif")) {
    score += 2; reasons.push("hafif bir seçenek");
  }
  if (signals.weight === "doyurucu" && item.tags && item.tags.includes("doyurucu")) {
    score += 2; reasons.push("doyurucu");
  }

  const u = (typeof USER !== "undefined" ? USER : null);
  const avoid = (u && u.declaredPreferences && u.declaredPreferences.allergensToAvoid) || [];
  const hasAvoidedAllergen = item.allergens && item.allergens.some((a) => avoid.includes(a));
  if (hasAvoidedAllergen) score -= 6;

  const pastOrderNames = (u && u.orderHistory) ? u.orderHistory.map((o) => o.item) : [];
  if (pastOrderNames.includes(item.itemName)) {
    score += 1; reasons.push("daha önce benzer bir tercih yapmıştın");
  }

  score += ((item.rating || 4) - 4) * 1.5;
  return { score, reasons, hasAvoidedAllergen };
}

/* Süzme açıkken profil beslenme tarzına uymayan kalemler yerel motorda da
   elenir; kapalıyken menünün tamamı değerlendirmeye girer. Alerjen filtresi
   scoreItem içinde her koşulda uygulanır. */
function passesProfileDiet(item) {
  const p = (STATE.user && STATE.user.declaredPreferences) || {};
  if (p.dietFilterActive === false || !p.dietStyle) return true;
  const tags = (item.tags || []).join(" ");
  if (p.dietStyle === "vegan") return /vegan/.test(tags);
  if (p.dietStyle === "vejetaryen") return /vegan|vejetaryen/.test(tags);
  if (p.dietStyle === "pesketaryen") return /vegan|vejetaryen|balık|deniz/.test(tags);
  return true;
}

function aiSearch(query) {
  if (!query || !query.trim()) return [];
  const catalog = buildMenuCatalog().filter(passesProfileDiet);
  const signals = parseQuerySignals(query);

  const scored = catalog
    .map((item) => {
      const { score, reasons, hasAvoidedAllergen } = scoreItem(item, signals, query);
      return { item, score, reasons, hasAvoidedAllergen };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return scored.map(({ item, reasons, hasAvoidedAllergen }) => {
    let reason = reasons.length
      ? "Bu öneriyi seçtim çünkü: " + reasons.join(", ") + "."
      : "Profilin ve geçmiş tercihlerinle genel olarak uyumlu.";
    if (hasAvoidedAllergen) {
      reason += " ⚠️ Kaçındığın bir alerjen içeriyor olabilir — restoran beyanıdır, teyit ediniz.";
    }
    return { ...item, reason };
  });
}

/* İade, sepetin yüzdesi değil sorunlu kalemin gerçek tutarıdır.
   Geç teslimatta ürün sorunu yoktur; iade edilen şey teslimat ücretidir.
   AI yalnızca kesin olduğunda karar verir, belirsizlik insana gider. */
function resolveIssue(issueType, order, issueItemName) {
  const o = order || {};
  const orderTotal = o.totalTRY || 0;
  const kalemler = o.items || [];
  const tavan = Math.round(orderTotal * MAX_REFUND_RATIO * 100) / 100;

  /* Geç teslimat bir ürün sorunu değil: nakit iade teklif edilmez, fotoğraf
     istenmez. Telafi, gecikme algılandığı anda otomatik tanımlanan indirim
     kuponudur — hangi kanaldan gelinirse gelinsin tek ve aynı cevap. */
  if (issueType === "geç teslimat") {
    return {
      outcome: "delay_coupon",
      issueType, basis: "delay_coupon", itemName: null, orderTotal,
      refundAmount: 0, couponTRY: DELAY_COUPON_TRY,
      explanation: `Gecikme için nakit iade yerine bir sonraki siparişinde kullanabileceğin ${tl(DELAY_COUPON_TRY)}'lik indirim kuponu hesabına tanımlandı.`
    };
  }

  // Fotoğraftan ürün ayırt edilebildiyse iade o ürünün tutarıdır
  let kalem = null;
  if (issueItemName) {
    const q = String(issueItemName).toLocaleLowerCase("tr");
    kalem = kalemler.find(i => i.name.toLocaleLowerCase("tr").includes(q) ||
                               q.includes(i.name.toLocaleLowerCase("tr")));
  }

  // Ürün net ayırt edildiyse otomatik iade yap
  if (kalem) {
    const tutar = Math.min(Math.round(kalem.price * kalem.qty * 100) / 100, tavan);
    return {
      outcome: "auto_refund",
      issueType, basis: "item_price", itemName: kalem.name, orderTotal,
      refundAmount: tutar,
      explanation: `${kalem.name} karşılığı olarak ${tl(tutar)} iade edilebilir.`
    };
  }

  // Ürün ayırt edilemediğinde %40 kısmi iade kaldırıldı — belirsizlik durumunda dosya insan temsilciye aktarılır
  return {
    outcome: "escalate_human",
    issueType, basis: "unmatched", itemName: null, orderTotal,
    refundAmount: 0,
    explanation: "Fotoğraftaki sorunlu ürün net ayırt edilemediği için dosya müşteri temsilcisine aktarıldı."
  };
}
/* ================= Sipariş Desteği — Gemini ================= */
/* Ürün kararı (iade tutarı, tavan, uygunluk) kural motorunda kalır; modelden
   yalnızca sınıflandırma ve dil istenir. Böylece AI ne kadar "yaratıcı" olursa
   olsun para hareketi deterministik ve denetlenebilir kalıyor. */
async function callGeminiSupport(userText, ctx) {
  const local = () => localSupportReply(userText, ctx);

  if (typeof aiEnabled === "function" && !aiEnabled()) return local();
  const currentKey = getGeminiKey();
  if (!currentKey) return local();
  if (Date.now() < QUOTA_STATE.cooldownUntil) return local();

  const o = (ctx && ctx.order) || {};
  const gorusme = (ctx && ctx.history || [])
    .filter(m => m.role === "user" || m.role === "assistant")
    .slice(-6)
    .map(m => `${m.role === "user" ? "Müşteri" : "Sen"}: ${m.text}`)
    .join("\n");

  const prompt = `Sen Orbit Eats'in sipariş destek asistanısın. Türkçe konuşuyorsun.

KAPSAM — önce bunu kontrol et:
Sen yalnızca bu siparişle ilgili sorunları çözmek için buradasın. Müşterinin
mesajı siparişiyle (eksik/yanlış/hasarlı ürün, gecikme, iade, teslimat) ilgili
değilse — genel bilgi sorusu, sohbet, alakasız bir konu — iade veya çözüm
üretmeye çalışma. Kısaca karşılık ver, bu ekranın sipariş sorunlarını çözmek
için olduğunu söyle ve siparişiyle ilgili yaşadığı bir sorun olup olmadığını
sor. needsPhoto alanını false döndür.

TON KURALLARI — bunlar en önemlisi:
- Önce duyguyu karşıla: müşteri sorun yaşamış, savunmaya geçme, özür dilemekten çekinme.
- Müşteriye "sen" diye hitap et, "siz" kullanma. Uygulamanın dili samimi.
- Kendinden tekil bahset: "tanımlayabilirim", "bakıyorum" de; "biz" kullanma.
- Sakin, sıcak ve net ol. Kısa cümleler kur. Toplam 2-3 cümleyi geçme.
- "Anlıyorum", "haklısın", "hemen bakıyorum" gibi ifadeler kullan ama klişe yığma.
- Asla suçlayıcı olma, müşteriden kanıt isterken bile nazik ol.
- Tutar, iade, tavan gibi rakamları SEN UYDURMA. Sana verilmediyse hiç sayı yazma.
- Emoji kullanma. Madde işareti kullanma. Düz konuş.

SİPARİŞ BİLGİSİ
Restoran: ${o.storeName || "-"}
İçerik: ${o.itemsSummary || "-"}
Tutar: ${o.totalPrice || "-"}
Durum: ${o.status === "active" ? "yolda" : "teslim edildi"}
Tarih: ${o.date || "-"}
Müşteri statüsü: ${ctx && ctx.tier ? ctx.tier : "Base"}
Son 90 günde açtığı benzer talep: ${ctx && ctx.priorClaims != null ? ctx.priorClaims : 0}

${gorusme ? `ÖNCEKİ KONUŞMA\n${gorusme}\n` : ""}
MÜŞTERİNİN SON MESAJI: "${userText}"

${ctx && ctx.mode === "late_delivery"
  ? `DURUM: Müşteri siparişinin geç geldiğini bildirdi. Bu bir ürün sorunu değil,
operasyonel bir aksaklık. Fotoğraf İSTEME, iade veya tutar TEKLİF ETME.
Şunları söyle: bildirdiği için teşekkür et, restoran ve ilgili birimlerle
konuyu tekrar paylaşacağını ve gereken hassasiyetin gösterilmesini
sağlayacağını belirt, farklı bir sorunu varsa yardıma hazır olduğunu ekle.
needsPhoto alanını false döndür.`
  : ctx && ctx.mode === "resolution"
  ? `DURUM: Müşteri kanıt fotoğrafı gönderdi ve sistem incelemeyi tamamladı.
Sistemin kararı: ${ctx.refundAmount} TL iade uygun${ctx.itemName ? ` (${ctx.itemName} karşılığı)` : " (eksik ürün karşılığı)"}.
Bu kararı müşteriye kısaca aktar. Tutarı ${ctx.refundAmount} TL olarak aynen kullan, değiştirme.
Hesaplamanın detayına girme; yüzde, oran veya üst sınır gibi ifadeler kullanma.
Önce özür dile, sonra tutarı ve neyin karşılığı olduğunu söyle, onayını iste.
Son cümlede: bu çözüm ona uygun değilse canlı destek ekibiyle farklı
alternatifleri konuşabileceğini belirt.`
  : `DURUM: Müşteri sorununu yeni anlattı. Henüz fotoğraf yok.
Eğer müşteri "eksik ürün" veya siparişinde eksik bir şey olduğunu bildirdiyse tam olarak şu cümleyi söyle: "Yaşadığın bu olumsuz deneyim için üzgünüm. Teslim edilen siparişteki tüm ürünleri aynı karede görebileceğim şekilde benimle paylaşır mısın?"
Diğer sorun durumlarında onu sakinleştir, sorunu anladığını göster ve değerlendirmeyi hızlandırmak için fotoğraf paylaşmasını nazikçe iste.`}

Yalnızca şu JSON'u döndür:
{
  "issueType": "eksik ürün | yanlış ürün | geç teslimat | hasarlı teslimat | sipariş sorunu",
  "reply": "müşteriye söyleyeceğin metin",
  "needsPhoto": true/false,
  "followups": ["kısa öneri", "kısa öneri"]
}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.6,
      thinkingConfig: { thinkingLevel: "low" },
      maxOutputTokens: 700,
      responseMimeType: "application/json"
    }
  };

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(`${url}?key=${currentKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });
    clearTimeout(timeoutId);

    if (response.status === 429) {
      QUOTA_STATE.cooldownUntil = Date.now() + 60000;
      QUOTA_STATE.exhausted = true;
      console.warn("🚫 [Orbit Destek] Kota doldu, yerel yanıt kullanılıyor.");
      return local();
    }
    if (!response.ok) {
      console.warn(`⚠️ [Orbit Destek] Model yanıt vermedi (${response.status}).`);
      return local();
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return local();
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw);
    if (!parsed.reply) return local();

    console.log("✅ [Orbit Destek] Gemini yanıtı alındı:", parsed);
    return {
      isRealAi: true,
      issueType: parsed.issueType || classifyIssue(userText),
      reply: parsed.reply,
      needsPhoto: parsed.needsPhoto !== false,
      followups: Array.isArray(parsed.followups) ? parsed.followups.slice(0, 3) : []
    };
  } catch (err) {
    console.warn("⚠️ [Orbit Destek] Çağrı hatası:", err);
    return local();
  }
}

/* Model kapalıyken veya ulaşılamadığında kullanılan sıcak ama sabit yanıtlar */
function localSupportReply(userText, ctx) {
  const tip = (ctx && ctx.mode === "resolution")
    ? (ctx.issueType || "sipariş sorunu")
    : classifyIssue(userText);

  if (ctx && ctx.mode === "resolution") {
    return {
      isRealAi: false,
      issueType: tip,
      reply: `Fotoğrafı inceledim, yaşadığın aksaklık için üzgünüm. ` +
             `${ctx.itemName ? `${ctx.itemName} karşılığı` : "Eksik ürün karşılığı"} olarak ` +
             `${tl(ctx.refundAmount)} iade tanımlayabilirim — onaylıyor musun? ` +
             `Bu çözüm sana uygun değilse canlı destek ekibimizle farklı alternatifleri konuşabilirsin.`,
      needsPhoto: false,
      followups: ["Destek ekibine aktar", "Siparişi tekrarla"]
    };
  }

  if (ctx && ctx.mode === "late_delivery") {
    return {
      isRealAi: false,
      issueType: "geç teslimat",
      reply: "Geç teslimatı bize bildirdiğin için teşekkürler. Restoran ve ilgili " +
             "birimlerimizle bu konuyu tekrar paylaşıp gereken hassasiyetin " +
             "gösterilmesini sağlayacağız. Farklı bir problemin varsa destek olmaya hazırım.",
      needsPhoto: false,
      followups: ["Farklı bir sorunum var", "Siparişi tekrarla"]
    };
  }

  // Sipariş sorunu değilse çözüm üretme, kapsamı hatırlat
  if (!(ctx && ctx.mode) && !/eksik|gelmedi|yok|yanlış|farklı|başka|geç|gecik|bekle|dökül|soğu|bozuk|ezil|iade|sorun|şikayet|hatalı|kırık/i.test(userText || "")) {
    return {
      isRealAi: false,
      issueType: "sipariş sorunu",
      reply: "Bu ekranda siparişinle ilgili yaşadığın sorunları çözmene yardımcı oluyorum. " +
             "Siparişinde eksik, yanlış ya da hasarlı bir şey mi var? Kısaca anlatırsan hemen bakayım.",
      needsPhoto: false,
      followups: ["Siparişim eksik geldi", "Yanlış ürün geldi"]
    };
  }

  const acilis = {
    "eksik ürün": "Siparişinden bir şeyin eksik çıkması can sıkıcı, kusura bakma.",
    "yanlış ürün": "İstediğinden farklı bir ürün gelmiş, bunun için üzgünüm.",
    "geç teslimat": "Beklediğinden geç kalmış, seni oyaladığımız için özür dilerim.",
    "hasarlı teslimat": "Siparişin istediğin gibi ulaşmamış, bunun için üzgünüm.",
    "sipariş sorunu": "Yaşadığın aksaklık için üzgünüm."
  }[tip];

  if (tip === "eksik ürün") {
    return {
      isRealAi: false,
      issueType: tip,
      reply: "Yaşadığın bu olumsuz deneyim için üzgünüm. Teslim edilen siparişteki tüm ürünleri aynı karede görebileceğim şekilde benimle paylaşır mısın?",
      needsPhoto: true,
      followups: ["Fotoğraf ekleyeyim", "Destek ekibine aktar"]
    };
  }

  return {
    isRealAi: false,
    issueType: tip,
    reply: `${acilis} Durumu "${tip}" olarak not ettim ve hemen bakıyorum. ` +
           `Değerlendirmeyi hızlandırmak için siparişin fotoğrafını paylaşabilir misin? ` +
           `Aşağıdaki kamera ikonundan ekleyebilirsin.`,
    needsPhoto: true,
    followups: ["Fotoğraf ekleyeyim", "Destek ekibine aktar"]
  };
}

/* ================= Fotoğraf kanıtı — görsel analizi ================= */
/* Karar ağacı ürün kuralıdır, modelin işi yalnızca görselde ne olduğunu söylemek:
   yemek/sipariş görseli değilse iade yok; 1.000 TL ve üzeri siparişte otomatik
   iade yapılmaz, dosya çağrı merkezine devredilir. */
const AUTO_REFUND_ORDER_CAP_TRY = 1000;
/* İade hiçbir durumda sipariş tutarının %80'ini aşmaz.
   Ürün ayırt edilemediğinde %40 iade silindi — dosya insan temsilciye aktarılır. */
const MAX_REFUND_RATIO = 0.8;
/* Gecikme telafisi: nakit iadeye dokunulmaz, sonraki siparişte geçerli kupon
   tanımlanır. Kullanıcıdan onay ya da aksiyon beklenmez. */
const DELAY_COUPON_TRY = 100;

function decidePhotoClaim(vision, order, issueType) {
  const orderTotal = (order && order.totalTRY) || 0;
  /* Görsel doğrulanamadıysa (model kapalı, kota dolu, hata) otomatik iade
     YAPILMAZ. Görmeden para vermek yerine dosya insana devredilir. */
  if (!vision) {
    return { outcome: "escalate_human", vision: null, orderTotal, reason: "no_vision" };
  }
  if (vision.isFood === false) {
    return { outcome: "irrelevant_photo", vision };
  }
  if (orderTotal >= AUTO_REFUND_ORDER_CAP_TRY) {
    return { outcome: "escalate_human", vision, orderTotal, reason: "order_cap_exceeded" };
  }
  if (!vision.issueItem) {
    return { outcome: "escalate_human", vision, orderTotal, reason: "item_unclear" };
  }
  const result = resolveIssue(issueType, order, vision.issueItem);
  return Object.assign({ vision }, result);
}

async function analyzePhotoEvidence(base64, mimeType, order) {
  const currentKey = getGeminiKey();
  if (typeof aiEnabled === "function" && !aiEnabled()) return null;
  if (!currentKey || !base64) return null;
  if (Date.now() < QUOTA_STATE.cooldownUntil) return null;

  /* Kısa prompt + kısa çıktı: görsel analizinde süre doğrudan üretilen
     token sayısına bağlı, uzun açıklamalar isteği 25 sn'ye çıkarıyordu. */
  const kalemler = ((order && order.items) || [])
    .map(i => `${i.qty}x ${i.name}`).join(", ");

  const prompt = `Bu görsel bir yemek siparişi şikayetine kanıt olarak yüklendi.
${kalemler ? `Sipariş içeriği: ${kalemler}` : ""}

Alanlar: isFood (true/false), description (en fazla 6 kelime),
observation (en fazla 6 kelime), issueItem (siparişteki sorunlu ürünün adı,
emin değilsen boş string).

isFood true SADECE gerçek yemek, içecek, sipariş paketi, kurye poşeti veya
restoran ambalajı varsa. Ekran görüntüsü, tablo, belge, portre, manzara,
hayvan, çizim, logo gibi her şeyde false. Emin değilsen false.`;

  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "image/jpeg", data: base64 } }
      ]
    }],
    generationConfig: {
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: "low" },
      /* Düşünme token'ları bu bütçeden yeniyor; 180'de yanıt MAX_TOKENS ile
         kesiliyor ve JSON yarım kalıyordu. */
      maxOutputTokens: 500,
      responseMimeType: "application/json"
    }
  };

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
  try {
    const controller = new AbortController();
    /* Görsel analizi metinden yavaş: büyük fotoğraflarda 15 sn sınırda kalıyordu */
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(`${url}?key=${currentKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });
    clearTimeout(timeoutId);

    if (response.status === 429) {
      QUOTA_STATE.cooldownUntil = Date.now() + 60000;
      return null;
    }
    if (!response.ok) {
      console.warn(`⚠️ [Orbit Destek] Görsel analizi başarısız (${response.status}).`);
      return null;
    }
    const data = await response.json();
    const finish = data.candidates?.[0]?.finishReason;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (finish && finish !== "STOP") {
      console.warn(`⚠️ [Orbit Destek] Görsel yanıtı "${finish}" ile kesildi.`);
      return null;
    }
    if (!raw) return null;
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw);
    console.log("🖼️ [Orbit Destek] Görsel analizi:", parsed);
    return parsed;
  } catch (err) {
    console.warn("⚠️ [Orbit Destek] Görsel analizi hatası:", err);
    return null;
  }
}

/* ================= Görselle arama ================= */
/* Tek çağrıda hem fotoğraftaki yemeği tanır hem katalogdan öneri seçer.
   İki ayrı istek (tanıma + öneri) toplam süreyi 35 sn'ye çıkarıyordu. */
async function photoSearchWithGemini(base64, mimeType) {
  const currentKey = getGeminiKey();
  if (typeof aiEnabled === "function" && !aiEnabled()) return null;
  if (!currentKey || !base64) return null;
  if (Date.now() < QUOTA_STATE.cooldownUntil) return null;

  const user = STATE.user || {};
  const prefs = user.declaredPreferences || {};
  const catalog = shortlistForLlm("", buildMenuCatalog(), 16);
  const menuListesi = catalog.map(i =>
    `${i.itemId}|${i.itemName}|${i.restaurantName}|${i.price}TL|${(i.tags || []).join(",")}`
  ).join("\n");

  const prompt = `Kullanıcı bir yemek fotoğrafı yükledi. Fotoğraftaki yemeği tanı ve
menüden ona en yakın 3 seçeneği öner.

KULLANICI TERCİHLERİ
${prefs.dietFilterActive === false
  ? "Beslenme tercihi süzmesi KAPALI — diyet ve damak tadı kısıtı uygulama, menünün tamamından seç."
  : `Diyet: ${prefs.dietStyle || "yok"} · Sevmedikleri: ${(prefs.dislikes || []).join(", ") || "yok"}`}
Kaçındığı alerjenler (her koşulda uygula): ${(prefs.allergensToAvoid || []).join(", ") || "yok"}

MENÜ (id|ürün|restoran|fiyat|etiketler)
${menuListesi}

Yalnızca şu JSON'u döndür:
{
  "isFood": true/false,
  "dishName": "fotoğraftaki yemeğin adı",
  "note": "en fazla 8 kelime",
  "recommendedItemIds": ["id1","id2","id3"],
  "companionMessage": "1-2 cümle, sıcak bir dille neden bunları seçtiğin",
  "followups": ["kısa öneri", "kısa öneri"]
}

Fotoğrafta yemek yoksa isFood false döndür, diğer alanları boş bırak.
Alerjen ve diyet tercihlerine kesinlikle uy.
Kullanıcıya "sen" diye hitap et, "siz" kullanma. companionMessage kısa olsun,
fotoğrafta ne gördüğünü tekrar etme — sadece neden bu seçenekleri seçtiğini söyle.`;

  const payload = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "image/jpeg", data: base64 } }
      ]
    }],
    generationConfig: {
      temperature: 0.4,
      thinkingConfig: { thinkingLevel: "low" },
      maxOutputTokens: 900,
      responseMimeType: "application/json"
    }
  };

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(`${url}?key=${currentKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });
    clearTimeout(timeoutId);

    if (response.status === 429) {
      QUOTA_STATE.cooldownUntil = Date.now() + 60000;
      QUOTA_STATE.exhausted = true;
      return null;
    }
    if (!response.ok) {
      console.warn(`⚠️ [Orbit AI] Görsel arama başarısız (${response.status}).`);
      return null;
    }

    const data = await response.json();
    const finish = data.candidates?.[0]?.finishReason;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (finish && finish !== "STOP") {
      console.warn(`⚠️ [Orbit AI] Görsel yanıtı "${finish}" ile kesildi.`);
    }
    if (!raw) return null;

    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw);

    const results = [];
    (parsed.recommendedItemIds || []).forEach(id => {
      const found = catalog.find(x => x.itemId === id) ||
                    buildMenuCatalog().find(x => x.itemId === id);
      if (found) results.push({ ...found, reason: parsed.companionMessage || "Fotoğrafındaki lezzete yakın." });
    });

    console.log("🍽️ [Orbit AI] Görsel arama:", parsed);
    return {
      isFood: parsed.isFood !== false,
      dishName: parsed.dishName || "",
      note: parsed.note || "",
      companionMessage: parsed.companionMessage || "",
      results,
      followups: parsed.followups || []
    };
  } catch (err) {
    console.warn("⚠️ [Orbit AI] Görsel arama hatası:", err);
    return null;
  }
}

/* ================= Sipariş geçmişi analizi ================= */
/* Tüm AI konuşmaları bu sinyaller üzerine kuruluyor: kullanıcının hangi saatte
   ne sipariş ettiği, hangi fiyat aralığında gezdiği ve neyi tekrarladığı. */
function orderHistoryInsights(user) {
  const u = user || STATE.user || {};
  const hist = u.orderHistory || [];
  if (!hist.length) return null;

  const dayPart = (u.context && u.context.timeOfDay) || null;
  const sameSlot = dayPart ? hist.filter(o => o.dayPart === dayPart) : [];
  const pool = sameSlot.length ? sameSlot : hist;

  const prices = pool.map(o => o.priceTRY).filter(Boolean);
  const avg = prices.length ? Math.round(prices.reduce((t, x) => t + x, 0) / prices.length) : 0;
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;

  // En sık sipariş verilen restoran
  const restCount = {};
  hist.forEach(o => { restCount[o.restaurant] = (restCount[o.restaurant] || 0) + 1; });
  const topRest = Object.entries(restCount).sort((a, b) => b[1] - a[1])[0];

  // Aynı ürünü tekrar etme örüntüsü
  const itemCount = {};
  hist.forEach(o => { itemCount[o.item] = (itemCount[o.item] || 0) + 1; });
  const repeated = Object.entries(itemCount).filter(([, n]) => n > 1).map(([k]) => k);

  const recent = hist.slice().sort((a, b) => a.daysAgo - b.daysAgo);

  return {
    dayPart,
    totalOrders: hist.length,
    sameSlotCount: sameSlot.length,
    avgSpend: avg, minSpend: min, maxSpend: max,
    topRestaurant: topRest ? { name: topRest[0], count: topRest[1] } : null,
    repeatedItems: repeated,
    lastOrder: recent[0] || null,
    slotItems: pool.slice().sort((a, b) => a.daysAgo - b.daysAgo).map(o => ({
      item: o.item, restaurant: o.restaurant, price: o.priceTRY, daysAgo: o.daysAgo
    }))
  };
}

/* Prompt'a gömülecek özet — modelin geçmişi "okuduğunu" gösterebilmesi için */
function historyPromptBlock(user) {
  const h = orderHistoryInsights(user);
  if (!h) return "Sipariş geçmişi yok.";
  const satirlar = h.slotItems.slice(0, 5)
    .map(o => `- ${o.item} · ${o.restaurant} · ${o.price} TL · ${o.daysAgo} gün önce`)
    .join("\n");
  return `Toplam ${h.totalOrders} sipariş. ${h.dayPart ? `Bu saat diliminde (${h.dayPart}) ${h.sameSlotCount} sipariş.` : ""}
Alıştığı fiyat aralığı: ${h.minSpend}-${h.maxSpend} TL (ortalama ${h.avgSpend} TL).
${h.topRestaurant ? `En sık: ${h.topRestaurant.name} (${h.topRestaurant.count} kez).` : ""}
${h.repeatedItems.length ? `Tekrarladığı ürünler: ${h.repeatedItems.join(", ")}.` : "Aynı ürünü tekrar etmiyor, çeşitlilik arıyor."}
Son siparişleri:
${satirlar}`;
}
