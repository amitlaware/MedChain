
import express from "express";
import { listHospitals, createHospital, hospitalsWithUsers } from "../controllers/hospitalController.js";

const router = express.Router();

router.get("/", listHospitals);
router.post("/", createHospital);
router.get("/with-users", hospitalsWithUsers);

export default router;
