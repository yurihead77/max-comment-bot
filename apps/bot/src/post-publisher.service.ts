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
    const result = published.result && typeof published.result === "object" ? (published.result as Record<string, unknown>) : undefined;
    const messageId = String(
      result?.message_id ?? published.message_id ?? published.messageId ?? ""
    );
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
