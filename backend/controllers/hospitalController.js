import Hospital from "../models/Hospital.js";

export async function listHospitals(req, res, next) {
  try {
    const hospitals = await Hospital.find({}, { name: 1 }).sort({ name: 1 }).lean();

    res.json({ message: "Hospitals retrieved.", data: hospitals });
  } catch (err) {
    console.error("Error in listHospitals:", err && err.message ? err.message : err);
    return res.status(500).json({ message: err && err.message ? err.message : "Internal server error" });
  }
}

export async function createHospital(req, res, next) {
  try {
    console.log("createHospital request headers:", req.headers && req.headers['content-type']);
    console.log("createHospital request body:", req.body);
    const { name, address } = req.body;

    if (!name || !address) {
      return res.status(400).json({ message: "name and address are required." });
    }

    const existing = await Hospital.findOne({ name });
    if (existing) return res.status(409).json({ message: "Hospital already exists." });

    const hospital = await Hospital.create({ name, address });

    res.status(201).json({ message: "Hospital created.", data: { _id: hospital._id, name: hospital.name } });
  } catch (err) {
    console.error("Error in createHospital:", err && err.message ? err.message : err);

    if (err && err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({ message: err && err.message ? err.message : "Internal server error" });
  }
}

export default { listHospitals, createHospital };

export async function hospitalsWithUsers(req, res, next) {
  try {
    // lazy-load to avoid circular imports at module top
    const User = (await import("../models/User.js")).default;

    const hospitals = await (await import("../models/Hospital.js")).default.find({}).sort({ name: 1 }).lean();

    const result = await Promise.all(
      hospitals.map(async (h) => {
        const doctors = await User.find({ hospitalId: h._id, role: "doctor" }, { name: 1, email: 1 }).sort({ name: 1 }).lean();
        const patients = await User.find({ hospitalId: h._id, role: "patient" }, { name: 1, email: 1 }).sort({ name: 1 }).lean();

        return {
          _id: h._id,
          name: h.name,
          address: h.address,
          doctors: doctors.map((d) => ({ _id: d._id, name: d.name, email: d.email })),
          patients: patients.map((p) => ({ _id: p._id, name: p.name, email: p.email }))
        };
      })
    );

    res.json({ message: "Hospitals with users retrieved.", data: result });
  } catch (err) {
    console.error("Error in hospitalsWithUsers:", err && err.message ? err.message : err);
    res.status(500).json({ message: err && err.message ? err.message : "Internal server error" });
  }
}
