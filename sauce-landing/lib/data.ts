export type Product = {
  id: string;
  name: string;
  tagline: string;
  heat: number;
  price: number;
  size: string;
  color: string;
  accent: string;
  notes: string[];
};

export const products: Product[] = [
  {
    id: "noir",
    name: "Noir Ember",
    tagline: "Smoked habanero · black garlic · aged molasses",
    heat: 4,
    price: 18,
    size: "250 ml",
    color: "#C92A05",
    accent: "#FF5B00",
    notes: ["Smoky", "Umami", "Slow burn"],
  },
  {
    id: "solar",
    name: "Solar Flare",
    tagline: "Scotch bonnet · mango · charred citrus",
    heat: 3,
    price: 16,
    size: "250 ml",
    color: "#F07A00",
    accent: "#FFB13B",
    notes: ["Bright", "Fruity", "Tropical"],
  },
  {
    id: "obsidian",
    name: "Obsidian",
    tagline: "Ghost pepper · cacao nib · espresso",
    heat: 5,
    price: 22,
    size: "200 ml",
    color: "#6E1404",
    accent: "#FF3D00",
    notes: ["Deep", "Bitter-sweet", "Ferocious"],
  },
  {
    id: "amber",
    name: "Amber Honey",
    tagline: "Fresno · wildflower honey · bourbon",
    heat: 2,
    price: 15,
    size: "250 ml",
    color: "#D9600A",
    accent: "#FFC48A",
    notes: ["Sweet", "Oaky", "Mellow"],
  },
];

export type Flavor = {
  id: string;
  name: string;
  kicker: string;
  body: string;
  color: string;
  profile: { label: string; value: number }[];
};

export const flavors: Flavor[] = [
  {
    id: "smoke",
    name: "Smoke",
    kicker: "Oak-fired · 14 hours",
    body: "Habaneros cold-smoked over white oak until their skins blister and blacken, then folded into black garlic confit for a finish that lingers like a campfire.",
    color: "#C92A05",
    profile: [
      { label: "Heat", value: 78 },
      { label: "Smoke", value: 95 },
      { label: "Sweet", value: 30 },
      { label: "Acid", value: 40 },
    ],
  },
  {
    id: "fruit",
    name: "Fruit",
    kicker: "Sun-ripened · hand cut",
    body: "Scotch bonnets meet Alphonso mango and charred blood orange. A bright, tropical punch that hits the front of the tongue and dances away.",
    color: "#F07A00",
    profile: [
      { label: "Heat", value: 62 },
      { label: "Smoke", value: 20 },
      { label: "Sweet", value: 72 },
      { label: "Acid", value: 80 },
    ],
  },
  {
    id: "fire",
    name: "Fire",
    kicker: "1,041,427 SHU",
    body: "Ghost peppers fermented for ninety days with raw cacao and cold-brew espresso. Dark, bitter, and unapologetically ferocious. Handle with respect.",
    color: "#6E1404",
    profile: [
      { label: "Heat", value: 100 },
      { label: "Smoke", value: 55 },
      { label: "Sweet", value: 18 },
      { label: "Acid", value: 35 },
    ],
  },
];

export type Ingredient = {
  name: string;
  origin: string;
  fact: string;
  glyph: "chili" | "garlic" | "salt" | "honey" | "citrus" | "pepper";
};

export const ingredients: Ingredient[] = [
  { name: "Habanero", origin: "Yucatán, MX", fact: "Picked at full blush for maximum fruit and fire.", glyph: "chili" },
  { name: "Black Garlic", origin: "Gilroy, CA", fact: "Aged 40 days until sweet, jammy, and balsamic.", glyph: "garlic" },
  { name: "Smoked Salt", origin: "Halen Môn, UK", fact: "Atlantic sea salt smoked over oak chips.", glyph: "salt" },
  { name: "Wild Honey", origin: "Oaxaca, MX", fact: "Raw and unfiltered, from mountain wildflowers.", glyph: "honey" },
  { name: "Blood Orange", origin: "Sicily, IT", fact: "Charred over coals to caramelise the zest.", glyph: "citrus" },
  { name: "Tellicherry", origin: "Kerala, IN", fact: "The largest 10% of peppercorns, sun-dried.", glyph: "pepper" },
];
