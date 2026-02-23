import express from "express";

import {
    createItemsForEvent,
    getItemsByEvent,
    getItemsByIds,
    purchaseItem,
    createPurchaseRequest,
    reviewPurchaseRequest,
} from "../controllers/item.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/event/:eventId", authMiddleware, getItemsByEvent);
router.post("/by-ids", authMiddleware, getItemsByIds);
router.post("/bulk", authMiddleware, createItemsForEvent);
router.post("/:itemId/purchase", authMiddleware, purchaseItem);
router.post("/:itemId/purchase-requests", authMiddleware, createPurchaseRequest);
router.put("/:itemId/purchase-requests/:requestId", authMiddleware, reviewPurchaseRequest);

export default router;
