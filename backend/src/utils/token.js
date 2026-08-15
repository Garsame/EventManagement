import jwt from "jsonwebtoken";

export const signAccessToken = ({ userId, role, email }) => {
  const payload = { sub: userId, role, email };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  });
};

export const signRefreshToken = ({ userId, role, email }) => {
  const payload = { sub: userId, role, email };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  });
};

export default {
  signAccessToken,
  signRefreshToken,
};
