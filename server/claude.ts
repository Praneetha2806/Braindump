import Anthropic from "@anthropic-ai/sdk";

// Shared by the categorizer and the template generator. Null when no credentials are set; callers fall back to rules.
export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
export const client = aiEnabled ? new Anthropic() : null;
