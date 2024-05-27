import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per `window` (here, per 15 minutes)
  message: {
    message:
      "Too many login attempts from this IP, please try again after 15 minutes.",
  },
  headers: true, // Send rate limit info in the `RateLimit-*` headers
});
