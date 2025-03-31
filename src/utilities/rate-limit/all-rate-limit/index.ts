import rateLimit from "express-rate-limit";

export const allRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 requests per `window` (here, per 1 minutes)
  message: {
    message:
      "Too many requests from this IP, please try again after 1 minute before you can make this particular request.",
  },
  headers: true, // Send rate limit info in the `RateLimit-*` headers
});
