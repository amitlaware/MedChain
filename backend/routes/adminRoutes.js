import express from "express";
import { clearDatabase } from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Protected admin-only route to clear main collections (use with caution)
router.post("/clear", protect, allowRoles("admin"), clearDatabase);

export default router;
