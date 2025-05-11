// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

// routes
import authRoute_v1 from "./v1/routes/auth-routes";
import usersRoute_v1 from "./v1/routes/user-routes";

// Other imports
import express from "express";
import cors from "cors";
import helmet from "helmet";
// import rateLimit from "express-rate-limit";

const port = Number(process.env.PORT) || 5000;
const app = express();
// Set the trust proxy setting
// app.set("trust proxy", true);
let whitelist;
if (process.env.NODE_ENV !== "production") {
  whitelist = "*";
} else {
  app.set("trust proxy", 1); // Trust the first proxy in production
  whitelist = [
    "https://admin.socket.io",
    process.env.URL,
    "https://api.paystack.co",
    "https://paystack.com",
    "https://reventlify-web.vercel.app",
  ];
}

const corsOptions = {
  optionsSuccessStatus: 200,
  credentials: true,
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser tools like curl/postman
    if (whitelist === "*" || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

// Rate limiting to prevent brute-force attacks
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 1000, // limit each IP to 1000 requests per windowMs
//   message: "Too many requests from this IP, please try again later.",
//   keyGenerator: (req, res) => {
//     return req.ip;
//   },
// });

//middlewares// Conditional middleware for HSTS based on environment
if (process.env.NODE_ENV === "production") {
  app.use(
    helmet.hsts({
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    })
  );
} else {
  console.log("HSTS is disabled in development");
}

// Other helmet configurations
app.use(
  helmet({
    frameguard: false, // APIs typically don't need this
    contentSecurityPolicy: false, // Disable CSP if not needed
    ieNoOpen: true, // Helps to prevent downloads from opening automatically
    noSniff: true, // Prevent MIME-type sniffing
    referrerPolicy: { policy: "no-referrer" }, // Control referrer information
    xssFilter: true, // Add XSS protections
  })
);
// app.use(limiter);
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  express.json({
    limit: "50mb",
  })
);
app.use(cors(corsOptions));

//ROUTES
app.use("/v1/auth", authRoute_v1);
app.use("/v1/user", usersRoute_v1);
app.get("/ping", (req, res) => {
  res.send("pong");
});

// Crons
import "./cron-jobs";

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Server has started on port ${port}`);
});
