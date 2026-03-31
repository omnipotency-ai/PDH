// ============================================================
// FOOD TRANSIT MAP — DATA LAYER v2
// Design: Dark Metro Cartography — pastel stations on dark bg
// Hierarchy: Main categories > Sub-lines > Zones > Tracks > Stations
// ============================================================

export type FoodStatus = "untested" | "testing" | "safe" | "watch" | "avoid";

export interface Station {
  id: string;
  name: string;
  preparation: string;
  status: FoodStatus;
  isCurrent?: boolean;
  emoji?: string;
}

export interface Track {
  id: string;
  label?: string;
  stations: Station[];
}

export interface Zone {
  id: string;
  name: string;
  shortName: string;
  description: string;
  tracks: Track[];
}

export interface SubLine {
  id: string;
  name: string;
  /** Pastel line colour (for dark background) */
  color: string;
  zones: Zone[];
}

export interface MainCategory {
  id: string;
  name: string;
  /** Accent colour for the category tab */
  accentColor: string;
  subLines: SubLine[];
}

// ── Status colours (pastel-friendly on dark bg) ───────────────
export const STATUS_COLORS: Record<FoodStatus, string> = {
  untested: "#64748b", // slate — not yet reached
  testing: "#60a5fa", // sky blue — currently trialing
  safe: "#4ade80", // soft green — passed safely
  watch: "#fbbf24", // amber — caused mild upset
  avoid: "#f87171", // soft red — caused bad reaction
};

export const STATUS_LABELS: Record<FoodStatus, string> = {
  untested: "Not yet reached",
  testing: "Currently trialing",
  safe: "Safe ✓",
  watch: "Watch — mild reaction",
  avoid: "Avoid for now",
};

// ── Pastel line colours for dark background ───────────────────
// These are soft, luminous pastels that read well on #1a1f2e

// ============================================================
// MAIN CATEGORIES
// ============================================================

