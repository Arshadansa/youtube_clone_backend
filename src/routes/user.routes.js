import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatarProfile,
  updateCoverImage,
  getUserProfileDetails,
  getWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middleware/multer.middleware.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);
router.route("/login").post(loginUser);

//secure routes
router.route("/logout").post(verifyJwt, logoutUser);

router.route("/refresh-token").post(refreshAccessToken);
router.route("/update-password").post(verifyJwt, changeCurrentPassword);
router.route("/current-user").get(verifyJwt, getCurrentUser);

router
  .route("/update-account")
  .patch(verifyJwt, upload.none(), updateAccountDetails);

router
  .route("/update-avatar")
  .patch(verifyJwt, upload.single("avatar"), updateAvatarProfile);
router
  .route("/update-coverimage")
  .patch(verifyJwt, upload.single("coverImage"), updateCoverImage);
router.route("/c/:username").get(verifyJwt, getUserProfileDetails);
router.route("/watch-history").get(verifyJwt, getWatchHistory);

export default router;
