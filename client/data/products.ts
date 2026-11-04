// data/products.ts
// Local fallback product data for Dream More Affiliate Market
// Used only when the backend API is unreachable.

export type ProductCategory =
  | "Containers & Storage"
  | "Household Plastic"
  | "Industrial Parts"
  | "Packaging"
  | "Pipes & Fittings"
  | "Custom Manufacturing";

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  discountPrice?: number | null;
  unit: string;
  stock: number;
  featured?: boolean;
  badge?: string;
  images: string[];
};

export const products: Product[] = [
  // ============================================================
  // Containers & Storage
  // ============================================================
  {
    id: "container-001",
    slug: "heavy-duty-storage-bin",
    name: "Heavy-Duty Storage Bin",
    category: "Containers & Storage",
    description:
      "Industrial-grade stackable plastic storage bin. UV-resistant, ideal for warehouses, factories, and homes.",
    price: 850,
    discountPrice: 720,
    unit: "pcs",
    stock: 120,
    featured: true,
    badge: "Best Seller",
    images: ["/banners/ph.jpg", "/banners/phot2.jpg"],
  },
  {
    id: "container-002",
    slug: "plastic-crate-large",
    name: "Large Plastic Crate",
    category: "Containers & Storage",
    description:
      "Reinforced stacking crate for logistics, agriculture, and retail. Handles up to 40 kg safely.",
    price: 620,
    unit: "pcs",
    stock: 200,
    featured: true,
    badge: "New",
    images: ["/banners/phot2.jpg", "/banners/photo1.jpg"],
  },
  {
    id: "container-003",
    slug: "warehouse-bin-set",
    name: "Warehouse Bin Set (5 pcs)",
    category: "Containers & Storage",
    description:
      "Set of five nesting plastic bins, color-coded for parts organization. Labelled and stackable.",
    price: 2400,
    discountPrice: 2100,
    unit: "set",
    stock: 45,
    images: ["/banners/phot5.jpg"],
  },

  // ============================================================
  // Household Plastic
  // ============================================================
  {
    id: "household-001",
    slug: "plastic-bucket-20l",
    name: "Plastic Bucket 20L",
    category: "Household Plastic",
    description:
      "Food-grade 20L bucket with lid. Durable handle, ideal for household and light industrial use.",
    price: 320,
    discountPrice: 280,
    unit: "pcs",
    stock: 300,
    featured: true,
    badge: "Best Seller",
    images: ["/banners/phot2.jpg", "/banners/ph.jpg"],
  },
  {
    id: "household-002",
    slug: "plastic-basin-large",
    name: "Large Plastic Basin",
    category: "Household Plastic",
    description:
      "Wide 45cm plastic basin. Crack-resistant, dishwasher safe, perfect for kitchens and laundries.",
    price: 240,
    unit: "pcs",
    stock: 180,
    images: ["/banners/photo3.jpg"],
  },
  {
    id: "household-003",
    slug: "water-jug-10l",
    name: "Water Storage Jug 10L",
    category: "Household Plastic",
    description:
      "10L BPA-free water jug with screw cap. Compact design for home and office hydration.",
    price: 380,
    discountPrice: 340,
    unit: "pcs",
    stock: 150,
    badge: "Special Offer",
    images: ["/banners/photo1.jpg"],
  },

  // ============================================================
  // Industrial Parts
  // ============================================================
  {
    id: "industrial-001",
    slug: "industrial-gear-set",
    name: "Industrial Plastic Gear Set",
    category: "Industrial Parts",
    description:
      "Precision-molded plastic gears for industrial machinery. High durability, low friction, heat-resistant.",
    price: 1200,
    unit: "set",
    stock: 80,
    featured: true,
    images: ["/banners/phot5.jpg", "/banners/carplastik.jpg"],
  },
  {
    id: "industrial-002",
    slug: "conveyor-roller-plastic",
    name: "Conveyor Roller (Plastic)",
    category: "Industrial Parts",
    description:
      "Durable plastic conveyor roller for assembly lines. Quiet operation and low maintenance.",
    price: 950,
    unit: "pcs",
    stock: 60,
    images: ["/banners/photo3.jpg"],
  },
  {
    id: "industrial-003",
    slug: "protective-corner-guard",
    name: "Protective Corner Guard (Pack of 10)",
    category: "Industrial Parts",
    description:
      "Plastic corner protectors for shipping and storage. Prevents damage to packaged goods.",
    price: 420,
    discountPrice: 380,
    unit: "pack",
    stock: 240,
    images: ["/banners/photo1.jpg"],
  },

  // ============================================================
  // Packaging
  // ============================================================
  {
    id: "packaging-001",
    slug: "bottle-cap-pack-1000",
    name: "Bottle Cap Pack (1000 pcs)",
    category: "Packaging",
    description:
      "Premium plastic bottle caps. Leak-proof seal, fits standard 28mm bottle necks.",
    price: 450,
    unit: "pack",
    stock: 200,
    featured: true,
    badge: "Bulk",
    images: ["/banners/photo1.jpg", "/banners/ph.jpg"],
  },
  {
    id: "packaging-002",
    slug: "plastic-bottles-500ml",
    name: "Plastic Bottles 500ml (Pack of 50)",
    category: "Packaging",
    description:
      "Clear PET bottles with caps. Food-grade, ideal for juices, water, and edible oils.",
    price: 780,
    unit: "pack",
    stock: 90,
    images: ["/banners/phot2.jpg"],
  },
  {
    id: "packaging-003",
    slug: "shrink-wrap-roll",
    name: "Shrink Wrap Roll",
    category: "Packaging",
    description:
      "Heavy-duty plastic shrink wrap roll for bulk packaging and pallet wrapping.",
    price: 620,
    discountPrice: 570,
    unit: "roll",
    stock: 140,
    badge: "Sale",
    images: ["/banners/photo3.jpg"],
  },

  // ============================================================
  // Pipes & Fittings
  // ============================================================
  {
    id: "pipe-001",
    slug: "pvc-pipe-2inch-3m",
    name: "PVC Pipe 2 inch (3m)",
    category: "Pipes & Fittings",
    description:
      "Rigid PVC pipe, 2-inch diameter, 3-meter length. Ideal for plumbing and drainage.",
    price: 275,
    unit: "pcs",
    stock: 500,
    featured: true,
    images: ["/banners/photo3.jpg", "/banners/phot5.jpg"],
  },
  {
    id: "pipe-002",
    slug: "pvc-elbow-fittings",
    name: "PVC Elbow Fittings (Pack of 20)",
    category: "Pipes & Fittings",
    description:
      "90° PVC elbow fittings for piping systems. Weather-resistant and durable.",
    price: 190,
    unit: "pack",
    stock: 300,
    images: ["/banners/ph.jpg"],
  },
  {
    id: "pipe-003",
    slug: "pvc-connector-kit",
    name: "PVC Connector Kit",
    category: "Pipes & Fittings",
    description:
      "Complete PVC connector kit — tees, elbows, couplings, and end caps for plumbing projects.",
    price: 480,
    discountPrice: 440,
    unit: "kit",
    stock: 110,
    badge: "Bundle",
    images: ["/banners/carplastik.jpg"],
  },

  // ============================================================
  // Custom Manufacturing
  // ============================================================
  {
    id: "custom-001",
    slug: "custom-plastic-mold",
    name: "Custom Plastic Mold",
    category: "Custom Manufacturing",
    description:
      "Bespoke plastic product made to your exact specification. Submit your design for a quote.",
    price: 5000,
    unit: "unit",
    stock: 20,
    featured: true,
    badge: "Made to Order",
    images: ["/banners/carplastik.jpg"],
  },
  {
    id: "custom-002",
    slug: "industrial-custom-parts",
    name: "Industrial Custom Parts",
    category: "Custom Manufacturing",
    description:
      "Custom-molded industrial plastic parts for machinery, automotive, or specialty applications.",
    price: 3200,
    unit: "unit",
    stock: 35,
    images: ["/banners/phot5.jpg"],
  },
  {
    id: "custom-003",
    slug: "prototype-printing",
    name: "Plastic Prototype Service",
    category: "Custom Manufacturing",
    description:
      "Rapid plastic prototype manufacturing. Ideal for testing designs before mass production.",
    price: 1800,
    discountPrice: 1500,
    unit: "unit",
    stock: 50,
    badge: "Special Offer",
    images: ["/banners/photo1.jpg"],
  },
];

// ✅ Convenience helper — find a product by slug or id
export function findProduct(slugOrId: string): Product | undefined {
  const key = slugOrId.trim().toLowerCase();
  return (
    products.find((p) => p.slug.toLowerCase() === key) ||
    products.find((p) => p.id.toLowerCase() === key)
  );
}

// ✅ Convenience helper — list all categories
export function getCategories(): string[] {
  return Array.from(new Set(products.map((p) => p.category)));
}

export default products;