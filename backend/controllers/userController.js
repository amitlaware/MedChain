import User from "../models/User.js";
import TransferRequest from "../models/TransferRequest.js";

export async function listUsers(req, res, next) {
  try {
    const { role, hospitalId } = req.query;

    const filter = {};
    if (role) filter.role = role;
    
    // Security: If the requester is a doctor, default the search to their own hospital
    // unless they are explicitly performing a global search (admins only)
    if (req.user.role === "doctor") {
      if (hospitalId) {
        filter.hospitalId = hospitalId;
      } else {
        // Find patients in my hospital OR those with approved/completed transfers to my hospital
        const transfers = await TransferRequest.find({
          toHospital: req.user.hospitalId,
          status: { $in: ["approved", "completed"] }
        });
        const transferredPatientIds = transfers.map(t => t.patientId);
        
        filter.$or = [
          { hospitalId: req.user.hospitalId },
          { _id: { $in: transferredPatientIds } }
        ];
      }
    } else if (hospitalId) {
      filter.hospitalId = hospitalId;
    }

    const users = await User.find(filter, { name: 1, email: 1, hospitalId: 1, gender: 1, dateOfBirth: 1, hospitalName: 1 }).sort({ name: 1 }).lean();

    res.json({ message: "Users retrieved.", data: users });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Security Check: If requester is a doctor and target is a patient
    if (req.user.role === "doctor" && user.role === "patient") {
      const isSameHospital = req.user.hospitalId && user.hospitalId && req.user.hospitalId.toString() === user.hospitalId.toString();
      
      if (!isSameHospital) {
        // Check for an approved/completed transfer request
        const transfer = await TransferRequest.findOne({
          patientId: user._id,
          toHospital: req.user.hospitalId,
          status: { $in: ["approved", "completed"] }
        });

        if (!transfer) {
          // Return minimal info only - do not allow viewing full profile
          return res.status(403).json({ 
            message: "Access Denied. You do not have permission to view this patient's full clinical profile without a transfer request.",
            data: {
              id: user._id,
              name: user.name,
              hospitalName: user.hospitalName,
              restricted: true
            }
          });
        }
      }
    }

    res.json({ message: "User retrieved.", data: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
}

export default { listUsers, getUser };
