import { getDiscussButtonText } from "./button-text.service";
import { MaxClient } from "./max-client";

interface PublishArgs {
  chatId: string;
  text: string;
  postId: string;
}

export class PostPublisherService {
  constructor(
    private readonly maxClient: MaxClient,
    private readonly apiBaseUrl: string
  ) {}

  async publishPost(args: PublishArgs) {
    const startParam = `post_${args.postId}`;
    const published = (await this.maxClient.publishPost({
      chatId: args.chatId,
      text: args.text,
      startParam,
      buttonText: getDiscussButtonText(0)
    })) as Record<string, unknown>;
    const msg =
      published.message && typeof published.message === "object"
        ? (published.message as Record<string, unknown>)
        : undefined;
    const body = msg?.body && typeof msg.body === "object" ? (msg.body as Record<string, unknown>) : undefined;
    const messageId = String(body?.mid ?? "");
    await fetch(`${this.apiBaseUrl}/api/internal/posts/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postId: args.postId,
        chatId: args.chatId,
        messageId,
        botMessageText: args.text
      })
    });

    return { messageId };
  }
}
