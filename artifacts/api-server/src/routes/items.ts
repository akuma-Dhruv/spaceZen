import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, itemsTable, storagesTable } from "@workspace/db";
import {
  CreateItemBody,
  DeleteItemParams,
  ListItemsByHouseholdParams,
  ListItemsByStorageParams,
  SearchItemsQueryParams,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/v1/items", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const parsed = CreateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId, storageId, name, category, description, tags, customFields, isPublic } = parsed.data;

  const [storage] = await db
    .select()
    .from(storagesTable)
    .where(and(eq(storagesTable.id, storageId), eq(storagesTable.deleted, false)));

  if (!storage) {
    res.status(400).json({ error: "Storage not found" });
    return;
  }

  const locationPathIds = [...(storage.pathIds ?? []), storage.id];
  const locationPathNames = [...(storage.pathNames ?? []), storage.name];

  const [item] = await db
    .insert(itemsTable)
    .values({
      householdId,
      storageId,
      name,
      category: category ?? null,
      description: description ?? null,
      tags: tags ?? [],
      customFields: customFields ?? {},
      locationPathIds,
      locationPathNames,
      createdBy: userId,
      isPublic: isPublic ?? false,
      deleted: false,
    })
    .returning();

  res.status(201).json(item);
});

router.get("/v1/items/search", requireAuth, async (req, res): Promise<void> => {
  const query = SearchItemsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { householdId, q } = query.data;
  const pattern = `%${q}%`;

  const items = await db
    .select()
    .from(itemsTable)
    .where(
      and(
        eq(itemsTable.householdId, householdId),
        eq(itemsTable.deleted, false),
        or(
          ilike(itemsTable.name, pattern),
          ilike(itemsTable.category, pattern),
          ilike(itemsTable.description, pattern),
          sql`EXISTS (SELECT 1 FROM unnest(${itemsTable.tags}) t WHERE t ILIKE ${pattern})`,
        ),
      ),
    )
    .orderBy(itemsTable.createdAt);

  res.json(items);
});

router.get("/v1/items/household/:householdId", requireAuth, async (req, res): Promise<void> => {
  const params = ListItemsByHouseholdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const items = await db
    .select()
    .from(itemsTable)
    .where(and(eq(itemsTable.householdId, params.data.householdId), eq(itemsTable.deleted, false)))
    .orderBy(itemsTable.createdAt);
  res.json(items);
});

router.get("/v1/items/storage/:storageId", requireAuth, async (req, res): Promise<void> => {
  const params = ListItemsByStorageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const items = await db
    .select()
    .from(itemsTable)
    .where(and(eq(itemsTable.storageId, params.data.storageId), eq(itemsTable.deleted, false)))
    .orderBy(itemsTable.createdAt);
  res.json(items);
});

router.delete("/v1/items/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .update(itemsTable)
    .set({ deleted: true })
    .where(eq(itemsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
