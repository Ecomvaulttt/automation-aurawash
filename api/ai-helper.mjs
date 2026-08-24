import { handleAiHelperRequest } from "../server/ai-helper.mjs";

export default async function handler(request, response) {
  await handleAiHelperRequest(request, response);
}
