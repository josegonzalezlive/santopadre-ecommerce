// catalog.js — SantoPadre® Full Source of Truth
const CATALOG = {
  categories: [
    {
      id: "entrantes",
      name: "Entrantes",
      emoji: "🌯",
      subtitle: "Lo que pides mientras decides cuántos pecados más vas a cometer.",
      items: [
        {
          id: "flauta-cochinita",
          name: "Flauta de Cochinita (6U)",
          description: "Tortilla de maíz frita rellena de cochinita pibil al horno, queso fundido, crema y cilantro. Crujen tanto que tus vecinos de mesa sabrán exactamente qué estás comiendo.",
          allergens: "Lácteos, Glúten (trazas)",
          image: "assets/menu/flauta-cochinita.avif",
          hasVariants: true,
          variants: [
            { id: "v1", name: "Ración 6 Unidades", price: 12.00 },
            { id: "v2", name: "Ración 12 Unidades", price: 21.00, recommended: true, recommendedLabel: "Ideal para compartir" },
            { id: "v3", name: "Bandeja Fiesta 24U", price: 38.00, recommendedLabel: "Mejor Valor" }
          ],
          badges: ["NUEVO"],
          tags: ["💎 PREMIUM", "🔥 CRUNCH EXTRA", "🐷 COCCIÓN LENTA"],

          spicyLevel: 1,
          hasExtras: true
        },
        {
          id: "flauta-pollo",
          name: "Flauta de Pollo",
          description: "Pollo desmechado sin dramas, queso amarillo, crema y cilantro sobre tortilla de maíz frita. El clásico infalible.",
          allergens: "Lácteos, Glúten (trazas)",
          image: "assets/menu/flauta-pollo.avif",
          hasVariants: true,
          variants: [
            { id: "v1", name: "Ración 6 Unidades", price: 10.50 },
            { id: "v2", name: "Ración 12 Unidades", price: 18.00, recommended: true, recommendedLabel: "Upsell Sugerido" },
            { id: "v3", name: "Bandeja Fiesta 24U", price: 34.00, recommendedLabel: "Mejor Valor" }
          ],
          badges: [],
          tags: ["⭐ EL CLÁSICO", "✅ OPCIÓN SEGURA", "🧀 QUESO FUNDIDO"],

          spicyLevel: 0,
          hasExtras: true
        },

        {
          id: "nachos",
          name: "Nachos",
          description: "Una montaña de totopos bajo carne chilli, cheddar, pico de gallo, guacamole y nata. Tienen alma y probablemente manchen tu camisa blanca.",
          allergens: "Lácteos",
          image: "assets/menu/nachos.avif",
          hasVariants: true,
          variants: [
            { id: "v1", name: "Tamaño Pequeño (PEQ)", price: 7.25 },
            { id: "v2", name: "Tamaño Grande (GDE)", price: 14.50, recommended: true, recommendedLabel: "Recomendado 2+ personas" }
          ],
          badges: [],
          tags: ["🏔️ TAMAÑO ÉPICO", "🥑 GUACAMOLE REAL", "🌶️ NIVEL CHILLI: PRO"],
          hasExtras: true
        }
      ]
    },
    {
      id: "taqueria",
      name: "Taquería",
      emoji: "🌮",
      subtitle: "La base de nuestra fe. Tres unidades por orden. 100% Maíz.",
      items: [
        {
          id: "tacos-pastor",
          name: "Tacos al Pastor (3U)",
          description: "Cerdo marinado al pastor, cebolla, cilantro y piña asada. El equilibrio sagrado.",
          allergens: "Ninguno (100% Maíz)",
          image: "assets/menu/tacos-pastor.avif",
          price: 11.50,
          badges: ["EL MÁS VENDIDO"],
          tags: ["👑 EL REY", "🍍 TOQUE ASADO", "🌽 100% MAÍZ"],
          hasExtras: true
        },
        {
          id: "tacos-carne",
          name: "Tacos de Carne (3U)",
          description: "Punta trasera marinada de la buena, cebolla y cilantro. Simple, directo, perfecto.",
          allergens: "Ninguno",
          image: "assets/menu/tacos-de-carne.webp?v=5",
          video: "assets/video/tacos-de-carne.mov?v=5",
          videoFit: "contain",
          videoAspect: "3 / 2",
          price: 12.50,
          badges: [],
          tags: ["🥩 CORTE PREMIUM", "💪 PROTEÍNA TOP", "🔥 SABOR A BRASA"],
          hasExtras: true
        },
        {
          id: "tacos-pollo",
          name: "Tacos de Pollo (3U)",
          description: "Pollo marinado con nuestra receta secreta, cebolla y cilantro.",
          allergens: "Ninguno",
          image: "assets/menu/tacos-de-pollo.webp?v=5",
          video: "assets/video/tacos-de-pollo.mov?v=5",
          videoFit: "contain",
          videoAspect: "3 / 2",
          price: 11.00,
          badges: [],
          tags: ["🌿 LIGERO", "🍗 RECETA SECRETA", "📉 OPCIÓN ECONÓMICA"],
          hasExtras: true
        },
        {
          id: "tacos-birria",
          name: "Tacos de Birria (3U)",
          description: "Queso fundido, carne de res adobada hecha a fuego lento, cebolla y cilantro. Incluye consomé.",
          allergens: "Lácteos",
          image: "assets/menu/tacos-birria.avif",
          price: 12.50,
          badges: ["FAVORITO"],
          tags: ["🥘 ARTESANAL", "🧀 EXTRA QUESO", "✨ RECOMENDACIÓN DEL CHEF"],
          hasExtras: true
        },
        {
          id: "tacos-cochinita",
          name: "Tacos de Cochinita (3U)",
          description: "Cerdo marinado hecho a fuego lento, cebollas moradas encurtidas y cilantro. Una oda a Yucatán.",
          allergens: "Sulfitos",
          video: "https://res.cloudinary.com/dxishpwhl/video/upload/w_720,q_auto,f_auto,ac_none/Tacos_de_cochinita_h7kdms.mp4",
          price: 11.50,
          badges: ["TOP DEL MES"],
          tags: ["🔥 TENDENCIA", "🧅 ACIDITO PERFECTO", "🧪 SABOR INTENSO"],
          hasExtras: true
        }
      ]
    },
    {
      id: "especialidades",
      name: "Especialidades",
      emoji: "🥘",
      subtitle: "Para los que no temen ensuciarse las manos por una causa mayor.",
      items: [
        {
          id: "quesadilla-chistorra",
          name: "Quesadilla de Chistorra",
          description: "Tortilla de harina rellena de chistorra jugosa y queso fundido, bañada en mermelada casera de mango y jalapeño. El choque perfecto entre dulce y picante.",
          allergens: "Glúten, Lácteos",
          image: "assets/menu/fajitas.avif",
          video: "assets/video/quesadilla.mp4?v=2",
          price: 14.00,
          badges: ["NUEVO"],
          tags: ["🌶️ DULCE Y PICANTE", "🧀 QUESO FUNDIDO", "🇪🇸 CHISTORRA"],
          hasExtras: true
        },
        {
          id: "fajitas",
          name: "Fajitas (6U)",
          description: "Un festín de lomito y pollo salteado con cebolla y pimentón, tortillas de harina de trigo, pico de gallo, guacamole y queso. Tú las montas.",
          allergens: "Glúten (Trigo), Lácteos",
          image: "assets/menu/fajitas.avif",
          price: 38.00,
          badges: ["NUEVO"],
          tags: ["🛠️ DIY: HAZLO TÚ MISMO", "🍱 BANQUETE COMPLETO", "🥩 LOMITO QUALITY"],
          hasExtras: true
        },
        {
          id: "burritos",
          name: "Burritos",
          description: "Tortilla de trigo de 1kg (aprox) rellena de arroz, pico, frijoles, guacamole y queso. Elige tu proteína.",
          allergens: "Glúten, Lácteos",
          video: "https://res.cloudinary.com/dxishpwhl/video/upload/w_720,q_auto,f_auto,ac_none/Burritos_jnqglx.mp4",
          price: 14.50,
          hasVariants: true,
          variants: [
            { id: "v1", name: "Proteína: Punta Trasera", price: 18.00 },
            { id: "v2", name: "Proteína: Cerdo al Pastor", price: 14.50 },
            { id: "v3", name: "Proteína: Carne Chilli", price: 14.50 },
            { id: "v4", name: "Proteína: Pollo", price: 14.50 },
            { id: "v5", name: "Proteína: Birria", price: 18.00 },
            { id: "v6", name: "Proteína: Cochinita", price: 14.50 }
          ],
          tags: ["🌯 FORMATO XXL", "🔋 ENERGÍA PURA", "🌯 TODO TERRENO"],
          hasExtras: true
        },
        {
          id: "birria-ramen",
          name: "Birria Ramen",
          description: "Fideos ramen en consomé de res de cocción lenta, birria deshebrada, cebolla y cilantro. El abrazo que necesitas.",
          allergens: "Glúten",
          image: "assets/menu/birria-ramen.avif",
          price: 13.50,
          badges: ["TOP TEMPORADA LLUVIA"],
          tags: ["🍜 FUSION STYLE", "🥣 CALDO RECONFORTANTE", "🥄 CUCHARA Y TACO"]
        }
      ]
    },
    {
      id: "bebidas",
      name: "Bebidas",
      emoji: "🥤",
      subtitle: "Hidratación sagrada para apagar el fuego.",
      items: [
        {
          id: "agua",
          name: "Agua",
          description: "Hidratación pura y necesaria para seguir pecando sin dramas.",
          image: "assets/menu/agua.avif",
          hasVariants: true,
          variants: [
            { id: "v1", name: "Botella 600ML", price: 2.00, image: "assets/menu/agua.avif" },
            { id: "v2", name: "Botella 1.5L", price: 3.50, image: "assets/menu/agua.avif" }
          ],
          tags: ["💧 HIDRATACIÓN", "👪 TAMAÑO FAMILIAR", "💰 AHORRA MÁS"]
        },
        { id: "coca-cola", name: "Coca Cola", description: "El clásico carbonatado que no necesita presentación ni perdón.", price: 2.50, image: "assets/menu/coca-cola.avif", tags: ["🧊 BIEN FRÍA"] },
        { id: "cerveza", name: "Cerveza", description: "Una rubia bien fría para apagar el fuego del chile y brindar por la vida.", price: 2.20, video: "https://res.cloudinary.com/dxishpwhl/video/upload/w_720,q_auto,f_auto,ac_none/Cerveza_gzoxky.mp4", tags: ["🍺 MARIDAJE PERFECTO"] },
        { id: "lipton", name: "Lipton", description: "Té frío para los que buscan un poco de calma cítrica en medio del caos.", price: 3.00, image: "assets/menu/lipton.avif", tags: ["🍃 REFRESCANTE"] },
        { id: "gatorade", name: "Gatorade", description: "Electrolitos sagrados para recuperar el alma después de una buena tanda de tacos.", price: 3.20, image: "assets/menu/gatorade.avif", tags: ["⚡ ELECTROLITOS"] }
      ]
    },
    {
      id: "merch",
      name: "Santo Merch",
      emoji: "🧢",
      subtitle: "Viste la fe. Ropa y accesorios oficiales de La Parroquia.",
      items: [
        {
          id: "tshirt-logo",
          name: "Camiseta Classic SantoPadre",
          description: "Algodón premium de 200g. Corte oversize para ocultar los tacos que te acabas de comer. El logo clásico en el pecho.",
          image: "assets/camisa-1.webp",
          price: 25.00,
          hasVariants: true,
          variants: [
            { id: "v1", name: "Talla S", price: 25.00 },
            { id: "v2", name: "Talla M", price: 25.00 },
            { id: "v3", name: "Talla L", price: 25.00 },
            { id: "v4", name: "Talla XL", price: 25.00 }
          ],
          tags: ["👕 OVERSIZE", "🔥 MERCH OFICIAL"]
        },
        {
          id: "tshirt-cochinita",
          name: "Camiseta de Cochinita Araurez",
          description: "Algodón premium de 200g. Ilustración de tacos de cochinita pintada a mano en la espalda, edición Santo Padre Araurez.",
          image: "assets/camisa-cochinita.webp",
          images: ["assets/camisa-cochinita.webp", "assets/camisa-cochinita-2.webp"],
          price: 20.00,
          hasVariants: true,
          variants: [
            { id: "v1", name: "Talla S", price: 20.00 },
            { id: "v2", name: "Talla M", price: 20.00 },
            { id: "v3", name: "Talla L", price: 20.00 },
            { id: "v4", name: "Talla XL", price: 20.00 }
          ],
          tags: ["👕 EDICIÓN LIMITADA", "🔥 MERCH OFICIAL"]
        },
        {
          id: "cap-trucker",
          name: "Gorra Trucker La Parroquia",
          description: "Protege tu cara del sol y tu identidad cuando te escapes a comer. Malla trasera para que respiren las ideas.",
          image: "assets/gorra.webp",
          price: 18.00,
          tags: ["🧢 SNAPBACK", "🔥 MERCH OFICIAL"]
        }
      ]
    },
    {
      id: "condimentos",
      name: "Condimentos",
      emoji: "🌶️",
      subtitle: "Lleva la fe a tu propia cocina. Hechos en casa, sin atajos.",
      items: [
        {
          id: "salsa-picante",
          name: "Salsa Picante",
          description: "Nuestra salsa picante de la casa, hecha en pequeños lotes. El toque final que le faltaba a tus tacos.",
          image: "assets/salsa-picante.webp",
          price: 10.00,
          tags: ["🌶️ HECHO EN CASA", "🔥 EDICIÓN LIMITADA"]
        },
        {
          id: "mermelada-mango-jalapeno",
          name: "Mermelada de Mango y Jalapeño",
          description: "Dulce y picante en perfecto equilibrio. Ideal para acompañar quesos, carnes o para darle vida a tu sandwich.",
          image: "assets/mermelada-mango-jalapeno.webp",
          price: 10.00,
          tags: ["🥭 DULCE Y PICANTE", "🔥 EDICIÓN LIMITADA"]
        }
      ]
    },
    {
      id: "postres",
      name: "Postres",
      emoji: "🧁",
      subtitle: "El cierre perfecto para tu penitencia. Horneados en casa, sin gluten.",
      items: [
        {
          id: "cupcakes-sin-gluten",
          name: "Cupcakes Sin Gluten",
          description: "Cupcakes artesanales sin gluten, horneados en casa. Elige entre chocolate o nuez con arequipe.",
          image: "assets/postres-cupcakes.webp",
          video: "assets/video/cupcakes.mov",
          hasVariants: true,
          variants: [
            { id: "v1", name: "Chocolate", price: 1.50 },
            { id: "v2", name: "Nuez con Arequipe", price: 2.50 }
          ],
          tags: ["🧁 SIN GLUTEN", "🍫🥜 2 SABORES"]
        }
      ]
    },
    {
      id: "regalos",
      name: "Regalos",
      emoji: "🎁",
      subtitle: "Para el pecador que quieres llevar al cielo.",
      items: [
        {
          id: "gift-card-25",
          name: "Gift Card SantoPadre $25",
          description: "Regala $25 de crédito en SantoPadre a quien quieras. Un billete directo a la Parroquia.",
          image: "assets/menu/gift-card-25.avif",
          price: 25.00,
          tags: ["🎁 REGALO PERFECTO", "✉️ ENVÍO DIGITAL"]
        },
        {
          id: "gift-card-50",
          name: "Gift Card SantoPadre $50",
          description: "Regala $50 de crédito en SantoPadre a quien quieras. Un billete directo a la Parroquia.",
          image: "assets/menu/gift-card-50.avif",
          price: 50.00,
          tags: ["🎁 REGALO PERFECTO", "✉️ ENVÍO DIGITAL"]
        },
        {
          id: "pase-corporativo",
          name: "Pase Corporativo",
          description: "Saldo prepago exclusivo para empresas. Alimenta a tu equipo con facturación consolidada y ahorra en cada bocado.",
          image: "assets/menu/pase-corporativo.avif",
          price: 150.00,
          tags: ["💼 B2B", "📈 AHORRO EMPRESARIAL"]
        }
      ]
    }
  ],
  extras: {
    individual: {
      label: "Extras Individuales",
      price: 0.90,
      options: [
        "Guacamole", "Queso amarillo", "Queso fundido", "Tortillas (Extra)",
        "Cebollas encurtidas", "Salsa roja", "Piña asada", "Crema de leche",
        "Pico de gallo", "Salsa verde"
      ]
    },
    protein: {
      label: "Extra de Proteína (Doble carne)",
      price: 5.00,
      options: [
        "Punta trasera", "Cerdo al pastor", "Carne chilli",
        "Pollo marinado", "Birria", "Cochinita"
      ]
    }
  },
  upsellProducts: [
    { id: "agua", label: "¿Un agua mineral?", price: 2.00, image: "assets/menu/agua.avif" },
    { id: "coca-cola", label: "¿Le añades una Coca Cola?", price: 2.50, image: "assets/menu/coca-cola.avif" },
    { id: "lipton", label: "¿Un Lipton frío?", price: 3.00, image: "assets/menu/lipton.avif" },
    { id: "gatorade", label: "¿Gatorade para reponer?", price: 3.20, image: "assets/menu/gatorade.avif" },
    { id: "nachos", label: "¿Y unos Nachos para acompañar?", price: 7.25, image: "assets/menu/nachos.avif" }
  ],
  reviews: [
    { quote: "Es el mejor delivery de Araure. La comida llega caliente y las flautas de cochinita son increíblemente crujientes. Comida mexicana auténtica.", author: "Daniela", productId: "flauta-cochinita", rating: 5 },
    { quote: "Atención rápida y aceptan múltiples métodos de pago como Zelle y USDT. Los mejores tacos de Acarigua sin duda.", author: "Ricardo", productId: "tacos-birria", rating: 5 },
    { quote: "Los Burritos son formato XXL de verdad, un ladrillo de sabor. Excelente relación calidad-precio para eventos en Araure.", author: "Sofía", productId: "burritos", rating: 4.5 },
    { quote: "El Birria Ramen es una locura gourmet. Caldo espeso y sabor real mexicano en Portuguesa.", author: "Carlos", productId: "birria-ramen", rating: 5 },
    { quote: "Los contratamos para un evento de oficina y superaron por mucho los típicos pasapalos de siempre. El mejor catering corporativo.", author: "La manguera S.A.", productId: "fajitas", rating: 5 },
    { quote: "La punta trasera de los tacos es mantequilla pura. El secreto mejor guardado de Araure y Acarigua.", author: "@Kerlis", productId: "tacos-carne", rating: 4.5 },
    { quote: "Los Tacos al Pastor con la piña asada... el equilibrio es sagrado. Mi nuevo lugar favorito en Araure.", author: "Andrés", productId: "tacos-pastor", rating: 5 }
  ],

  faq: [
    { q: "¿QUÉ PASA SI MI PEDIDO NO LLEGA?", a: "Nosotros controlamos cada gramo hasta que sale. Una vez fuera, el destino (y el tráfico) manda. Rezamos por ti." },
    { q: "¿CÓMO PUEDO PAGAR MI PENITENCIA?", a: "Pago Móvil, Zelle, Bizum, USDT, BoA. Aceptamos casi todo menos promesas vacías. Tasa BCV siempre." },
    { q: "TENGO ALERGIAS.", a: "Cada ficha detalla los alérgenos. Míralos antes de pecar para evitar el 112." },
    { q: "¿HACEN RESERVAS?", a: "No. Aquí es venir, ver y comer. Si hay sitio pasas, si no, la espera vale la pena." },
    { q: "¿PUEDO LLEVÁRMELO?", a: "Puedes venir y llevártelo todo, menos al camarero (por muy bueno que sea). Todo lo demás es tuyo para que lo disfrutes donde quieras." },
    { q: "¿PUEDO VENIR CON MI PERRO?", a: "Somos pet friendly. Incluso a nuestro CM le dejamos entrar. Llévalo atado por favor." },
    { q: "QUIERO SENTARME Y COMER AHÍ.", a: "Eres bienvenido a nuestra casa. Tenemos zona de dine-in, pero recuerda: siempre que haya sitio. Ven con tiempo." },
    { q: "¿Y CON EL GLUTEN QUÉ HAGO?", a: "Ya es una realidad. Tenemos opciones con un sabor tan real como la receta original, pero sin gluten. El celíaco también tiene derecho a ir al cielo de los tacos." },
    { q: "¿CÓMO CONTACTO CON USTEDES?", a: "Nuestro Community Manager lo resuelve todo. Contacta por Instagram o envía un mail a hola@santopadre.com." },
    { q: "TENGO UNA IDEA LOCA.", a: "Somos más que una taquería, somos modernidad. Si tienes algo que nos vuele la cabeza: hola@santopadre.com." },
    { q: "QUIERO HACER UN PEDIDO MUY GRANDE.", a: "Si quieres impresionar a tu empresa o equipo con un pedido masivo, completa nuestro formulario en https://form.typeform.com/to/bNVBTmFR y te ayudaremos a gestionar tu banquete." }
  ],
  loyaltyProgram: {
    points: {
      earningRate: 10,
      rewards: [
        { points: 1000, label: "Bebida Gratis a Elección" },
        { points: 3500, label: "Nachos Pequeños Gratis" },
        { points: 7500, label: "Flautas de Pollo (6U) Gratis" }
      ]
    },
    stampCard: {
      name: "El Ascenso del Pecador",
      totalStamps: 5,
      stampsPerTier: 5,
      totalTiers: 5,
      minTicket: 12.00,
      milestones: [
        { tier: 1, name: "El Iniciado", reward: "Bebida Premium Gratis", cogs: 0.75 },
        { tier: 2, name: "El Fiel", reward: "Postre Sorpresa del Chef", cogs: 1.20 },
        { tier: 3, name: "El Discípulo", reward: "Nachos PEQ + Bebida Gratis", cogs: 2.93 },
        { tier: 4, name: "El Profeta", reward: "Tacos (3U) + Bebida Gratis", cogs: 4.20 },
        { tier: 5, name: "El Santo", reward: "Cena Secreta para 2 + 2 Bebidas", cogs: 3.00 }
      ]
    },
    referrals: {
      headline: "Salva a un amigo del hambre",
      friendReward: "Bebida Gratis (En su primer pedido > $15)",
      referrerReward: "200 $PADRE",
      friendCogs: 0.75,
      referrerCogs: 0
    }
  },
  info: {
    whatsapp: "584225540246",
    hours: "7:30 PM - 10:30 PM · Lunes a Sábado",
    location: "Araure, Venezuela",
    tagline: "Limpia tu conciencia, la mancha de grasa es permanente."
  }
};
