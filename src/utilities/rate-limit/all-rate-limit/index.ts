import rateLimit from "express-rate-limit";

export const allRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true, // replaces `headers: true` (newer spec)
  legacyHeaders: false,
  keyGenerator: (req) => req.ip, // now safe
  message: {
    message: "Too many requests from this IP, please try again after 1 minute.",
  },
});
