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
        | { type: "open_app"; text: string; web_app: string; payload: string; contact_id?: number }
        | { type: "link"; text: string; url: string }
        | { type: "callback"; text: string; payload: string; intent?: "default" }
      >
    >;
  };
};

export function buildDiscussInlineKeyboardAttachment(args: {
  mode: MaxDiscussInlineMode;
  /** For `open_app`: registered mini app identifier (`web_app`). */
  openAppWebApp: string;
  /** Optional bot id for MAX open_app lookup (kept optional; many setups work without it). */
  openAppContactId?: number;
  /** For `link`: URL string (same origin as mini app for diagnostics). */
  linkUrl: string;
  buttonText: string;
  /** Only used when `mode === "open_app"` (MAX start_param / payload). */
  startParam: string;
}): DiscussInlineKeyboardAttachment {
  if (args.mode === "open_app") {
    const openAppButton: { type: "open_app"; text: string; web_app: string; payload: string; contact_id?: number } = {
      type: "open_app",
      text: args.buttonText,
      web_app: args.openAppWebApp,
      payload: args.startParam
    };
    if (typeof args.openAppContactId === "number") {
      openAppButton.contact_id = args.openAppContactId;
    }
    return {
      type: "inline_keyboard",
      payload: {
        buttons: [[openAppButton]]
      }
    };
  }
  return {
    type: "inline_keyboard",
    payload: {
      buttons: [[{ type: "link", text: args.buttonText, url: args.linkUrl }]]
    }
  };
}

export function buildModerationCardKeyboardAttachment(args: {
  openAppWebApp: string;
  openAppContactId?: number;
  reportId: string;
}): DiscussInlineKeyboardAttachment {
  const openAppButton: { type: "open_app"; text: string; web_app: string; payload: string; contact_id?: number } = {
    type: "open_app",
    text: "Открыть жалобу",
    web_app: args.openAppWebApp,
    payload: `report_${args.reportId}`
  };
  if (typeof args.openAppContactId === "number") {
    openAppButton.contact_id = args.openAppContactId;
  }

  const cb = (text: string, action: "delete" | "keep" | "mute" | "block") => ({
    type: "callback" as const,
    text,
    payload: `report_action:${args.reportId}:${action}`,
    intent: "default" as const
  });

  return {
    type: "inline_keyboard",
    payload: {
      buttons: [
        [openAppButton, cb("Удалить", "delete")],
        [cb("Оставить", "keep"), cb("Mute", "mute"), cb("Block", "block")]
      ]
    }
  };
}

export function buildModerationActionsOnlyKeyboardAttachment(args: { reportId: string }): DiscussInlineKeyboardAttachment {
  const cb = (text: string, action: "delete" | "keep" | "mute" | "block") => ({
    type: "callback" as const,
    text,
    payload: `report_action:${args.reportId}:${action}`,
    intent: "default" as const
  });
  return {
    type: "inline_keyboard",
    payload: {
      buttons: [[cb("Удалить", "delete")], [cb("Оставить", "keep"), cb("Mute", "mute"), cb("Block", "block")]]
    }
  };
}
