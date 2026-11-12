import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartItem, readCart, writeCart } from "../../app/lib/cart";

/**
 * Integration test: exercises the full cart lifecycle the way the shop
 * and checkout pages do — add items, update quantities, remove items,
 * and read the cart back after every mutation.
 */

const store = new Map<string, string>();
const dispatchedEvents: string[] = [];

vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
});
vi.stubGlobal("window", {
  dispatchEvent: (event: Event) => {
    dispatchedEvents.push(event.type);
    return true;
  },
});

const itemA: CartItem = {
  productId: "prod-a",
  name: "Product A",
  slug: "product-a",
  image: null,
  unitPrice: 100,
  quantity: 1,
};

const itemB: CartItem = {
  productId: "prod-b",
  name: "Product B",
  slug: "product-b",
  image: "https://example.com/b.png",
  unitPrice: 250.5,
  quantity: 3,
};

// Mirrors the add-to-cart merge logic used in components/shop/Products.tsx
function addOrUpdate(items: CartItem[], item: CartItem, quantity: number) {
  const existing = items.find((i) => i.productId === item.productId);
  if (existing) {
    return items.map((i) =>
      i.productId === item.productId ? { ...i, quantity } : i
    );
  }
  return [...items, { ...item, quantity }];
}

beforeEach(() => {
  store.clear();
  dispatchedEvents.length = 0;
});

describe("cart lifecycle", () => {
  it("adds items, updates quantities, removes items, and persists state", () => {
    // 1. Start empty
    let cart = readCart();
    expect(cart).toEqual([]);

    // 2. Add product A
    cart = addOrUpdate(cart, itemA, 1);
    writeCart(cart);
    expect(readCart()).toHaveLength(1);
    expect(dispatchedEvents).toHaveLength(1);

    // 3. Add product B
    cart = addOrUpdate(readCart(), itemB, 3);
    writeCart(cart);
    expect(readCart()).toHaveLength(2);

    // 4. Increase quantity of product A (merge, not duplicate)
    cart = addOrUpdate(readCart(), itemA, 4);
    writeCart(cart);
    const afterUpdate = readCart();
    expect(afterUpdate).toHaveLength(2);
    expect(afterUpdate.find((i) => i.productId === "prod-a")?.quantity).toBe(4);

    // 5. Remove product B
    writeCart(readCart().filter((i) => i.productId !== "prod-b"));
    const final = readCart();
    expect(final).toHaveLength(1);
    expect(final[0].productId).toBe("prod-a");
    expect(final[0].quantity).toBe(4);

    // 6. Every mutation fired a cart-change event for UI listeners
    expect(dispatchedEvents.filter((e) => e === "cart-change")).toHaveLength(4);
  });

  it("computes the order total the way checkout does", () => {
    writeCart([itemA, itemB]);
    const cart = readCart();
    const total = cart.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    // 100*1 + 250.5*3 = 851.5
    expect(total).toBeCloseTo(851.5, 2);
  });
});
