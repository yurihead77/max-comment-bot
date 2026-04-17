export interface PublishPostPayload {
  chatId: string;
  text: string;
  startParam: string;
  buttonText: string;
}

export interface SyncButtonPayload {
  chatId: string;
  messageId: string;
  buttonText: string;
  startParam: string;
}

export class MaxClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl: string,
    private readonly webAppUrl: string
  ) {}

  async publishPost(payload: PublishPostPayload) {
    const response = await fetch(`${this.baseUrl}/bot${this.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.chatId,
        text: payload.text,
        reply_markup: {
          inline_keyboard: [
            [
              {
                type: "open_app",
                text: payload.buttonText,
                web_app: {
                  url: this.webAppUrl,
                  start_param: payload.startParam
                }
              }
            ]
          ]
        }
      })
    });
    return response.json();
  }

  async editDiscussButton(payload: SyncButtonPayload) {
    const response = await fetch(`${this.baseUrl}/bot${this.token}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.chatId,
        message_id: payload.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              {
                type: "open_app",
                text: payload.buttonText,
                web_app: {
                  url: this.webAppUrl,
                  start_param: payload.startParam
                }
              }
            ]
          ]
        }
      })
    });
    return response.json();
  }
}
