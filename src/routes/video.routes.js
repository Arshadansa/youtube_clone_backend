import { Router } from "express";
import { verifyJwt } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";
import {
  getAllVideos,
  publishAVideo,
  deleteVideo,
  getVideoById,
  updateVideo,
  togglePublishStatus,
  getMyVideo,
} from "../controllers/video.controller.js";


const router = Router();
router.use(verifyJwt); //// Apply verifyJWT middleware to all routes in this file

router
  .route("/")
  .get(getAllVideos)
  .post(
    upload.fields([
      {
        name: "videoFile",
        maxCount: 1,
      },
      {
        name: "thumbnail",
        maxCount: 1,
      },
    ]),
    publishAVideo
  );
router
  .route("/:videoId")
  .delete(deleteVideo)
  .get(getVideoById)
  .patch(upload.single("thumbnail"), updateVideo);
router.route("/video/:userId").get(getMyVideo)
router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

export default router;
