// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

// routes
import authRoute_v1 from "./v1/routes/auth-routes";
import usersRoute_v1 from "./v1/routes/user-routes";

// Other imports
import express from "express";
import cors from "cors";

const port = 5000;
const app = express();
const whitelist = "*";
// const whitelist = ["https://admin.socket.io", process.env.URL];

const corsOptions = {
  optionsSuccessStatus: 200,
  credentials: true,
  origin: whitelist,
};

//middlewares
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

// Crons
import "./cron-jobs";

const server = app.listen(port, () => {
  console.log(`Server has started on port ${port}`);
});

console.log("Number of server connections :", server.connections);
