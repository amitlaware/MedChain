import express from "express";
import { getMe, login, register, updateProfile } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);

router.get("/patient", protect, allowRoles("patient"), (_req, res) => {
  res.json({ message: "Patient route access granted." });
});

router.get("/doctor", protect, allowRoles("doctor"), (_req, res) => {
  res.json({ message: "Doctor route access granted." });
});

router.get("/admin", protect, allowRoles("admin"), (_req, res) => {
  res.json({ message: "Hospital admin route access granted." });
});

export default router;
