// The intents the organizer sorts every braindump into. Order = section order in the organized doc.
export const CATEGORIES = [
  { id: "todo", label: "To-dos", unit: ["to-do", "to-dos"], emoji: "✅", hint: "something the user intends or plans to do: tasks, errands, reminders, shopping, appointments and meetings ('meeting with Rohan at 1'), scheduled plans ('walk in Central Park at 5 pm'), and things they'd like to do later ('wondering if I could read Atomic Habits tonight')" },
  { id: "idea", label: "Ideas", unit: ["idea", "ideas"], emoji: "💡", hint: "a new idea, plan, project concept, or 'what if'" },
  { id: "link", label: "Saved", unit: ["saved link", "saved links"], emoji: "🔖", hint: "a website, article, tool, or video link saved for later" },
  { id: "inspiration", label: "Inspiration", unit: ["inspiration", "inspirations"], emoji: "🎨", hint: "visual or design references: UI, color palettes, typography, moodboards, outfits, interiors" },
  { id: "moment", label: "Moments", unit: ["moment", "moments"], emoji: "📷", hint: "photos or videos of the user's life, places, food, people" },
  { id: "note", label: "Notes", unit: ["note", "notes"], emoji: "📝", hint: "thoughts, feelings, observations, journal-like reflections, facts to remember" },
  { id: "file", label: "Files", unit: ["file", "files"], emoji: "📎", hint: "documents and files kept for reference" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 2];
