import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, storagesTable } from "@workspace/db";
import {
  CreateStorageBody,
  DeleteStorageParams,
  ListStoragesByHouseholdParams,
  ListStorageChildrenParams,
  UpdateStorageBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/v1/storages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const parsed = CreateStorageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId, parentId, name, isPublic, imageUrl } = parsed.data;

  let pathIds: number[] = [];
  let pathNames: string[] = [];

  if (parentId != null) {
    const [parent] = await db
      .select()
      .from(storagesTable)
      .where(and(eq(storagesTable.id, parentId), eq(storagesTable.deleted, false)));

    if (!parent) {
      res.status(400).json({ error: "Parent storage not found" });
      return;
    }

    pathIds = [...(parent.pathIds ?? []), parent.id];
    pathNames = [...(parent.pathNames ?? []), parent.name];
  }

  const [storage] = await db
    .insert(storagesTable)
    .values({
      householdId,
      parentId: parentId ?? null,
      name,
      imageUrl: imageUrl ?? null,
      pathIds,
      pathNames,
      createdBy: userId,
      isPublic: isPublic ?? false,
      deleted: false,
    })
    .returning();

  res.status(201).json(storage);
});

router.get("/v1/storages/household/:householdId", requireAuth, async (req, res): Promise<void> => {
  const params = ListStoragesByHouseholdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const storages = await db
    .select()
    .from(storagesTable)
    .where(and(eq(storagesTable.householdId, params.data.householdId), eq(storagesTable.deleted, false)))
    .orderBy(storagesTable.createdAt);
  res.json(storages);
});

router.get("/v1/storages/:id/children", requireAuth, async (req, res): Promise<void> => {
  const params = ListStorageChildrenParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const children = await db
    .select()
    .from(storagesTable)
    .where(and(eq(storagesTable.parentId, params.data.id), eq(storagesTable.deleted, false)))
    .orderBy(storagesTable.createdAt);
  res.json(children);
});

router.patch("/v1/storages/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = UpdateStorageBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const updates: Record<string, any> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.imageUrl !== undefined) updates.imageUrl = body.data.imageUrl;
  if (body.data.isPublic !== undefined) updates.isPublic = body.data.isPublic;

  const [storage] = await db
    .update(storagesTable)
    .set(updates)
    .where(and(eq(storagesTable.id, id), eq(storagesTable.deleted, false)))
    .returning();
  if (!storage) { res.status(404).json({ error: "Storage not found" }); return; }
  res.json(storage);
});

router.delete("/v1/storages/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteStorageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [storage] = await db
    .update(storagesTable)
    .set({ deleted: true })
    .where(eq(storagesTable.id, params.data.id))
    .returning();
  if (!storage) {
    res.status(404).json({ error: "Storage not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