export const MAIN_CATEGORIES: MainCategory[] = [
  // ── CARBOHYDRATES ──────────────────────────────────────────
  {
    id: "carbs",
    name: "Carbohydrates",
    accentColor: "#a3e635",
    subLines: [
      {
        id: "vegetables",
        name: "Vegetables",
        color: "#86efac", // pastel green
        zones: [
          {
            id: "veg-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Mashed & puréed · Days 14–21",
            tracks: [
              {
                id: "veg-z1-main",
                stations: [
                  {
                    id: "v1",
                    name: "Potatoes",
                    preparation: "Mashed & peeled",
                    status: "safe",
                    emoji: "🥔",
                  },
                  {
                    id: "v2",
                    name: "Carrots",
                    preparation: "Mashed & peeled",
                    status: "safe",
                    emoji: "🥕",
                  },
                  {
                    id: "v3",
                    name: "Zucchini",
                    preparation: "Mashed & peeled",
                    status: "safe",
                    emoji: "🥒",
                  },
                  {
                    id: "v4",
                    name: "Sweet Potato",
                    preparation: "Mashed & peeled",
                    status: "watch",
                    emoji: "🍠",
                  },
                  {
                    id: "v5",
                    name: "Pumpkin",
                    preparation: "Mashed & peeled",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🎃",
                  },
                ],
              },
            ],
          },
          {
            id: "veg-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Boiled to softness · Weeks 4–10",
            tracks: [
              {
                id: "veg-z2-top",
                label: "Previously safe, now boiled",
                stations: [
                  {
                    id: "v6",
                    name: "Potatoes",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥔",
                  },
                  {
                    id: "v7",
                    name: "Carrots",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥕",
                  },
                  {
                    id: "v8",
                    name: "Zucchini",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥒",
                  },
                  {
                    id: "v9",
                    name: "Sweet Potato",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🍠",
                  },
                  {
                    id: "v10",
                    name: "Pumpkin",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🎃",
                  },
                ],
              },
              {
                id: "veg-z2-bottom",
                label: "New vegetables to trial",
                stations: [
                  {
                    id: "v11",
                    name: "Broccoli",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥦",
                  },
                  {
                    id: "v12",
                    name: "Cauliflower",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥦",
                  },
                  {
                    id: "v13",
                    name: "Spinach",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "v14",
                    name: "Eggplant",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🍆",
                  },
                  {
                    id: "v15",
                    name: "Mixed Greens",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥬",
                  },
                ],
              },
            ],
          },
          {
            id: "veg-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All preparation methods · Ongoing",
            tracks: [
              {
                id: "veg-z3-raw",
                label: "Raw",
                stations: [
                  {
                    id: "v16",
                    name: "Cucumber",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🥒",
                  },
                  {
                    id: "v17",
                    name: "Lettuce",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🥬",
                  },
                  {
                    id: "v18",
                    name: "Tomato",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🍅",
                  },
                ],
              },
              {
                id: "veg-z3-baked",
                label: "Baked",
                stations: [
                  {
                    id: "v19",
                    name: "Potatoes",
                    preparation: "Baked",
                    status: "untested",
                    emoji: "🥔",
                  },
                  {
                    id: "v20",
                    name: "Zucchini",
                    preparation: "Baked",
                    status: "untested",
                    emoji: "🥒",
                  },
                  {
                    id: "v21",
                    name: "Capsicum",
                    preparation: "Baked",
                    status: "untested",
                    emoji: "🫑",
                  },
                ],
              },
              {
                id: "veg-z3-stirfried",
                label: "Stir-Fried",
                stations: [
                  {
                    id: "v22",
                    name: "Bok Choy",
                    preparation: "Stir-fried",
                    status: "untested",
                    emoji: "🥬",
                  },
                  {
                    id: "v23",
                    name: "Mushrooms",
                    preparation: "Stir-fried",
                    status: "untested",
                    emoji: "🍄",
                  },
                  {
                    id: "v24",
                    name: "Snap Peas",
                    preparation: "Stir-fried",
                    status: "untested",
                    emoji: "🫛",
                  },
                ],
              },
              {
                id: "veg-z3-deepfried",
                label: "Deep-Fried",
                stations: [
                  {
                    id: "v25",
                    name: "Zucchini Chips",
                    preparation: "Deep-fried",
                    status: "untested",
                    emoji: "🥒",
                  },
                  {
                    id: "v26",
                    name: "Onion Rings",
                    preparation: "Deep-fried",
                    status: "untested",
                    emoji: "🧅",
                  },
                  {
                    id: "v27",
                    name: "Tempura Veg",
                    preparation: "Deep-fried",
                    status: "untested",
                    emoji: "🍤",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "fruit",
        name: "Fruit",
        color: "#f9a8d4", // pastel pink
        zones: [
          {
            id: "fruit-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Puréed only · Days 14–21",
            tracks: [
              {
                id: "fruit-z1-main",
                stations: [
                  { id: "f1", name: "Banana", preparation: "Puréed", status: "safe", emoji: "🍌" },
                  {
                    id: "f2",
                    name: "Apple",
                    preparation: "Puréed, no skin",
                    status: "safe",
                    emoji: "🍎",
                  },
                  {
                    id: "f3",
                    name: "Pear",
                    preparation: "Puréed, no skin",
                    status: "watch",
                    emoji: "🍐",
                  },
                ],
              },
            ],
          },
          {
            id: "fruit-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft & stewed · Weeks 4–10",
            tracks: [
              {
                id: "fruit-z2-top",
                label: "Stewed fruits",
                stations: [
                  {
                    id: "f4",
                    name: "Apple",
                    preparation: "Stewed",
                    status: "untested",
                    emoji: "🍎",
                  },
                  {
                    id: "f5",
                    name: "Pear",
                    preparation: "Stewed",
                    status: "untested",
                    emoji: "🍐",
                  },
                  {
                    id: "f6",
                    name: "Peach",
                    preparation: "Stewed",
                    status: "untested",
                    emoji: "🍑",
                  },
                  {
                    id: "f7",
                    name: "Mango",
                    preparation: "Soft, ripe",
                    status: "untested",
                    emoji: "🥭",
                  },
                ],
              },
              {
                id: "fruit-z2-bottom",
                label: "New soft fruits",
                stations: [
                  {
                    id: "f8",
                    name: "Melon",
                    preparation: "Soft, ripe",
                    status: "untested",
                    emoji: "🍈",
                  },
                  {
                    id: "f9",
                    name: "Papaya",
                    preparation: "Ripe",
                    status: "untested",
                    emoji: "🍈",
                  },
                  {
                    id: "f10",
                    name: "Kiwi",
                    preparation: "No seeds",
                    status: "untested",
                    emoji: "🥝",
                  },
                  {
                    id: "f11",
                    name: "Grapes",
                    preparation: "Peeled",
                    status: "untested",
                    emoji: "🍇",
                  },
                ],
              },
            ],
          },
          {
            id: "fruit-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All forms · Ongoing",
            tracks: [
              {
                id: "fruit-z3-raw",
                label: "Raw",
                stations: [
                  {
                    id: "f12",
                    name: "Strawberry",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🍓",
                  },
                  {
                    id: "f13",
                    name: "Blueberry",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🫐",
                  },
                  {
                    id: "f14",
                    name: "Orange",
                    preparation: "Segments",
                    status: "untested",
                    emoji: "🍊",
                  },
                ],
              },
              {
                id: "fruit-z3-dried",
                label: "Dried",
                stations: [
                  {
                    id: "f15",
                    name: "Raisins",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🍇",
                  },
                  {
                    id: "f16",
                    name: "Apricot",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🍑",
                  },
                  {
                    id: "f17",
                    name: "Prunes",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🟣",
                  },
                ],
              },
              {
                id: "fruit-z3-juice",
                label: "Juice",
                stations: [
                  {
                    id: "f18",
                    name: "Apple Juice",
                    preparation: "Diluted",
                    status: "untested",
                    emoji: "🍎",
                  },
                  {
                    id: "f19",
                    name: "Orange Juice",
                    preparation: "Diluted",
                    status: "untested",
                    emoji: "🍊",
                  },
                  {
                    id: "f20",
                    name: "Grape Juice",
                    preparation: "Diluted",
                    status: "untested",
                    emoji: "🍇",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "grains",
        name: "Grains & Cereals",
        color: "#fde68a", // pastel yellow
        zones: [
          {
            id: "grains-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Smooth & puréed · Days 14–21",
            tracks: [
              {
                id: "grains-z1-main",
                stations: [
                  {
                    id: "g1",
                    name: "White Rice",
                    preparation: "Overcooked, mushy",
                    status: "safe",
                    emoji: "🍚",
                  },
                  {
                    id: "g2",
                    name: "Oat Porridge",
                    preparation: "Smooth, no lumps",
                    status: "safe",
                    emoji: "🥣",
                  },
                  {
                    id: "g3",
                    name: "White Bread",
                    preparation: "Soaked in broth",
                    status: "watch",
                    emoji: "🍞",
                  },
                  {
                    id: "g4",
                    name: "Semolina",
                    preparation: "Smooth porridge",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🌾",
                  },
                ],
              },
            ],
          },
          {
            id: "grains-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft cooked · Weeks 4–10",
            tracks: [
              {
                id: "grains-z2-top",
                label: "Previously safe, softer",
                stations: [
                  {
                    id: "g5",
                    name: "White Rice",
                    preparation: "Soft cooked",
                    status: "untested",
                    emoji: "🍚",
                  },
                  {
                    id: "g6",
                    name: "Oat Porridge",
                    preparation: "Slightly thicker",
                    status: "untested",
                    emoji: "🥣",
                  },
                  {
                    id: "g7",
                    name: "White Bread",
                    preparation: "Soft, no crust",
                    status: "untested",
                    emoji: "🍞",
                  },
                  {
                    id: "g8",
                    name: "Pasta",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🍝",
                  },
                ],
              },
              {
                id: "grains-z2-bottom",
                label: "New grains to trial",
                stations: [
                  {
                    id: "g9",
                    name: "Polenta",
                    preparation: "Soft, creamy",
                    status: "untested",
                    emoji: "🌽",
                  },
                  {
                    id: "g10",
                    name: "Couscous",
                    preparation: "Soaked",
                    status: "untested",
                    emoji: "🌾",
                  },
                  {
                    id: "g11",
                    name: "Quinoa",
                    preparation: "Well rinsed",
                    status: "untested",
                    emoji: "🌾",
                  },
                  {
                    id: "g12",
                    name: "Rice Cakes",
                    preparation: "Soft, plain",
                    status: "untested",
                    emoji: "🍘",
                  },
                ],
              },
            ],
          },
          {
            id: "grains-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All forms · Ongoing",
            tracks: [
              {
                id: "grains-z3-wholegrain",
                label: "Wholegrain",
                stations: [
                  {
                    id: "g13",
                    name: "Brown Rice",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🍚",
                  },
                  {
                    id: "g14",
                    name: "Wholemeal Bread",
                    preparation: "Toasted",
                    status: "untested",
                    emoji: "🍞",
                  },
                  {
                    id: "g15",
                    name: "Oat Biscuits",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🍪",
                  },
                ],
              },
              {
                id: "grains-z3-baked",
                label: "Baked",
                stations: [
                  {
                    id: "g16",
                    name: "Muffin",
                    preparation: "Plain, low fat",
                    status: "untested",
                    emoji: "🧁",
                  },
                  {
                    id: "g17",
                    name: "Crackers",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "g18",
                    name: "Crumpets",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🍞",
                  },
                ],
              },
              {
                id: "grains-z3-fried",
                label: "Fried / Crunchy",
                stations: [
                  {
                    id: "g19",
                    name: "Chips",
                    preparation: "Thin cut",
                    status: "untested",
                    emoji: "🍟",
                  },
                  {
                    id: "g20",
                    name: "Corn Chips",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🌽",
                  },
                  {
                    id: "g21",
                    name: "Pretzels",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🥨",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── PROTEINS ───────────────────────────────────────────────
  {
    id: "proteins",
    name: "Proteins",
    accentColor: "#fb923c",
    subLines: [
      {
        id: "meat",
        name: "Meat & Fish",
        color: "#fdba74", // pastel orange
        zones: [
          {
            id: "meat-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Puréed & very soft · Days 14–21",
            tracks: [
              {
                id: "meat-z1-main",
                stations: [
                  { id: "p1", name: "Chicken", preparation: "Puréed", status: "safe", emoji: "🍗" },
                  {
                    id: "p2",
                    name: "White Fish",
                    preparation: "Puréed",
                    status: "safe",
                    emoji: "🐟",
                  },
                  {
                    id: "p3",
                    name: "Eggs",
                    preparation: "Scrambled soft",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🥚",
                  },
                  {
                    id: "p4",
                    name: "Tuna",
                    preparation: "Tinned, mashed",
                    status: "untested",
                    emoji: "🐠",
                  },
                ],
              },
            ],
          },
          {
            id: "meat-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft cooked · Weeks 4–10",
            tracks: [
              {
                id: "meat-z2-top",
                label: "Previously safe, soft cooked",
                stations: [
                  {
                    id: "p5",
                    name: "Chicken",
                    preparation: "Poached",
                    status: "untested",
                    emoji: "🍗",
                  },
                  {
                    id: "p6",
                    name: "White Fish",
                    preparation: "Steamed",
                    status: "untested",
                    emoji: "🐟",
                  },
                  {
                    id: "p7",
                    name: "Eggs",
                    preparation: "Soft boiled",
                    status: "untested",
                    emoji: "🥚",
                  },
                  {
                    id: "p8",
                    name: "Salmon",
                    preparation: "Steamed",
                    status: "untested",
                    emoji: "🐟",
                  },
                ],
              },
              {
                id: "meat-z2-bottom",
                label: "New proteins to trial",
                stations: [
                  {
                    id: "p9",
                    name: "Turkey",
                    preparation: "Minced, moist",
                    status: "untested",
                    emoji: "🦃",
                  },
                  {
                    id: "p10",
                    name: "Prawns",
                    preparation: "Steamed",
                    status: "untested",
                    emoji: "🍤",
                  },
                  {
                    id: "p11",
                    name: "Sardines",
                    preparation: "Tinned",
                    status: "untested",
                    emoji: "🐟",
                  },
                  {
                    id: "p12",
                    name: "Crab",
                    preparation: "Flaked",
                    status: "untested",
                    emoji: "🦀",
                  },
                ],
              },
            ],
          },
          {
            id: "meat-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All cooking methods · Ongoing",
            tracks: [
              {
                id: "meat-z3-grilled",
                label: "Grilled",
                stations: [
                  {
                    id: "p13",
                    name: "Chicken Breast",
                    preparation: "Grilled",
                    status: "untested",
                    emoji: "🍗",
                  },
                  {
                    id: "p14",
                    name: "Salmon",
                    preparation: "Grilled",
                    status: "untested",
                    emoji: "🐟",
                  },
                  {
                    id: "p15",
                    name: "Tuna Steak",
                    preparation: "Grilled",
                    status: "untested",
                    emoji: "🐠",
                  },
                ],
              },
              {
                id: "meat-z3-red",
                label: "Red Meat",
                stations: [
                  {
                    id: "p16",
                    name: "Beef Mince",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🥩",
                  },
                  {
                    id: "p17",
                    name: "Lamb",
                    preparation: "Slow cooked",
                    status: "untested",
                    emoji: "🥩",
                  },
                  {
                    id: "p18",
                    name: "Pork",
                    preparation: "Slow cooked",
                    status: "untested",
                    emoji: "🥩",
                  },
                ],
              },
              {
                id: "meat-z3-processed",
                label: "Processed",
                stations: [
                  {
                    id: "p19",
                    name: "Ham",
                    preparation: "Thin sliced",
                    status: "untested",
                    emoji: "🍖",
                  },
                  {
                    id: "p20",
                    name: "Salami",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🍕",
                  },
                  {
                    id: "p21",
                    name: "Sausages",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🌭",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "dairy",
        name: "Dairy",
        color: "#bfdbfe", // pastel blue
        zones: [
          {
            id: "dairy-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Smooth & diluted · Days 14–21",
            tracks: [
              {
                id: "dairy-z1-main",
                stations: [
                  {
                    id: "d1",
                    name: "Yoghurt",
                    preparation: "Plain, smooth",
                    status: "safe",
                    emoji: "🥛",
                  },
                  {
                    id: "d2",
                    name: "Milk",
                    preparation: "Diluted in food",
                    status: "safe",
                    emoji: "🥛",
                  },
                  {
                    id: "d3",
                    name: "Cottage Cheese",
                    preparation: "Smooth",
                    status: "watch",
                    emoji: "🧀",
                  },
                  {
                    id: "d4",
                    name: "Ricotta",
                    preparation: "Smooth",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🧀",
                  },
                ],
              },
            ],
          },
          {
            id: "dairy-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft dairy · Weeks 4–10",
            tracks: [
              {
                id: "dairy-z2-top",
                label: "Previously safe",
                stations: [
                  {
                    id: "d5",
                    name: "Yoghurt",
                    preparation: "Full fat, plain",
                    status: "untested",
                    emoji: "🥛",
                  },
                  {
                    id: "d6",
                    name: "Milk",
                    preparation: "Full fat",
                    status: "untested",
                    emoji: "🥛",
                  },
                  {
                    id: "d7",
                    name: "Cream",
                    preparation: "In sauces",
                    status: "untested",
                    emoji: "🥛",
                  },
                  {
                    id: "d8",
                    name: "Butter",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🧈",
                  },
                ],
              },
              {
                id: "dairy-z2-bottom",
                label: "New dairy to trial",
                stations: [
                  {
                    id: "d9",
                    name: "Soft Cheese",
                    preparation: "Brie, camembert",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d10",
                    name: "Feta",
                    preparation: "Crumbled",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d11",
                    name: "Mozzarella",
                    preparation: "Fresh",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d12",
                    name: "Sour Cream",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🥛",
                  },
                ],
              },
            ],
          },
          {
            id: "dairy-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Full dairy range · Ongoing",
            tracks: [
              {
                id: "dairy-z3-hard",
                label: "Hard Cheese",
                stations: [
                  {
                    id: "d13",
                    name: "Cheddar",
                    preparation: "Grated",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d14",
                    name: "Parmesan",
                    preparation: "Grated",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d15",
                    name: "Gruyère",
                    preparation: "Sliced",
                    status: "untested",
                    emoji: "🧀",
                  },
                ],
              },
              {
                id: "dairy-z3-icecream",
                label: "Frozen",
                stations: [
                  {
                    id: "d16",
                    name: "Ice Cream",
                    preparation: "Plain vanilla",
                    status: "untested",
                    emoji: "🍦",
                  },
                  {
                    id: "d17",
                    name: "Frozen Yoghurt",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🍧",
                  },
                  {
                    id: "d18",
                    name: "Gelato",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🍨",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "plant-proteins",
        name: "Plant Proteins",
        color: "#a5f3fc", // pastel cyan
        zones: [
          {
            id: "pp-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Puréed · Days 14–21",
            tracks: [
              {
                id: "pp-z1-main",
                stations: [
                  {
                    id: "pp1",
                    name: "Tofu",
                    preparation: "Soft, silken",
                    status: "safe",
                    emoji: "🟨",
                  },
                  {
                    id: "pp2",
                    name: "Lentils",
                    preparation: "Puréed",
                    status: "safe",
                    emoji: "🫘",
                  },
                  {
                    id: "pp3",
                    name: "Hummus",
                    preparation: "Smooth",
                    status: "watch",
                    emoji: "🫘",
                  },
                  {
                    id: "pp4",
                    name: "Edamame",
                    preparation: "Puréed",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🫛",
                  },
                ],
              },
            ],
          },
          {
            id: "pp-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft cooked · Weeks 4–10",
            tracks: [
              {
                id: "pp-z2-top",
                label: "Previously safe",
                stations: [
                  {
                    id: "pp5",
                    name: "Tofu",
                    preparation: "Firm, steamed",
                    status: "untested",
                    emoji: "🟨",
                  },
                  {
                    id: "pp6",
                    name: "Lentils",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp7",
                    name: "Chickpeas",
                    preparation: "Puréed",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp8",
                    name: "Edamame",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🫛",
                  },
                ],
              },
              {
                id: "pp-z2-bottom",
                label: "New plant proteins",
                stations: [
                  {
                    id: "pp9",
                    name: "Black Beans",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp10",
                    name: "Tempeh",
                    preparation: "Steamed",
                    status: "untested",
                    emoji: "🟫",
                  },
                  {
                    id: "pp11",
                    name: "Miso",
                    preparation: "In broth",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "pp12",
                    name: "Pea Protein",
                    preparation: "In smoothie",
                    status: "untested",
                    emoji: "🫛",
                  },
                ],
              },
            ],
          },
          {
            id: "pp-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All forms · Ongoing",
            tracks: [
              {
                id: "pp-z3-nuts",
                label: "Nuts & Seeds",
                stations: [
                  {
                    id: "pp13",
                    name: "Almonds",
                    preparation: "Ground/sliced",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "pp14",
                    name: "Walnuts",
                    preparation: "Chopped",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "pp15",
                    name: "Chia Seeds",
                    preparation: "Soaked",
                    status: "untested",
                    emoji: "⚫",
                  },
                ],
              },
              {
                id: "pp-z3-whole",
                label: "Whole Legumes",
                stations: [
                  {
                    id: "pp16",
                    name: "Kidney Beans",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp17",
                    name: "Cannellini",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp18",
                    name: "Puy Lentils",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── FATS ───────────────────────────────────────────────────
  {
    id: "fats",
    name: "Fats",
    accentColor: "#c084fc",
    subLines: [
      {
        id: "healthy-fats",
        name: "Healthy Fats",
        color: "#d8b4fe", // pastel purple
        zones: [
          {
            id: "hf-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Blended in · Days 14–21",
            tracks: [
              {
                id: "hf-z1-main",
                stations: [
                  {
                    id: "hf1",
                    name: "Olive Oil",
                    preparation: "Blended in purée",
                    status: "safe",
                    emoji: "🫒",
                  },
                  {
                    id: "hf2",
                    name: "Avocado",
                    preparation: "Puréed",
                    status: "safe",
                    emoji: "🥑",
                  },
                  {
                    id: "hf3",
                    name: "Flaxseed",
                    preparation: "Ground, in food",
                    status: "watch",
                    emoji: "🌾",
                  },
                  {
                    id: "hf4",
                    name: "Nut Butter",
                    preparation: "Smooth, small amt",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🥜",
                  },
                ],
              },
            ],
          },
          {
            id: "hf-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Moderate amounts · Weeks 4–10",
            tracks: [
              {
                id: "hf-z2-top",
                label: "Oils & spreads",
                stations: [
                  {
                    id: "hf5",
                    name: "Olive Oil",
                    preparation: "Drizzled",
                    status: "untested",
                    emoji: "🫒",
                  },
                  {
                    id: "hf6",
                    name: "Coconut Oil",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🥥",
                  },
                  {
                    id: "hf7",
                    name: "Tahini",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🟤",
                  },
                  {
                    id: "hf8",
                    name: "Avocado",
                    preparation: "Sliced",
                    status: "untested",
                    emoji: "🥑",
                  },
                ],
              },
              {
                id: "hf-z2-bottom",
                label: "New healthy fats",
                stations: [
                  {
                    id: "hf9",
                    name: "Salmon Oil",
                    preparation: "Capsule/drizzle",
                    status: "untested",
                    emoji: "🐟",
                  },
                  {
                    id: "hf10",
                    name: "Walnut Oil",
                    preparation: "Drizzled",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "hf11",
                    name: "Hemp Seeds",
                    preparation: "Sprinkled",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "hf12",
                    name: "Pumpkin Seeds",
                    preparation: "Ground",
                    status: "untested",
                    emoji: "🎃",
                  },
                ],
              },
            ],
          },
          {
            id: "hf-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Full range · Ongoing",
            tracks: [
              {
                id: "hf-z3-nuts",
                label: "Whole Nuts",
                stations: [
                  {
                    id: "hf13",
                    name: "Almonds",
                    preparation: "Whole",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "hf14",
                    name: "Cashews",
                    preparation: "Whole",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "hf15",
                    name: "Pistachios",
                    preparation: "Shelled",
                    status: "untested",
                    emoji: "🌰",
                  },
                ],
              },
              {
                id: "hf-z3-seeds",
                label: "Seeds",
                stations: [
                  {
                    id: "hf16",
                    name: "Chia Seeds",
                    preparation: "Soaked",
                    status: "untested",
                    emoji: "⚫",
                  },
                  {
                    id: "hf17",
                    name: "Sunflower",
                    preparation: "Sprinkled",
                    status: "untested",
                    emoji: "🌻",
                  },
                  {
                    id: "hf18",
                    name: "Sesame",
                    preparation: "Sprinkled",
                    status: "untested",
                    emoji: "🌾",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "unhealthy-fats",
        name: "Saturated Fats",
        color: "#fca5a5", // pastel red
        zones: [
          {
            id: "uf-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Minimal only · Days 14–21",
            tracks: [
              {
                id: "uf-z1-main",
                stations: [
                  {
                    id: "uf1",
                    name: "Butter",
                    preparation: "Small amt in mash",
                    status: "watch",
                    emoji: "🧈",
                  },
                  {
                    id: "uf2",
                    name: "Cream",
                    preparation: "Tiny in food",
                    status: "watch",
                    emoji: "🥛",
                  },
                  {
                    id: "uf3",
                    name: "Coconut Cream",
                    preparation: "Tiny in food",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🥥",
                  },
                ],
              },
            ],
          },
          {
            id: "uf-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Small amounts · Weeks 4–10",
            tracks: [
              {
                id: "uf-z2-top",
                label: "Cooking fats",
                stations: [
                  {
                    id: "uf4",
                    name: "Butter",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🧈",
                  },
                  {
                    id: "uf5",
                    name: "Lard",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "uf6",
                    name: "Ghee",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "uf7",
                    name: "Palm Oil",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🌴",
                  },
                ],
              },
              {
                id: "uf-z2-bottom",
                label: "Processed fats",
                stations: [
                  {
                    id: "uf8",
                    name: "Margarine",
                    preparation: "Spread",
                    status: "untested",
                    emoji: "🧈",
                  },
                  {
                    id: "uf9",
                    name: "Mayo",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "uf10",
                    name: "Cream Cheese",
                    preparation: "Spread",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "uf11",
                    name: "Sour Cream",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🥛",
                  },
                ],
              },
            ],
          },
          {
            id: "uf-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Occasional · Ongoing",
            tracks: [
              {
                id: "uf-z3-fried",
                label: "Fried Foods",
                stations: [
                  {
                    id: "uf12",
                    name: "Chips",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🍟",
                  },
                  {
                    id: "uf13",
                    name: "Fried Egg",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🍳",
                  },
                  {
                    id: "uf14",
                    name: "Bacon",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🥓",
                  },
                ],
              },
              {
                id: "uf-z3-processed",
                label: "Processed",
                stations: [
                  {
                    id: "uf15",
                    name: "Pastry",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🥐",
                  },
                  {
                    id: "uf16",
                    name: "Croissant",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🥐",
                  },
                  {
                    id: "uf17",
                    name: "Doughnuts",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🍩",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── SEASONING ──────────────────────────────────────────────
  {
    id: "seasoning",
    name: "Seasoning",
    accentColor: "#34d399",
    subLines: [
      {
        id: "herbs",
        name: "Herbs",
        color: "#6ee7b7", // pastel mint
        zones: [
          {
            id: "herbs-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Very mild only · Days 14–21",
            tracks: [
              {
                id: "herbs-z1-main",
                stations: [
                  {
                    id: "h1",
                    name: "Parsley",
                    preparation: "Fresh, blended in",
                    status: "safe",
                    emoji: "🌿",
                  },
                  {
                    id: "h2",
                    name: "Chives",
                    preparation: "Fresh, blended in",
                    status: "safe",
                    emoji: "🌿",
                  },
                  {
                    id: "h3",
                    name: "Dill",
                    preparation: "Fresh, blended in",
                    status: "watch",
                    emoji: "🌿",
                  },
                  {
                    id: "h4",
                    name: "Basil",
                    preparation: "Fresh, blended in",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🌿",
                  },
                ],
              },
            ],
          },
          {
            id: "herbs-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Mild herbs · Weeks 4–10",
            tracks: [
              {
                id: "herbs-z2-top",
                label: "Fresh herbs",
                stations: [
                  {
                    id: "h5",
                    name: "Basil",
                    preparation: "Fresh",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h6",
                    name: "Thyme",
                    preparation: "Fresh or dried",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h7",
                    name: "Oregano",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h8",
                    name: "Rosemary",
                    preparation: "Fresh, chopped",
                    status: "untested",
                    emoji: "🌿",
                  },
                ],
              },
              {
                id: "herbs-z2-bottom",
                label: "Dried herbs",
                stations: [
                  {
                    id: "h9",
                    name: "Bay Leaf",
                    preparation: "In cooking",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h10",
                    name: "Sage",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h11",
                    name: "Tarragon",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h12",
                    name: "Mint",
                    preparation: "Fresh",
                    status: "untested",
                    emoji: "🌿",
                  },
                ],
              },
            ],
          },
          {
            id: "herbs-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Full herb range · Ongoing",
            tracks: [
              {
                id: "herbs-z3-strong",
                label: "Strong herbs",
                stations: [
                  {
                    id: "h13",
                    name: "Coriander",
                    preparation: "Fresh",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h14",
                    name: "Lemongrass",
                    preparation: "Infused",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h15",
                    name: "Kaffir Lime",
                    preparation: "In dishes",
                    status: "untested",
                    emoji: "🍋",
                  },
                ],
              },
              {
                id: "herbs-z3-medicinal",
                label: "Medicinal",
                stations: [
                  {
                    id: "h16",
                    name: "Ginger",
                    preparation: "Grated, small",
                    status: "untested",
                    emoji: "🫚",
                  },
                  {
                    id: "h17",
                    name: "Turmeric",
                    preparation: "Ground, small",
                    status: "untested",
                    emoji: "🟡",
                  },
                  {
                    id: "h18",
                    name: "Fennel",
                    preparation: "Seed or frond",
                    status: "untested",
                    emoji: "🌿",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "spices",
        name: "Spices & Condiments",
        color: "#fed7aa", // pastel peach
        zones: [
          {
            id: "spices-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Salt only · Days 14–21",
            tracks: [
              {
                id: "spices-z1-main",
                stations: [
                  {
                    id: "sp1",
                    name: "Salt",
                    preparation: "Tiny amount",
                    status: "safe",
                    emoji: "🧂",
                  },
                  {
                    id: "sp2",
                    name: "Lemon Juice",
                    preparation: "Small squeeze",
                    status: "safe",
                    emoji: "🍋",
                  },
                  {
                    id: "sp3",
                    name: "Soy Sauce",
                    preparation: "Low sodium, tiny",
                    status: "watch",
                    emoji: "🫙",
                  },
                  {
                    id: "sp4",
                    name: "Miso",
                    preparation: "Diluted in broth",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🫙",
                  },
                ],
              },
            ],
          },
          {
            id: "spices-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Mild spices · Weeks 4–10",
            tracks: [
              {
                id: "spices-z2-top",
                label: "Mild spices",
                stations: [
                  {
                    id: "sp5",
                    name: "Cumin",
                    preparation: "Ground, small",
                    status: "untested",
                    emoji: "🟤",
                  },
                  {
                    id: "sp6",
                    name: "Coriander",
                    preparation: "Ground",
                    status: "untested",
                    emoji: "🟤",
                  },
                  {
                    id: "sp7",
                    name: "Cinnamon",
                    preparation: "Ground",
                    status: "untested",
                    emoji: "🟤",
                  },
                  {
                    id: "sp8",
                    name: "Nutmeg",
                    preparation: "Grated, tiny",
                    status: "untested",
                    emoji: "🟤",
                  },
                ],
              },
              {
                id: "spices-z2-bottom",
                label: "Condiments",
                stations: [
                  {
                    id: "sp9",
                    name: "Mustard",
                    preparation: "Mild, small",
                    status: "untested",
                    emoji: "🟡",
                  },
                  {
                    id: "sp10",
                    name: "Vinegar",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "sp11",
                    name: "Fish Sauce",
                    preparation: "Tiny amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "sp12",
                    name: "Oyster Sauce",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                ],
              },
            ],
          },
          {
            id: "spices-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Full spice range · Ongoing",
            tracks: [
              {
                id: "spices-z3-hot",
                label: "Hot & Spicy",
                stations: [
                  {
                    id: "sp13",
                    name: "Black Pepper",
                    preparation: "Ground",
                    status: "untested",
                    emoji: "⚫",
                  },
                  {
                    id: "sp14",
                    name: "Chilli Flakes",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🌶️",
                  },
                  {
                    id: "sp15",
                    name: "Hot Sauce",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🌶️",
                  },
                ],
              },
              {
                id: "spices-z3-sauces",
                label: "Sauces",
                stations: [
                  {
                    id: "sp16",
                    name: "Tomato Sauce",
                    preparation: "Low sugar",
                    status: "untested",
                    emoji: "🍅",
                  },
                  {
                    id: "sp17",
                    name: "Worcestershire",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "sp18",
                    name: "BBQ Sauce",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// ── Flat list of all sub-lines for easy lookup ────────────────
export const ALL_SUBLINES = MAIN_CATEGORIES.flatMap((cat) =>
  cat.subLines.map((sl) => ({ ...sl, categoryId: cat.id, categoryName: cat.name })),
);
