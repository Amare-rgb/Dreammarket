import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartItem, readCart, writeCart } from "../../app/lib/cart";

// ── Browser API stubs (Node environment has no localStorage/window) ──
const store = new Map<string, string>();
const dispatchedEvents: string[] = [];

const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
};

const windowMock = {
  dispatchEvent: (event: Event) => {
    dispatchedEvents.push(event.type);
    return true;
  },
};

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", windowMock);

const sampleItem: CartItem = {
  productId: "prod-1",
  name: "Sample Product",
  slug: "sample-product",
  image: "https://example.com/img.png",
  unitPrice: 125,
  quantity: 2,
};

beforeEach(() => {
  store.clear();
  dispatchedEvents.length = 0;
});

describe("readCart", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(readCart()).toEqual([]);
  });

  it("returns stored items", () => {
    store.set("dream-more-cart", JSON.stringify([sampleItem]));
    expect(readCart()).toEqual([sampleItem]);
  });

  it("filters out malformed items", () => {
    const bad = [
      null,
      "string",
      { productId: 123 }, // missing fields
      { ...sampleItem, unitPrice: -5 }, // negative price
      { ...sampleItem, quantity: 1.5 }, // non-integer quantity
      { ...sampleItem, quantity: 0 }, // zero quantity
      { ...sampleItem, name: 42 }, // wrong type
    ];
    store.set("dream-more-cart", JSON.stringify([sampleItem, ...bad]));
    expect(readCart()).toEqual([sampleItem]);
  });

  it("returns an empty array for corrupt JSON", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    store.set("dream-more-cart", "{not json");
    expect(readCart()).toEqual([]);
    errorSpy.mockRestore();
  });

  it("returns an empty array when stored value is not an array", () => {
    store.set("dream-more-cart", JSON.stringify({ productId: "x" }));
    expect(readCart()).toEqual([]);
  });
});

describe("writeCart", () => {
  it("persists items and dispatches a cart-change event", () => {
    writeCart([sampleItem]);

    expect(store.get("dream-more-cart")).toBe(JSON.stringify([sampleItem]));
    expect(dispatchedEvents).toContain("cart-change");
    expect(readCart()).toEqual([sampleItem]);
  });

  it("can clear the cart", () => {
    writeCart([sampleItem]);
    writeCart([]);
    expect(readCart()).toEqual([]);
  });
});
