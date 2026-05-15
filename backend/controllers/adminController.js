import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Record from "../models/Record.js";
import TransferRequest from "../models/TransferRequest.js";

export async function clearDatabase(req, res, next) {
  try {
    // remove documents from main collections
    await Promise.all([
      User.deleteMany({}),
      Hospital.deleteMany({}),
      Record.deleteMany({}),
      TransferRequest.deleteMany({})
    ]);

    res.json({ message: "Database cleared: users, hospitals, records, transfer requests removed." });
  } catch (err) {
    next(err);
  }
}

export default { clearDatabase };
