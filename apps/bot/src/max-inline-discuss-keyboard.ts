/**
 * Inline keyboard row for «Обсудить»: either MAX `open_app` (mini app) or plain `link`.
 * Used by MaxClient and debug routes; unit-tested in isolation from fetch/webhook.
 */
export type MaxDiscussInlineMode = "open_app" | "link";

export type DiscussInlineKeyboardAttachment = {
  type: "inline_keyboard";
  payload: {
    buttons: Array<
      Array<
        | { type: "open_app"; text: string; web_app: string; payload: string }
        | { type: "link"; text: string; url: string }
      >
    >;
  };
};

export function buildDiscussInlineKeyboardAttachment(args: {
  mode: MaxDiscussInlineMode;
  /** For `open_app`: `web_app` string. For `link`: `url` (same origin as mini app for diagnostics). */
  targetUrl: string;
  buttonText: string;
  /** Only used when `mode === "open_app"` (MAX start_param / payload). */
  startParam: string;
}): DiscussInlineKeyboardAttachment {
  if (args.mode === "open_app") {
    return {
      type: "inline_keyboard",
      payload: {
        buttons: [
          [{ type: "open_app", text: args.buttonText, web_app: args.targetUrl, payload: args.startParam }]
        ]
      }
    };
  }
  return {
    type: "inline_keyboard",
    payload: {
      buttons: [[{ type: "link", text: args.buttonText, url: args.targetUrl }]]
    }
  };
}
