import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import AuthRouter from "./routes/auth.route.js";
import FileRouter from "./routes/file.route.js";
import errorHandler from "./middlewares/errorHandler.middleware.js";
import { setupDirectries } from "./utils/setupDirectories.js";
import path from "path";
import { __dirname } from "./constants.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
	cors({
		origin: (process.env.FRONTEND_ORIGIN || "http://localhost:5173").split(",").map((origin) => origin.trim()),
		credentials: true,
	})
);

setupDirectries();
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/auth", AuthRouter);
app.use("/api", authMiddleware);
app.use("/api/files", FileRouter);

app.use((error, req, res, next) => {
  if (error?.name === "MulterError") {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ statusCode: status, message: error.code === "LIMIT_FILE_SIZE" ? "File exceeds the 100 MB upload limit" : error.message });
  }
  return next(error);
});

app.use(errorHandler);

export { app };
