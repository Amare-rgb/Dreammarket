
export function hardNavigate(path: string): void {
  if (typeof window === "undefined") return;
  window.location.href = path;
}
