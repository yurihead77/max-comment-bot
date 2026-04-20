export function getStartParam() {
    return window.WebApp?.initDataUnsafe?.start_param ?? null;
}
export function getInitData() {
    return window.WebApp?.initData ?? "";
}
/**
 * In real MAX WebView `initData` can appear slightly after first render.
 * Short polling prevents false "auth failed" on the initial bootstrap call.
 */
export async function waitForInitData(maxWaitMs = 3000, stepMs = 120) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
        const initData = getInitData();
        if (initData.trim().length > 0)
            return initData;
        await new Promise((resolve) => setTimeout(resolve, stepMs));
    }
    return getInitData();
}
