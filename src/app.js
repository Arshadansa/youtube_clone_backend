import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

//routers--
import userRouter from "./routes/user.routes.js";
import videoRouter from "./routes/video.routes.js";
import subscriberRouter from "./routes/subscriber.routes.js";
import commentRouter from "./routes/comments.routes.js";
import likeRoute from "./routes/likes.routes.js";
import tweetRoute from "./routes/tweet.routes.js";
import playListRoute from "./routes/playList.routes.js";

/// routers decalaration
app.use("/api/v1/users", userRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/subscribers", subscriberRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRoute);
app.use("/api/v1/tweets", tweetRoute);
app.use("/api/v1/playList", playListRoute);

// Global error handler (should be after all routes)
app.use((err, req, res, next) => {
  console.error("❌ Error caught by middleware:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

export default app;
