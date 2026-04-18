import { getDiscussButtonText } from "./button-text.service";
import { extractMessageIdFromMessagesApiResponse, truncateJson } from "./max-webhook-payload";
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
    const messageId = extractMessageIdFromMessagesApiResponse(published) ?? "";
    if (!messageId) {
      throw new Error(
        `publishPost: no message id in MAX POST /messages response (need message.body.mid): ${truncateJson(published, 2500)}`
      );
    }
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
