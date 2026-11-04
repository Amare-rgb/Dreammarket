export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
}

const CART_STORAGE_KEY = "dream-more-cart";

export function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];

    return value.filter(
      (item): item is CartItem =>
        !!item &&
        typeof item.productId === "string" &&
        typeof item.name === "string" &&
        typeof item.slug === "string" &&
        (typeof item.image === "string" || item.image === null) &&
        typeof item.unitPrice === "number" &&
        Number.isFinite(item.unitPrice) &&
        item.unitPrice >= 0 &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0
    );
  } catch (error) {
    console.error("Could not read the saved cart:", error);
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-change"));
}
