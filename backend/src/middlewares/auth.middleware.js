import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import jwt from "jsonwebtoken";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.auth_token || req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new ApiError(401, "Unauthorized request");
    if (!process.env.JWT_SECRET) throw new ApiError(500, "Authentication is not configured");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) throw new ApiError(401, "Invalid access token");
    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    return next(new ApiError(401, "Invalid or expired access token"));
  }
};
