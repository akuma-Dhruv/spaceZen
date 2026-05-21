import { Router, type IRouter } from "express";
import healthRouter from "./health";
import householdsRouter from "./households";
import storagesRouter from "./storages";
import itemsRouter from "./items";
import storageObjectRouter from "./storage";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(householdsRouter);
router.use(storagesRouter);
router.use(itemsRouter);
router.use(storageObjectRouter);
router.use(chatRouter);

export default router;
