export function getStartParam() {
    return window.WebApp?.initDataUnsafe?.start_param ?? null;
}
export function getInitData() {
    return window.WebApp?.initData ?? "";
}
