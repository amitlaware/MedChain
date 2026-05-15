import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Authentication token required." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "development_jwt_secret_change_me");
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User for this token no longer exists." });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired authentication token." });
  }
}
