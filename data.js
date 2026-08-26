/* Beslenme tarzı TEK seçimdir — insan aynı anda hem vegan hem et ağırlıklı olamaz.
   Beslenme tarzı tek seçimdir; alerjenler ve sevmedikleri ayrı katmanlarda tutulur. */
const DIET_OPTIONS = [
  { id: "dengeli",     label: "Dengeli",        hint: "Her şeyi yerim",        icon: "🍽️" },
  { id: "vejetaryen",  label: "Vejetaryen",     hint: "Et yok",                icon: "🥗" },
  { id: "vegan",       label: "Vegan",          hint: "Hayvansal ürün yok",    icon: "🌱" },
  { id: "pesketaryen", label: "Pesketaryen",    hint: "Balık var, et yok",     icon: "🐟" },
  { id: "protein",     label: "Protein Ağırlıklı", hint: "Yüksek proteinli",   icon: "💪" }
];

/* Kırmızı çizgiler — sert dışlama. Hiçbir toplu şalterle kapatılamaz. */
const ALLERGEN_OPTIONS = [
  "gluten", "yer fıstığı", "süt ürünleri", "soya", "susam", "kabuklu deniz ürünleri", "yumurta"
];

/* Damak tadı — sonucu kısıtlamaz, yalnızca sıralamayı etkiler (soft). */
const DISLIKE_OPTIONS = [
  "soğan", "sarımsak", "acı", "kişniş", "maydanoz", "mantar", "zeytin"
];

