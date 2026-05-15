import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User, { USER_ROLES } from "../models/User.js";
import Hospital from "../models/Hospital.js";

function createToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role
    },
    process.env.JWT_SECRET || "development_jwt_secret_change_me",
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );
}

function sendAuthResponse(res, user, statusCode = 200) {
  res.status(statusCode).json({
    token: createToken(user),
    user: user.toSafeObject()
  });
}

export async function register(req, res, next) {
  try {
    const { name, email, password, role, hospitalId, hospitalName, licenseNumber } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required." });
    }

    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role selected." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const userData = { name, email, password, role, licenseNumber };

    if (hospitalId) {
      if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
        return res.status(400).json({ message: "hospitalId must be a valid ObjectId." });
      }

      const hospital = await Hospital.findById(hospitalId).lean();
      if (!hospital) return res.status(404).json({ message: "Selected hospital not found." });

      userData.hospitalId = hospital._id;
      userData.hospitalName = hospital.name;
    } else if (hospitalName) {
      userData.hospitalName = hospitalName;
    }

    const user = await User.create(userData);

    return sendAuthResponse(res, user, 201);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password, role, hospitalId } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ message: "Email, password, and role are required." });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.role !== role) {
      return res.status(403).json({ message: "Selected role does not match this account." });
    }

    if (hospitalId) {
      if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
        return res.status(400).json({ message: "hospitalId must be a valid ObjectId." });
      }

      if (!user.hospitalId || String(user.hospitalId) !== String(hospitalId)) {
        return res.status(403).json({ message: "Selected hospital does not match this account." });
      }
    }

    return sendAuthResponse(res, user);
  } catch (error) {
    return next(error);
  }
}

export async function getMe(req, res) {
  res.json({ user: req.user.toSafeObject() });
}

export async function updateProfile(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: "A valid name is required." });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.name = name.trim();
    await user.save();

    res.json({ message: "Profile updated successfully.", user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
}
