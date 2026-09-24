import {
  createChatHandler,
  type ChatRequest,
  type ChatResponse,
} from "../server/chatHandler";

const chatHandler = createChatHandler();

// Keep an explicit function export for Vercel's Node function loader.
export default async function handler(
  request: ChatRequest,
  response: ChatResponse,
) {
  await chatHandler(request, response);
}