const RESTAURANTS = [
  {
    "id": "r1",
    "name": "Zeytin Sofrası",
    "cuisine": "Ev Yemekleri",
    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
    "rating": 4.7,
    "deliveryMinutes": 28,
    "distanceKm": 1.4,
    "priceLevel": 2,
    "tags": ["hafif", "ev-yemegi", "vejetaryen-secenekli"],
    "menu": [
      {
        "id": "m1",
        "name": "Zeytinyağlı Taze Fasulye",
        "image": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80",
        "price": 185,
        "ingredients": ["taze fasulye", "zeytinyağı", "domates", "soğan", "sarımsak"],
        "allergens": [],
        "calories": 320,
        "prepMinutes": 5,
        "tags": ["vejetaryen", "vegan", "hafif", "acisiz"]
      },
      {
        "id": "m2",
        "name": "Mercimek Köftesi Tabağı",
        "image": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=500&auto=format&fit=crop&q=80",
        "price": 165,
        "ingredients": ["kırmızı mercimek", "bulgur", "soğan", "maydanoz", "limon"],
        "allergens": ["gluten"],
        "calories": 410,
        "prepMinutes": 5,
        "tags": ["vejetaryen", "vegan", "hafif", "az-acili"]
      },
      {
        "id": "m3",
        "name": "Izgara Tavuk Şiş + Bulgur Pilavı",
        "image": "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=500&auto=format&fit=crop&q=80",
        "price": 320,
        "ingredients": ["tavuk göğsü", "bulgur", "biber", "domates"],
        "allergens": [],
        "calories": 560,
        "prepMinutes": 8,
        "tags": ["doyurucu", "yuksek-protein", "acisiz"]
      }
    ]
  },
  {
    "id": "r2",
    "name": "Ateş Böceği Acı Mutfağı",
    "cuisine": "Uzak Doğu / Fusion",
    "image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop&q=80",
    "rating": 4.5,
    "deliveryMinutes": 35,
    "distanceKm": 2.1,
    "priceLevel": 3,
    "tags": ["acili", "doyurucu"],
    "menu": [
      {
        "id": "m4",
        "name": "Szechuan Acı Tavuk",
        "image": "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=500&auto=format&fit=crop&q=80",
        "price": 340,
        "ingredients": ["tavuk but", "szechuan biberi", "soya sosu", "sarımsak", "yer fıstığı"],
        "allergens": ["yer fıstığı", "soya", "gluten"],
        "calories": 680,
        "prepMinutes": 12,
        "tags": ["cok-acili", "doyurucu", "yuksek-kalori"]
      },
      {
        "id": "m5",
        "name": "Vegan Kimchi Noodle",
        "image": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80",
        "price": 280,
        "ingredients": ["noodle", "kimchi", "tofu", "yeşil soğan", "susam yağı"],
        "allergens": ["gluten", "susam"],
        "calories": 450,
        "prepMinutes": 10,
        "tags": ["vegan", "orta-acili"]
      }
    ]
  },
  {
    "id": "r3",
    "name": "Yeşil Kase",
    "cuisine": "Sağlıklı / Salata Bar",
    "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80",
    "rating": 4.8,
    "deliveryMinutes": 22,
    "distanceKm": 0.9,
    "priceLevel": 2,
    "tags": ["hafif", "saglikli", "vegan-secenekli"],
    "menu": [
      {
        "id": "m6",
        "name": "Quinoa & Avokado Kase",
        "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80",
        "price": 290,
        "ingredients": ["quinoa", "avokado", "nohut", "cherry domates", "limon sosu"],
        "allergens": [],
        "calories": 380,
        "prepMinutes": 6,
        "tags": ["vegan", "hafif", "acisiz", "yuksek-lif"]
      },
      {
        "id": "m7",
        "name": "Izgara Somon Kase",
        "image": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&auto=format&fit=crop&q=80",
        "price": 420,
        "ingredients": ["somon", "kinoa", "brokoli", "tahin sos"],
        "allergens": ["balık", "susam"],
        "calories": 520,
        "prepMinutes": 9,
        "tags": ["yuksek-protein", "hafif", "acisiz"]
      }
    ]
  },
  {
    "id": "r4",
    "name": "Dürüm Ustası",
    "cuisine": "Sokak Lezzetleri / Kebap",
    "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&auto=format&fit=crop&q=80",
    "rating": 4.4,
    "deliveryMinutes": 25,
    "distanceKm": 1.7,
    "priceLevel": 1,
    "tags": ["doyurucu", "hizli", "ekonomik", "kebap", "halal"],
    "menu": [
      {
        "id": "m8",
        "name": "Acılı Adana Dürüm",
        "image": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500&auto=format&fit=crop&q=80",
        "price": 260,
        "ingredients": ["kıyma", "biber", "lavaş", "acı sos", "soğan"],
        "allergens": ["gluten"],
        "calories": 610,
        "prepMinutes": 7,
        "tags": ["cok-acili", "doyurucu", "halal"]
      },
      {
        "id": "m9",
        "name": "Falafel Dürüm (Vegan)",
        "image": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=500&auto=format&fit=crop&q=80",
        "price": 220,
        "ingredients": ["nohut", "lavaş", "tahin sos", "marul", "domates"],
        "allergens": ["gluten", "susam"],
        "calories": 480,
        "prepMinutes": 6,
        "tags": ["vegan", "vejetaryen", "az-acili", "halal"]
      }
    ]
  },
  {
    "id": "r5",
    "name": "Pizza Bulls",
    "cuisine": "Pizza & İtalyan",
    "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80",
    "rating": 4.6,
    "deliveryMinutes": 20,
    "distanceKm": 1.1,
    "priceLevel": 2,
    "tags": ["pizza", "italyan", "hizli", "halal"],
    "menu": [
      {
        "id": "m10",
        "name": "Büyük Boy Karışık Pizza",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80",
        "price": 360,
        "ingredients": ["mozzarella", "sucuk", "mantar", "biber", "mısır"],
        "allergens": ["gluten", "süt ürünleri"],
        "calories": 850,
        "prepMinutes": 12,
        "tags": ["pizza", "doyurucu", "az-acili"]
      },
      {
        "id": "m11",
        "name": "Margarita Pizza (Vejetaryen)",
        "image": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=80",
        "price": 290,
        "ingredients": ["mozzarella", "domates sosu", "taze fesleğen"],
        "allergens": ["gluten", "süt ürünleri"],
        "calories": 650,
        "prepMinutes": 10,
        "tags": ["vejetaryen", "pizza", "acisiz"]
      }
    ]
  },
  {
    "id": "r6",
    "name": "Focus Burger & Gurme Mutfak",
    "cuisine": "Hamburger & Western",
    "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80",
    "rating": 4.7,
    "deliveryMinutes": 25,
    "distanceKm": 1.5,
    "priceLevel": 3,
    "tags": ["burger", "western", "gurme", "halal"],
    "menu": [
      {
        "id": "m12",
        "name": "Trüf Cheddarlı Burger Menu",
        "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80",
        "price": 340,
        "ingredients": ["dana köfte", "cheddar", "trüf mayonez", "karamelize soğan"],
        "allergens": ["gluten", "süt ürünleri", "yumurta"],
        "calories": 780,
        "prepMinutes": 11,
        "tags": ["burger", "doyurucu", "az-acili"]
      }
    ]
  },
  {
    "id": "r7",
    "name": "Adile Sultan Ev Yemekleri",
    "cuisine": "Ev Yemekleri",
    "image": "https://images.unsplash.com/photo-1547592180-85f173990554?w=500&auto=format&fit=crop&q=80",
    "rating": 4.6,
    "deliveryMinutes": 32,
    "distanceKm": 2.3,
    "priceLevel": 2,
    "tags": ["ev-yemegi", "hafif", "vejetaryen-secenekli", "corba"],
    "menu": [
      {
        "id": "m13",
        "name": "Ev Usulü Mantı",
        "image": "https://images.unsplash.com/photo-1541014741259-de529411b96a?w=500&auto=format&fit=crop&q=80",
        "price": 280,
        "ingredients": ["hamur", "kıyma", "yoğurt", "tereyağı"],
        "allergens": ["gluten", "süt ürünleri", "yumurta"],
        "calories": 610,
        "prepMinutes": 14,
        "tags": ["doyurucu", "ev-yemegi", "acisiz"]
      },
      {
        "id": "m14",
        "name": "Zeytinyağlı Enginar",
        "image": "https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?w=500&auto=format&fit=crop&q=80",
        "price": 195,
        "ingredients": ["enginar", "zeytinyağı", "havuç", "bezelye"],
        "allergens": [],
        "calories": 240,
        "prepMinutes": 8,
        "tags": ["vejetaryen", "vegan", "hafif", "acisiz"]
      }
    ]
  },
  {
    "id": "r8",
    "name": "Lucky Sushi Chinese",
    "cuisine": "Uzak Doğu / Sushi",
    "image": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&auto=format&fit=crop&q=80",
    "rating": 4.4,
    "deliveryMinutes": 34,
    "distanceKm": 2.8,
    "priceLevel": 3,
    "tags": ["uzakdogu", "sushi", "deniz", "hafif"],
    "menu": [
      {
        "id": "m15",
        "name": "Karışık Sushi Tabağı (16 parça)",
        "image": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&auto=format&fit=crop&q=80",
        "price": 580,
        "ingredients": ["somon", "avokado", "pirinç", "nori"],
        "allergens": ["balık", "soya", "susam"],
        "calories": 520,
        "prepMinutes": 16,
        "tags": ["hafif", "yuksek-protein", "acisiz"]
      },
      {
        "id": "m16",
        "name": "Sebzeli Yakisoba",
        "image": "https://images.unsplash.com/photo-1552611052-33e04de081de?w=500&auto=format&fit=crop&q=80",
        "price": 290,
        "ingredients": ["erişte", "brokoli", "havuç", "soya sosu"],
        "allergens": ["gluten", "soya"],
        "calories": 430,
        "prepMinutes": 12,
        "tags": ["vejetaryen", "az-acili", "doyurucu"]
      }
    ]
  },
  {
    "id": "r9",
    "name": "Crunchy Chickens",
    "cuisine": "Tavuk & Fast Food",
    "image": "https://images.unsplash.com/photo-1562967914-608f82629710?w=500&auto=format&fit=crop&q=80",
    "rating": 4.3,
    "deliveryMinutes": 22,
    "distanceKm": 1.2,
    "priceLevel": 2,
    "tags": ["tavuk", "fast-food", "hizli", "halal", "doyurucu"],
    "menu": [
      {
        "id": "m17",
        "name": "Çıtır Tavuk Burger Menü",
        "image": "https://images.unsplash.com/photo-1562967914-608f82629710?w=500&auto=format&fit=crop&q=80",
        "price": 320,
        "ingredients": ["tavuk göğüs", "ekmek", "marul", "ranch sos"],
        "allergens": ["gluten", "yumurta", "süt ürünleri"],
        "calories": 720,
        "prepMinutes": 10,
        "tags": ["doyurucu", "halal", "az-acili"]
      },
      {
        "id": "m18",
        "name": "Acılı Tavuk Kanat (8 adet)",
        "image": "https://images.unsplash.com/photo-1608039755401-742074f0548d?w=500&auto=format&fit=crop&q=80",
        "price": 270,
        "ingredients": ["tavuk kanat", "acı sos", "baharat"],
        "allergens": ["gluten"],
        "calories": 640,
        "prepMinutes": 12,
        "tags": ["cok-acili", "doyurucu", "halal"]
      }
    ]
  },
  {
    "id": "r10",
    "name": "Saray İşkembecisi",
    "cuisine": "Çorba & Geleneksel",
    "image": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80",
    "rating": 4.2,
    "deliveryMinutes": 18,
    "distanceKm": 0.8,
    "priceLevel": 1,
    "tags": ["corba", "geleneksel", "hizli", "ekonomik", "halal"],
    "menu": [
      {
        "id": "m19",
        "name": "İşkembe Çorbası",
        "image": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&auto=format&fit=crop&q=80",
        "price": 165,
        "ingredients": ["işkembe", "un", "tereyağı", "sarımsak"],
        "allergens": ["gluten", "süt ürünleri"],
        "calories": 320,
        "prepMinutes": 6,
        "tags": ["sicak", "geleneksel", "halal"]
      },
      {
        "id": "m20",
        "name": "Mercimek Çorbası",
        "image": "https://images.unsplash.com/photo-1547592180-85f173990554?w=500&auto=format&fit=crop&q=80",
        "price": 145,
        "ingredients": ["kırmızı mercimek", "havuç", "soğan"],
        "allergens": [],
        "calories": 210,
        "prepMinutes": 5,
        "tags": ["vejetaryen", "vegan", "hafif", "sicak", "acisiz"]
      }
    ]
  },
  {
    "id": "r11",
    "name": "Kapanı Pilavcısı",
    "cuisine": "Pilav & Kebap",
    "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&auto=format&fit=crop&q=80",
    "rating": 4.0,
    "deliveryMinutes": 26,
    "distanceKm": 1.9,
    "priceLevel": 1,
    "tags": ["pilav", "kebap", "ekonomik", "doyurucu", "halal"],
    "menu": [
      {
        "id": "m21",
        "name": "Tavuklu Pilav",
        "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&auto=format&fit=crop&q=80",
        "price": 240,
        "ingredients": ["pirinç", "tavuk göğüs", "tereyağı"],
        "allergens": ["süt ürünleri"],
        "calories": 560,
        "prepMinutes": 7,
        "tags": ["doyurucu", "yuksek-protein", "halal", "acisiz"]
      },
      {
        "id": "m22",
        "name": "Nohutlu Pilav",
        "image": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&auto=format&fit=crop&q=80",
        "price": 185,
        "ingredients": ["pirinç", "nohut", "tereyağı"],
        "allergens": ["süt ürünleri"],
        "calories": 480,
        "prepMinutes": 6,
        "tags": ["vejetaryen", "doyurucu", "ekonomik", "acisiz"]
      }
    ]
  },
  {
    "id": "r12",
    "name": "Haus Des Döner",
    "cuisine": "Döner",
    "image": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=500&auto=format&fit=crop&q=80",
    "rating": 4.0,
    "deliveryMinutes": 20,
    "distanceKm": 1.8,
    "priceLevel": 2,
    "tags": [
      "doner",
      "hizli",
      "halal",
      "doyurucu"
    ],
    "menu": [
      {
        "id": "m23",
        "name": "Et Döner Porsiyon",
        "image": "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=500&auto=format&fit=crop&q=80",
        "price": 340,
        "ingredients": [
          "dana döner",
          "pilav",
          "salata"
        ],
        "allergens": [],
        "calories": 720,
        "prepMinutes": 9,
        "tags": [
          "doyurucu",
          "halal",
          "acisiz"
        ]
      },
      {
        "id": "m24",
        "name": "Tavuk Döner Dürüm",
        "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&auto=format&fit=crop&q=80",
        "price": 230,
        "ingredients": [
          "tavuk döner",
          "lavaş",
          "domates"
        ],
        "allergens": [
          "gluten"
        ],
        "calories": 560,
        "prepMinutes": 7,
        "tags": [
          "doyurucu",
          "halal",
          "az-acili"
        ]
      }
    ]
  },
  {
    "id": "r13",
    "name": "Çınaraltı Kebap & Lahmacun",
    "cuisine": "Kebap & Türk Mutfağı",
    "image": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80",
    "rating": 3.6,
    "deliveryMinutes": 38,
    "distanceKm": 3.1,
    "priceLevel": 2,
    "tags": [
      "kebap",
      "halal",
      "doyurucu",
      "acili"
    ],
    "menu": [
      {
        "id": "m25",
        "name": "Karışık Kebap Tabağı",
        "image": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=80",
        "price": 680,
        "ingredients": [
          "adana",
          "urfa",
          "pilav",
          "közlenmiş biber"
        ],
        "allergens": [],
        "calories": 980,
        "prepMinutes": 15,
        "tags": [
          "doyurucu",
          "halal",
          "cok-acili"
        ]
      },
      {
        "id": "m26",
        "name": "Lahmacun (2 adet)",
        "image": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80",
        "price": 220,
        "ingredients": [
          "hamur",
          "kıyma",
          "maydanoz"
        ],
        "allergens": [
          "gluten"
        ],
        "calories": 520,
        "prepMinutes": 8,
        "tags": [
          "halal",
          "az-acili",
          "ekonomik"
        ]
      }
    ]
  },
  {
    "id": "r14",
    "name": "Kayaoğlu Döner",
    "cuisine": "Döner",
    "image": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&auto=format&fit=crop&q=80",
    "rating": 4.2,
    "deliveryMinutes": 25,
    "distanceKm": 2.0,
    "priceLevel": 2,
    "tags": [
      "doner",
      "halal",
      "doyurucu"
    ],
    "menu": [
      {
        "id": "m27",
        "name": "Pilav Üstü Döner",
        "image": "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&auto=format&fit=crop&q=80",
        "price": 350,
        "ingredients": [
          "dana döner",
          "pirinç pilavı",
          "turşu"
        ],
        "allergens": [],
        "calories": 810,
        "prepMinutes": 10,
        "tags": [
          "doyurucu",
          "halal",
          "acisiz"
        ]
      },
      {
        "id": "m28",
        "name": "Döner Sandviç",
        "image": "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=500&auto=format&fit=crop&q=80",
        "price": 210,
        "ingredients": [
          "döner",
          "ekmek",
          "domates",
          "soğan"
        ],
        "allergens": [
          "gluten"
        ],
        "calories": 480,
        "prepMinutes": 6,
        "tags": [
          "hizli",
          "halal",
          "ekonomik"
        ]
      }
    ]
  },
  {
    "id": "r15",
    "name": "My Fried Chicken",
    "cuisine": "Tavuk & Burger",
    "image": "https://images.unsplash.com/photo-1626082927389-6cd097cee6a6?w=500&auto=format&fit=crop&q=80",
    "rating": 3.9,
    "deliveryMinutes": 25,
    "distanceKm": 1.6,
    "priceLevel": 2,
    "tags": [
      "tavuk",
      "burger",
      "fast-food",
      "halal",
      "hizli"
    ],
    "menu": [
      {
        "id": "m29",
        "name": "Çıtır Tavuk Burger Menü",
        "image": "https://images.unsplash.com/photo-1626082927389-6cd097cee6a6?w=500&auto=format&fit=crop&q=80",
        "price": 320,
        "ingredients": [
          "tavuk göğüs",
          "ekmek",
          "marul",
          "sos"
        ],
        "allergens": [
          "gluten",
          "yumurta"
        ],
        "calories": 760,
        "prepMinutes": 10,
        "tags": [
          "doyurucu",
          "halal",
          "az-acili"
        ]
      },
      {
        "id": "m30",
        "name": "Tavuk Tender (6 adet)",
        "image": "https://images.unsplash.com/photo-1562967914-608f82629710?w=500&auto=format&fit=crop&q=80",
        "price": 250,
        "ingredients": [
          "tavuk",
          "galeta unu"
        ],
        "allergens": [
          "gluten"
        ],
        "calories": 590,
        "prepMinutes": 9,
        "tags": [
          "doyurucu",
          "halal",
          "acisiz"
        ]
      }
    ]
  },
  {
    "id": "r16",
    "name": "Burgerzoom",
    "cuisine": "Hamburger",
    "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&auto=format&fit=crop&q=80",
    "rating": 4.4,
    "deliveryMinutes": 32,
    "distanceKm": 2.4,
    "priceLevel": 3,
    "tags": [
      "burger",
      "gurme",
      "western",
      "halal"
    ],
    "menu": [
      {
        "id": "m31",
        "name": "Double Cheeseburger",
        "image": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&auto=format&fit=crop&q=80",
        "price": 395,
        "ingredients": [
          "dana köfte",
          "cheddar",
          "turşu",
          "brioche"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri",
          "yumurta"
        ],
        "calories": 920,
        "prepMinutes": 12,
        "tags": [
          "doyurucu",
          "burger",
          "az-acili"
        ]
      },
      {
        "id": "m32",
        "name": "Truffle Mantarlı Burger",
        "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80",
        "price": 520,
        "ingredients": [
          "dana köfte",
          "mantar",
          "trüf mayonez"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri",
          "yumurta"
        ],
        "calories": 880,
        "prepMinutes": 13,
        "tags": [
          "doyurucu",
          "gurme",
          "acisiz"
        ]
      }
    ]
  },
  {
    "id": "r17",
    "name": "Katkat Kuvasan & Donut",
    "cuisine": "Pastane & Fırın",
    "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80",
    "rating": 3.9,
    "deliveryMinutes": 32,
    "distanceKm": 2.7,
    "priceLevel": 2,
    "tags": [
      "tatli",
      "pastane",
      "kahvalti"
    ],
    "menu": [
      {
        "id": "m33",
        "name": "Çikolatalı Kruvasan",
        "image": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=80",
        "price": 175,
        "ingredients": [
          "hamur",
          "tereyağı",
          "çikolata"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri",
          "yumurta"
        ],
        "calories": 420,
        "prepMinutes": 5,
        "tags": [
          "tatli",
          "acisiz"
        ]
      },
      {
        "id": "m34",
        "name": "Karışık Donut (4 adet)",
        "image": "https://images.unsplash.com/photo-1551106652-a5bcf4b29ab6?w=500&auto=format&fit=crop&q=80",
        "price": 260,
        "ingredients": [
          "hamur",
          "şeker glaze",
          "çikolata"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri",
          "yumurta"
        ],
        "calories": 640,
        "prepMinutes": 6,
        "tags": [
          "tatli",
          "acisiz"
        ]
      }
    ]
  },
  {
    "id": "r18",
    "name": "Faruk Güllü",
    "cuisine": "Tatlı & Baklava",
    "image": "https://images.unsplash.com/photo-1519676867240-f03562e64548?w=500&auto=format&fit=crop&q=80",
    "rating": 4.1,
    "deliveryMinutes": 32,
    "distanceKm": 3.4,
    "priceLevel": 3,
    "tags": [
      "tatli",
      "baklava",
      "geleneksel"
    ],
    "menu": [
      {
        "id": "m35",
        "name": "Fıstıklı Baklava (1 kg)",
        "image": "https://images.unsplash.com/photo-1519676867240-f03562e64548?w=500&auto=format&fit=crop&q=80",
        "price": 850,
        "ingredients": [
          "yufka",
          "antep fıstığı",
          "şerbet",
          "tereyağı"
        ],
        "allergens": [
          "gluten",
          "yer fıstığı",
          "süt ürünleri"
        ],
        "calories": 1800,
        "prepMinutes": 10,
        "tags": [
          "tatli",
          "acisiz"
        ]
      },
      {
        "id": "m36",
        "name": "Sütlü Nuriye",
        "image": "https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=500&auto=format&fit=crop&q=80",
        "price": 420,
        "ingredients": [
          "yufka",
          "süt",
          "fıstık"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri",
          "yer fıstığı"
        ],
        "calories": 920,
        "prepMinutes": 8,
        "tags": [
          "tatli",
          "acisiz"
        ]
      }
    ]
  },
  {
    "id": "r19",
    "name": "Terra Pizza",
    "cuisine": "Pizza",
    "image": "https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=500&auto=format&fit=crop&q=80",
    "rating": 4.0,
    "deliveryMinutes": 30,
    "distanceKm": 2.2,
    "priceLevel": 2,
    "tags": [
      "pizza",
      "italyan",
      "hizli"
    ],
    "menu": [
      {
        "id": "m37",
        "name": "Karışık Pizza (Orta)",
        "image": "https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=500&auto=format&fit=crop&q=80",
        "price": 450,
        "ingredients": [
          "mozzarella",
          "sucuk",
          "mantar",
          "biber"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri"
        ],
        "calories": 880,
        "prepMinutes": 12,
        "tags": [
          "pizza",
          "doyurucu",
          "az-acili"
        ]
      },
      {
        "id": "m38",
        "name": "Sebzeli Pizza",
        "image": "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=500&auto=format&fit=crop&q=80",
        "price": 320,
        "ingredients": [
          "mozzarella",
          "kabak",
          "biber",
          "mısır"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri"
        ],
        "calories": 700,
        "prepMinutes": 11,
        "tags": [
          "vejetaryen",
          "pizza",
          "acisiz"
        ]
      }
    ]
  },
  {
    "id": "r20",
    "name": "Sbarro Pizza",
    "cuisine": "Pizza",
    "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80",
    "rating": 3.5,
    "deliveryMinutes": 25,
    "distanceKm": 1.9,
    "priceLevel": 2,
    "tags": [
      "pizza",
      "italyan",
      "hizli"
    ],
    "menu": [
      {
        "id": "m39",
        "name": "Pepperoni Dilim",
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80",
        "price": 220,
        "ingredients": [
          "mozzarella",
          "pepperoni",
          "domates sosu"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri"
        ],
        "calories": 520,
        "prepMinutes": 7,
        "tags": [
          "pizza",
          "az-acili"
        ]
      },
      {
        "id": "m40",
        "name": "Margherita Dilim",
        "image": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=80",
        "price": 185,
        "ingredients": [
          "mozzarella",
          "domates",
          "fesleğen"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri"
        ],
        "calories": 450,
        "prepMinutes": 7,
        "tags": [
          "vejetaryen",
          "pizza",
          "acisiz"
        ]
      }
    ]
  },
  {
    "id": "r21",
    "name": "Adıyaman Çiğ Köfte Yeri",
    "cuisine": "Çiğ Köfte",
    "image": "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&auto=format&fit=crop&q=80",
    "rating": 3.9,
    "deliveryMinutes": 13,
    "distanceKm": 0.7,
    "priceLevel": 1,
    "tags": [
      "cigkofte",
      "vejetaryen",
      "ekonomik",
      "hizli",
      "acili"
    ],
    "menu": [
      {
        "id": "m41",
        "name": "Çiğ Köfte Dürüm",
        "image": "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&auto=format&fit=crop&q=80",
        "price": 165,
        "ingredients": [
          "bulgur",
          "isot",
          "nar ekşisi",
          "marul"
        ],
        "allergens": [
          "gluten"
        ],
        "calories": 380,
        "prepMinutes": 4,
        "tags": [
          "vejetaryen",
          "vegan",
          "cok-acili",
          "ekonomik"
        ]
      },
      {
        "id": "m42",
        "name": "Çiğ Köfte Porsiyon",
        "image": "https://images.unsplash.com/photo-1607330289024-1535c6b4e1c1?w=500&auto=format&fit=crop&q=80",
        "price": 195,
        "ingredients": [
          "bulgur",
          "isot",
          "limon"
        ],
        "allergens": [
          "gluten"
        ],
        "calories": 420,
        "prepMinutes": 5,
        "tags": [
          "vejetaryen",
          "vegan",
          "cok-acili"
        ]
      }
    ]
  },
  {
    "id": "r22",
    "name": "Potter Büfe",
    "cuisine": "Tost & Sandviç",
    "image": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80",
    "rating": 4.5,
    "deliveryMinutes": 25,
    "distanceKm": 1.3,
    "priceLevel": 1,
    "tags": [
      "tost",
      "sandvic",
      "hizli",
      "ekonomik",
      "kahvalti"
    ],
    "menu": [
      {
        "id": "m43",
        "name": "Kaşarlı Sucuklu Tost",
        "image": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80",
        "price": 195,
        "ingredients": [
          "ekmek",
          "kaşar",
          "sucuk"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri"
        ],
        "calories": 540,
        "prepMinutes": 6,
        "tags": [
          "doyurucu",
          "halal",
          "acisiz"
        ]
      },
      {
        "id": "m44",
        "name": "Karışık Sandviç",
        "image": "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=500&auto=format&fit=crop&q=80",
        "price": 175,
        "ingredients": [
          "ekmek",
          "kaşar",
          "salam",
          "domates"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri"
        ],
        "calories": 480,
        "prepMinutes": 5,
        "tags": [
          "hizli",
          "ekonomik",
          "acisiz"
        ]
      }
    ]
  },
  {
    "id": "r23",
    "name": "Çınar Börek & Güveç",
    "cuisine": "Kahvaltı & Börek",
    "image": "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=500&auto=format&fit=crop&q=80",
    "rating": 4.0,
    "deliveryMinutes": 20,
    "distanceKm": 1.5,
    "priceLevel": 1,
    "tags": [
      "borek",
      "kahvalti",
      "ev-yemegi",
      "ekonomik"
    ],
    "menu": [
      {
        "id": "m45",
        "name": "Kıymalı Su Böreği",
        "image": "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=500&auto=format&fit=crop&q=80",
        "price": 220,
        "ingredients": [
          "yufka",
          "kıyma",
          "tereyağı"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri",
          "yumurta"
        ],
        "calories": 620,
        "prepMinutes": 8,
        "tags": [
          "doyurucu",
          "halal",
          "acisiz"
        ]
      },
      {
        "id": "m46",
        "name": "Peynirli Börek",
        "image": "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=500&auto=format&fit=crop&q=80",
        "price": 185,
        "ingredients": [
          "yufka",
          "beyaz peynir",
          "maydanoz"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri",
          "yumurta"
        ],
        "calories": 540,
        "prepMinutes": 7,
        "tags": [
          "vejetaryen",
          "acisiz"
        ]
      }
    ]
  },
  {
    "id": "r24",
    "name": "Meşhur Sarıyer Börekçisi",
    "cuisine": "Kahvaltı & Börek",
    "image": "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=500&auto=format&fit=crop&q=80",
    "rating": 5.0,
    "deliveryMinutes": 13,
    "distanceKm": 0.9,
    "priceLevel": 2,
    "tags": [
      "borek",
      "kahvalti",
      "hizli",
      "ev-yemegi"
    ],
    "menu": [
      {
        "id": "m47",
        "name": "Sarıyer Su Böreği",
        "image": "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=500&auto=format&fit=crop&q=80",
        "price": 240,
        "ingredients": [
          "yufka",
          "beyaz peynir",
          "tereyağı"
        ],
        "allergens": [
          "gluten",
          "süt ürünleri",
          "yumurta"
        ],
        "calories": 610,
        "prepMinutes": 7,
        "tags": [
          "vejetaryen",
          "acisiz"
        ]
      },
      {
        "id": "m48",
        "name": "Patatesli Börek",
        "image": "https://images.unsplash.com/photo-1608039755401-742074f0548d?w=500&auto=format&fit=crop&q=80",
        "price": 195,
        "ingredients": [
          "yufka",
          "patates",
          "baharat"
        ],
        "allergens": [
          "gluten"
        ],
        "calories": 520,
        "prepMinutes": 7,
        "tags": [
          "vejetaryen",
          "vegan",
          "az-acili"
        ]
      }
    ]
  }
];

