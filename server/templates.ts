import { z } from "zod/v4";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CATEGORIES, CATEGORY_IDS } from "../shared/categories.ts";
import { ACCENTS, DENSITIES, FONTS, GROUP_BY, LAYOUTS, templateFromKeywords, type TemplateSpec } from "../shared/templates.ts";
import { client } from "./claude.ts";

const SpecSchema = z.object({
  name: z.string(),
  emoji: z.string(),
  title: z.string(),
  subtitle: z.string(),
  include: z.array(z.enum(CATEGORY_IDS)),
  groupBy: z.enum(GROUP_BY),
  sort: z.enum(["newest", "oldest"]),
  layout: z.enum(LAYOUTS),
  hideDone: z.boolean(),
  showTime: z.boolean(),
  style: z.object({ font: z.enum(FONTS), accent: z.enum(ACCENTS), density: z.enum(DENSITIES) }),
  note: z.string(),
});

const SYSTEM = `You design page templates for BrainDump, an app that sorts a person's quick notes into documents. The person describes the page they want; you return a template spec, and the app renders their saved items with it.

Every saved item has a category, an optional topic, a title, a body, the time it was saved, and optionally an image, a link, or a file. Categories:
${CATEGORIES.map((c) => `- ${c.id}: ${c.hint}`).join("\n")}

Spec fields:
- name: 1-3 words for the tab. emoji: one emoji for the tab. title: the page heading. subtitle: one short line saying what the page shows.
- include: the categories the page shows. Empty array means everything.
- groupBy: how the page is split into sections. none | day | week | month | category | topic.
- sort: newest or oldest first.
- layout: how each item looks. list (compact rows), cards (a grid of cards), gallery (image-first tiles, best for visual items), checklist (checkbox rows, best for to-dos), timeline (a vertical timeline with times).
- hideDone: true to leave out completed to-dos.
- showTime: whether to show when each item was saved.
- style.font: sans (clean, default), serif (editorial, magazine-like), mono (typewriter, log-like). style.accent: the highlight color for headings and checkboxes. style.density: comfortable or compact.
- note: if the description asks for something these options can't express, pick the closest match and say in one short, plain sentence what you approximated. Otherwise an empty string.

Write name, title, subtitle and note in the language the person writes in.`;

/** Turns a description of a page into a template spec. Uses Claude when available, keyword rules otherwise. */
export async function generateTemplate(prompt: string): Promise<TemplateSpec> {
  if (!client) return templateFromKeywords(prompt);
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: betaZodOutputFormat(SpecSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error(`No template returned (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output;
  } catch (err) {
    console.error("[templates] falling back to keywords:", err instanceof Error ? err.message : err);
    return templateFromKeywords(prompt);
  }
}
