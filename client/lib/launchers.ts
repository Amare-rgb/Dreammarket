// lib/launchers.ts
// Launch local desktop apps from the browser via URI protocols.
//
// - VS Code:  vscode://file/<path>  (built-in protocol, no install needed)
// - CapCut:   capcut://open        (custom scheme — requires capcut-protocol.reg
//             to be registered once on the user's Windows PC)

export const VSCODE_PROJECT_PATH =
  process.env.NEXT_PUBLIC_VSCODE_PROJECT_PATH || "d:/DreamMar";

export const CAPCUT_URI = "capcut://open";
export const CAPCUT_REG_URL = "/capcut-protocol.reg";
export const VSCODE_DOWNLOAD_URL = "https://code.visualstudio.com/download";

/** Build a vscode:// URI that opens a file or folder in VS Code. */
export function vscodeFileUri(path: string = VSCODE_PROJECT_PATH): string {
  // vscode://file/<path> — forward slashes, drive letter kept as-is
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return `vscode://file/${normalized}`;
}

/**
 * Attempt to open VS Code via the vscode:// protocol.
 * Returns true if the browser likely handed off to the OS protocol handler
 * (page loses focus / visibility changes), false if VS Code is probably
 * not installed and the caller should show the fallback.
 */
export function launchVsCode(path?: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      resolve(ok);
    };

    const onBlur = () => finish(true);
    const onVis = () => {
      if (document.hidden) finish(true);
    };
    window.addEventListener("blur", onBlur, { once: true });
    document.addEventListener("visibilitychange", onVis);

    window.location.href = vscodeFileUri(path);

    // If nothing happened after ~1.6s the protocol handler is missing.
    setTimeout(() => finish(false), 1600);
  });
}

/**
 * Attempt to launch CapCut via the custom capcut:// scheme.
 * Always resolves — the caller should show a hint telling the user to
 * install capcut-protocol.reg if CapCut does not open.
 */
export function launchCapCut(): void {
  if (typeof window === "undefined") return;
  window.location.href = CAPCUT_URI;
}