const USER = {
  "id": "u1",
  "name": "Baki Er",
  "declaredPreferences": {
    "dietStyle": "vejetaryen",
    /* Diyet süzmesi geçici olarak kapatılabilir; alerjen koruması bundan
       etkilenmez, her koşulda uygulanır. */
    "dietFilterActive": true,
    "allergensToAvoid": ["yer fıstığı"],
    "dislikes": ["acı"],
    "notes": "Akşamları hafif, öğle araları doyurucu tercih eder."
  },
  "orderHistory": [
    { "restaurant": "Yeşil Kase", "item": "Quinoa & Avokado Kase", "priceTRY": 165, "dayPart": "akşam", "daysAgo": 2 },
    { "restaurant": "Zeytin Sofrası", "item": "Mercimek Köftesi Tabağı", "priceTRY": 120, "dayPart": "akşam", "daysAgo": 5 },
    { "restaurant": "Dürüm Ustası", "item": "Falafel Dürüm (Vegan)", "priceTRY": 110, "dayPart": "öğle", "daysAgo": 6 },
    { "restaurant": "Yeşil Kase", "item": "Izgara Somon Kase", "priceTRY": 420, "dayPart": "akşam", "daysAgo": 9 },
    { "restaurant": "Zeytin Sofrası", "item": "Zeytinyağlı Taze Fasulye", "priceTRY": 145, "dayPart": "akşam", "daysAgo": 12 }
  ],
  "popularNearbyFallback": [
    { "restaurant": "Zeytin Sofrası", "item": "Mercimek Köftesi Tabağı", "reason": "Bölgede son 7 günün en çok sipariş edileni" },
    { "restaurant": "Dürüm Ustası", "item": "Acılı Adana Dürüm", "reason": "Akşam saatlerinde en popüler seçim" }
  ],
  "orbitPay": {
    "balanceTRY": 340,
    /* Otomatik yükleme, saklı karttan tekrarlayan çekim talimatıdır:
       varsayılan kapalı, kullanıcı açık rıza vermeden çalışmaz. */
    "autoTopUpConsent": false,
    "activeCampaign": {
      "title": "Orbit Pay ile öde, tier bonusunu kap",
      "detail": "Orbit Pay ile ödediğin siparişlerde kanal kazanımının üstüne sabit tier bonusu eklenir.",
      "capTRY": 50
    }
  },
  /* Orbit Grow — 3 aylık kümülatif hacim + KYC + kıdem modeli.
     Tier artık burada sabit yazılmıyor; computeTier() ile bu alanlardan türetiliyor. */
  "orbitGrow": {
    "kycVerified": true,
    /* Base: Orbit Mart'a giriş · Plus: Mart'ta aktiflik */
    "martAccountOpen": true,
    "martOrders90d": 6,
    "standingOrders": 0,
    "accountCreatedAt": "2025-12-20",
    "currentMonth": "Ağustos 2026",
    "daysLeftInMonth": 13,
    "cashbackEarned90d": 270.0,
    /* Son 90 günün haftalık nakit iade dökümü — profildeki mini grafiği besler.
       Toplamı cashbackEarned90d ile birebir eşleşir (9.000 TL x %3 = 270,00 TL). */
    "cashbackWeekly": [
      { "start": "2026-06-01", "amount": 12.0 },
      { "start": "2026-06-08", "amount": 17.1 },
      { "start": "2026-06-15", "amount": 7.9 },
      { "start": "2026-06-22", "amount": 22.7 },
      { "start": "2026-06-29", "amount": 19.2 },
      { "start": "2026-07-06", "amount": 27.2 },
      { "start": "2026-07-13", "amount": 14.9 },
      { "start": "2026-07-20", "amount": 24.3 },
      { "start": "2026-07-27", "amount": 34.3 },
      { "start": "2026-08-03", "amount": 29.4 },
      { "start": "2026-08-10", "amount": 31.6 },
      { "start": "2026-08-17", "amount": 29.4 }
    ],
    "rolling90DaySpend": {
      "totalAnyMethod": 11000,
      "payWalletOnly": 9000
    },
    "monthlyUnconditionalRefund": {
      "usedThisMonth": false,
      "resetsOn": "2026-09-01"
    }
  },
  "context": {
    "city": "İstanbul",
    get weather() {
      if (typeof STATE !== "undefined" && STATE && STATE.activeScenario) {
        if (STATE.activeScenario === "sabah") return "taze sabah havası";
        if (STATE.activeScenario === "ogle") return "güneşli öğlen havası";
        if (STATE.activeScenario === "aksam") return "keyifli akşam havası";
        if (STATE.activeScenario === "dogumgunu") return "kutlama havası";
        if (STATE.activeScenario === "mac") return "maç heyecanı";
      }
      const h = new Date().getHours();
      return (h >= 6 && h < 18) ? "güneşli" : "açık";
    },
    get timeOfDay() {
      if (typeof STATE !== "undefined" && STATE && STATE.activeScenario) {
        if (STATE.activeScenario === "sabah") return "sabah";
        if (STATE.activeScenario === "ogle") return "öğle";
        if (STATE.activeScenario === "aksam") return "akşam";
        if (STATE.activeScenario === "dogumgunu") return "doğum günü";
        if (STATE.activeScenario === "mac") return "maç günü";
      }
      const h = new Date().getHours();
      if (h >= 5 && h < 11) return "sabah";
      if (h >= 11 && h < 16) return "öğle";
      if (h >= 16 && h < 22) return "akşam";
      return "gece";
    },
    get localHour() {
      if (typeof STATE !== "undefined" && STATE && STATE.activeScenario) {
        if (STATE.activeScenario === "sabah") return 8;
        if (STATE.activeScenario === "ogle") return 13;
        if (STATE.activeScenario === "aksam") return 19;
        if (STATE.activeScenario === "gece") return 23;
      }
      return new Date().getHours();
    }
  }
};

