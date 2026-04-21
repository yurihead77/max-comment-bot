import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CommentInput } from "./comment-input";
import { ReplyPreview } from "./reply-preview";
export function Composer({ editingMessage, replyToMessage, onCancelReply, onSubmit }) {
    return (_jsxs("div", { className: "comments-app__composer", children: [!editingMessage ? _jsx(ReplyPreview, { replyTo: replyToMessage, onCancel: onCancelReply }) : null, _jsx(CommentInput, { submitLabel: editingMessage ? "Сохранить" : "Отправить", initialText: editingMessage?.text ?? "", replyTo: editingMessage ? null : replyToMessage, onCancelReply: onCancelReply, onSubmit: onSubmit })] }));
}
