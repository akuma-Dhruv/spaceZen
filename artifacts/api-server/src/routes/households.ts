import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, householdsTable, storagesTable, itemsTable } from "@workspace/db";
import {
  CreateHouseholdBody,
  DeleteHouseholdParams,
  GetHouseholdStatsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/households", async (req, res): Promise<void> => {
  const households = await db.select().from(householdsTable).orderBy(householdsTable.createdAt);
  res.json(households);
});

router.post("/v1/households", async (req, res): Promise<void> => {
  const parsed = CreateHouseholdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [household] = await db.insert(householdsTable).values({ name: parsed.data.name }).returning();
  res.status(201).json(household);
});

router.delete("/v1/households/:id", async (req, res): Promise<void> => {
  const params = DeleteHouseholdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [household] = await db.delete(householdsTable).where(eq(householdsTable.id, params.data.id)).returning();
  if (!household) {
    res.status(404).json({ error: "Household not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/v1/stats/household/:householdId", async (req, res): Promise<void> => {
  const params = GetHouseholdStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { householdId } = params.data;

  const storages = await db
    .select()
    .from(storagesTable)
    .where(and(eq(storagesTable.householdId, householdId), eq(storagesTable.deleted, false)));

  const items = await db
    .select()
    .from(itemsTable)
    .where(and(eq(itemsTable.householdId, householdId), eq(itemsTable.deleted, false)));

  const categoryCounts: Record<string, number> = {};
  for (const item of items) {
    const cat = item.category ?? "Uncategorized";
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }

  const recentItems = [...items]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  res.json({
    totalStorages: storages.length,
    totalItems: items.length,
    categoryCounts: Object.entries(categoryCounts).map(([category, count]) => ({ category, count })),
    recentItems,
  });
});

export default router;