const DETAILED_ORDERS = [
  {
    "id": "ord-104",
    "date": "18 Ağustos 2026, 19:15",
    "timestamp": 1787061300000,
    "storeName": "Yeşil Kase",
    "storeType": "Orbit Eats",
    "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80",
    "status": "active",
    "statusText": "🚀 Yolda (12 dk içinde kapında)",
    "itemsSummary": "1x Quinoa & Avokado Kase, 1x Taze Sıkma Portakal Suyu",
    "items": [
      { "name": "Quinoa & Avokado Kase", "qty": 1, "price": 165 },
      { "name": "Taze Sıkma Portakal Suyu", "qty": 1, "price": 45 }
    ],
    "totalPrice": "210,00 TL",
    "totalTRY": 210,
    "vertical": "eats",
    "payMethod": "orbitpay_wallet",
    "paymentMethod": "Orbit Pay Cüzdanı",
    "tierAtOrder": "Plus"
  },
  {
    "id": "ord-103",
    "date": "14 Ağustos 2026, 16:41",
    "timestamp": 1786696860000,
    "storeName": "Pizza Bulls",
    "storeType": "Orbit Eats",
    "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80",
    "status": "completed",
    "statusText": "✓ Teslim Edildi",
    "itemsSummary": "Büyük Boy Pizza + 2 Adet Sos",
    "items": [
      { "name": "Büyük Boy Karışık Pizza", "qty": 1, "price": 699.90 },
      { "name": "2x Sarımsaklı Sos", "qty": 1, "price": 60.00 }
    ],
    "totalPrice": "759,90 TL",
    "totalTRY": 759.9,
    "vertical": "eats",
    "payMethod": "orbitpay_wallet",
    "paymentMethod": "Orbit Pay Cüzdanı",
    "tierAtOrder": "Plus"
  },
  {
    "id": "ord-102",
    "date": "08 Ağustos 2026, 20:05",
    "timestamp": 1786190700000,
    "storeName": "Focus Burger & Gurme Mutfak",
    "storeType": "Orbit Eats",
    "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80",
    "status": "completed",
    "statusText": "✓ Teslim Edildi",
    "itemsSummary": "Trüf Cheddarlı Burger (150 gr.) + Patates",
    "items": [
      { "name": "Trüf Cheddarlı Burger Menu", "qty": 1, "price": 525.00 },
      { "name": "Çıtır Soğan Halkası (6 Adet)", "qty": 1, "price": 100.00 }
    ],
    "totalPrice": "625,00 TL",
    "totalTRY": 625,
    "vertical": "mart",
    "payMethod": "orbitpay_wallet",
    "paymentMethod": "Orbit Pay Cüzdanı",
    "tierAtOrder": "Plus"
  },
  {
    "id": "ord-101",
    "date": "03 Ağustos 2026, 13:41",
    "timestamp": 1785745260000,
    "storeName": "Adile Sultan Ev Yemekleri",
    "storeType": "Orbit Eats",
    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
    "status": "completed",
    "statusText": "✓ Teslim Edildi",
    "itemsSummary": "Zeytinyağlı Enginar Tabağı + Su Böreği",
    "items": [
      { "name": "Zeytinyağlı Enginar Tabağı", "qty": 1, "price": 280.00 },
      { "name": "Peynirli Su Böreği (Dilim)", "qty": 1, "price": 200.00 }
    ],
    "totalPrice": "480,00 TL",
    "totalTRY": 480,
    "vertical": "eats",
    "payMethod": "card",
    "paymentMethod": "Kredi Kartı (•••• 4821)",
    "tierAtOrder": "Plus"
  }
];

