import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiErros.js";
import { User } from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinaryVideoUpload.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import cloudinary from "cloudinary";

/// for generateaccesstokenandrefreshtoken
const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new apiError(
      500,
      "something went wrong while generating access and refresh tokens"
    );
  }
};

// for userSignup
const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - check field are not empty
  // check if user already exist or not
  // check images for avatar
  // upload them in cloudinary,avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check user created..?
  // send/return res

  const { email, username, fullname, password } = req.body;

  if (
    [fullname, username, email, password].some((field) => {
      field?.trim() === "";
    })
  ) {
    throw new apiError(400, "All fields are Required");
  }

  const existingUser = await User.findOne({
    $or: [{ username, email }],
  });

  if (existingUser) {
    throw new apiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // console.log("file path-----", req.files?.avatar[0]?.path);
  if (!avatarLocalPath) {
    throw new apiError(400, "Avatar is required");
  }
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath; // for coverIamge empty field logic
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  const avatar = await uploadCloudinary(avatarLocalPath);

  const coverImage = await uploadCloudinary(coverImageLocalPath);

  //  console.log("file path-----", req.files?.avatar[0]?.path);
  if (!avatar) {
    throw new apiError(400, "Avatar is required");
  }
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });
  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new apiError(500, "somthing went wrong while creating user in db");
  }

   const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, createdUser, "user registered successfully"));
});

// for userLogin
const loginUser = asyncHandler(async (req, res) => {
  // req body
  // username or email
  // find the user
  // password check
  // access and refresh token generate
  // send them as a cookies and response

  const { username, email, password } = req.body;

  if (!username && !email) {
    throw new apiError(400, "username or email is required");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new apiError(404, "user does not exits");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new apiError(401, "Invalid Password");
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  // console.log("---------user_accessToken",accessToken, refreshToken);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //used option for no one alter the cookies from client side

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

//for userLogout
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

//for regenerateRefreshtoken
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new apiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new apiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new apiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new apiError(401, error?.message || "Invalid refresh token");
  }
});

//for changecurrentpassword
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPasssword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new apiError(400, "invalid old password");
  }
  user.password = newPasssword;
  user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "your password changed Successfully"));
});

//for getcurrent user
const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, req.user, "current user"));
});

//for updateUserdetails
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new apiError(400, "all fields are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "details updated successfully"));
});

//for updateAvatar**
const updateAvatarProfile = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new apiError(400, "Avatar file is missing");
  }
  const user = await User.findById(req.user?._id).select("-password");

  if (!user) {
    throw new apiError(404, "User not found");
  }

  // ✅ Delete old image from Cloudinary
  if (user.avatar?.public_id) {
    await cloudinary.uploader.destroy(user.avatar.public_id);
  }

  const avatar = uploadCloudinary(avatarLocalPath);

  if (!avatar) {
    throw new apiError(400, "Error while uploading on avatar");
  }

  // ✅ Update user record
  (user.avatar.url, await user.save());

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated Successfully"));
});

//for updateCoverImage**
const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new apiError(400, "Cover image file is missing");
  }

  //TODO: delete old image - assignment

  const coverImage = await uploadCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new apiError(400, "Error while uploading on avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");
  if (coverImage?.public_id) {
    const test = await cloudinary.uploader.destroy(coverImage.public_id);
  }
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});
// for subscriber

const getUserProfileDetails = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username) {
    throw new apiError(400, "username not found");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new apiError(404, "channel does not exists");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

// for watchHistroy

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    avatar: 1,
                    username: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);
  return res.status(200).json({
    statusCode: 200,
    data: user[0]?.watchHistory || [],
    message: "Watch history fetched successfully",
  });
});

export {
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
};
