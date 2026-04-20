export function getStartParam() {
    return window.WebApp?.initDataUnsafe?.start_param ?? null;
}
/** Read-only display hint from MAX bridge (not for auth). */
export function getInitDataUnsafeUser() {
    return window.WebApp?.initDataUnsafe?.user ?? null;
}
export function getInitData() {
    return window.WebApp?.initData ?? "";
}
/** True when raw `window.WebApp.initData` includes `hash` (required by backend validation). */
export function isInitDataReadyForAuth(initData) {
    const s = initData.trim();
    if (s.length === 0)
        return false;
    return s.includes("hash=");
}
/**
 * In real MAX WebView `initData` can appear slightly after first render.
 * Short polling prevents false "auth failed" on the initial bootstrap call.
 * Waits for raw `window.WebApp.initData` (not `initDataUnsafe`) and avoids returning
 * a non-empty but incomplete string before `hash=` is present.
 */
export async function waitForInitData(maxWaitMs = 3000, stepMs = 120) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
        const initData = getInitData();
        if (isInitDataReadyForAuth(initData))
            return initData;
        await new Promise((resolve) => setTimeout(resolve, stepMs));
    }
    return getInitData();
}
