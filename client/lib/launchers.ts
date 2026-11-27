export const VSCODE_PROJECT_PATH =
  process.env.NEXT_PUBLIC_VSCODE_PROJECT_PATH || "d:/DreamMar";
export const CAPCUT_URI = "capcut://open";
export const CAPCUT_REG_URL = "/capcut-protocol.reg";
export const VSCODE_DOWNLOAD_URL = "https://code.visualstudio.com/download";
export function vscodeFileUri(path: string = VSCODE_PROJECT_PATH): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  return `vscode://file/${normalized}`;
}
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
    setTimeout(() => finish(false), 1600);
  });
}
export function launchCapCut(): void {
  if (typeof window === "undefined") return;
  window.location.href = CAPCUT_URI;
}
