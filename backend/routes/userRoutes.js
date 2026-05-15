import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { listUsers, getUser } from "../controllers/userController.js";

const router = express.Router();

router.use(protect);

router.get("/", allowRoles("doctor", "patient", "admin"), listUsers);
router.get("/:id", allowRoles("doctor", "patient", "admin"), getUser);

export default router;