/* Restoran finansmanlı kampanyalar: menü kalemi -> indirim yüzdesi.
   Kalemin "price" alanı kampanyalı (ödenen) fiyattır; üstü çizili fiyat
   buradan geri hesaplanır, böylece sepet ve ödeme tutarları tutarlı kalır. */
const MENU_CAMPAIGNS = {
  m1: 20, m2: 15, m3: 25, m4: 20, m5: 30, m6: 15,
  m7: 20, m8: 25, m9: 20, m10: 15, m11: 25, m12: 20,
  m13: 30, m14: 15, m15: 20, m16: 25, m17: 20, m18: 15,
  m19: 25, m20: 20, m21: 30, m22: 15, m23: 20, m24: 25,
  m25: 20, m26: 15, m27: 25, m28: 20, m29: 30, m30: 15,
  m31: 20, m32: 25, m33: 20, m34: 15, m35: 25, m36: 20,
  m37: 30, m38: 15, m39: 20, m40: 25, m41: 20, m42: 15,
  m43: 25, m44: 20, m45: 30, m46: 15, m47: 20, m48: 25
};

/* Kampanyalı kalem için indirim öncesi liste fiyatı (5 TL'ye yuvarlanır) */
function listPriceFor(itemId, paidPrice) {
  const pct = MENU_CAMPAIGNS[itemId];
  if (!pct || !paidPrice) return null;
  return Math.round(paidPrice / (1 - pct / 100) / 5) * 5;
}

/* Hafta etiketleri: "17 Ağu" (eksen) ve "17–23 Ağu" (ipucu) */
const TR_AYLAR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
function weekAxisLabel(startISO) {
  const d = new Date(startISO + "T00:00:00");
  return d.getDate() + " " + TR_AYLAR[d.getMonth()];
}
function weekRangeLabel(startISO) {
  const a = new Date(startISO + "T00:00:00");
  const b = new Date(a.getTime() + 6 * 86400000);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${TR_AYLAR[b.getMonth()]}`
    : `${a.getDate()} ${TR_AYLAR[a.getMonth()]} – ${b.getDate()} ${TR_AYLAR[b.getMonth()]}`;
}
