import { Router, type IRouter } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq, and } from "drizzle-orm";
import { db, itemsTable, storagesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

router.post("/v1/chat", requireAuth, async (req, res): Promise<void> => {
  const { message, householdId } = req.body;

  if (!message || !householdId) {
    res.status(400).json({ error: "message and householdId are required" });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(503).json({ error: "AI chat is not configured" });
    return;
  }

  const [items, storages] = await Promise.all([
    db
      .select()
      .from(itemsTable)
      .where(and(eq(itemsTable.householdId, householdId), eq(itemsTable.deleted, false))),
    db
      .select()
      .from(storagesTable)
      .where(and(eq(storagesTable.householdId, householdId), eq(storagesTable.deleted, false))),
  ]);

  const inventorySummary = buildInventorySummary(items, storages);

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const systemPrompt = `You are SpaceZen, a helpful home inventory assistant. You help users find, organize, and manage items in their home.

You have access to the user's complete home inventory below. Answer questions about where things are, what they have, suggest organization tips, and help them find items.

Keep answers concise and friendly. Use bullet points when listing multiple items. If you don't know something or it's not in the inventory, say so honestly.

INVENTORY DATA:
${inventorySummary}`;

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
      {
        role: "model",
        parts: [{ text: "Got it! I have a full picture of your home inventory and I'm ready to help you find, organize, and manage your items. What would you like to know?" }],
      },
    ],
  });

  const result = await chat.sendMessage(message);
  const response = result.response.text();

  res.json({ reply: response });
});

function buildInventorySummary(items: any[], storages: any[]): string {
  if (items.length === 0 && storages.length === 0) {
    return "The inventory is currently empty.";
  }

  const storageMap = new Map(storages.map((s) => [s.id, s]));

  const storageLines = storages.map((s) => {
    const path = [...(s.pathNames ?? []), s.name].join(" > ");
    return `- ${path}`;
  });

  const itemLines = items.map((item) => {
    const storage = storageMap.get(item.storageId);
    const location = storage
      ? [...(storage.pathNames ?? []), storage.name].join(" > ")
      : "Unknown location";
    const tags = item.tags?.length ? ` [tags: ${item.tags.join(", ")}]` : "";
    const category = item.category ? ` (${item.category})` : "";
    const desc = item.description ? ` — ${item.description}` : "";
    return `- ${item.name}${category} → located in: ${location}${tags}${desc}`;
  });

  return [
    `STORAGE SPACES (${storages.length} total):`,
    ...storageLines,
    "",
    `ITEMS (${items.length} total):`,
    ...itemLines,
  ].join("\n");
}

export default router;
