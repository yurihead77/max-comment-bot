declare global {
  interface Window {
    WebApp?: {
      initData?: string;
      initDataUnsafe?: {
        start_param?: string;
      };
    };
  }
}

export function getStartParam() {
  return window.WebApp?.initDataUnsafe?.start_param ?? null;
}

export function getInitData() {
  return window.WebApp?.initData ?? "";
}
