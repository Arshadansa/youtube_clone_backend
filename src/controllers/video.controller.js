import { Video } from "../models/video.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";
import mongoose from "mongoose";
import apiError from "../utils/apiErros.js";
import { uploadCloudinary } from "../utils/cloudinaryVideoUpload.js";
import { getVideoDurationInSeconds } from "get-video-duration";

// for get all videos
const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  // Build filter conditions
  const matchStage = { isPublished: true };

  if (query) {
    matchStage.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    matchStage.owner = new mongoose.Types.ObjectId(userId);
  }

  // Define sort options
  const sortStage = {};
  sortStage[sortBy] = sortType === "asc" ? 1 : -1;

  // Create aggregation pipeline
  const aggregatePipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [{ $project: { fullname: 1, username: 1, avatar: 1 } }],
      },
    },
    { $unwind: "$owner" },
    { $sort: sortStage },
  ];

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  const result = await Video.aggregatePaginate(
    Video.aggregate(aggregatePipeline),
    options
  );

  if (!result.docs || result.docs.length === 0) {
    throw new apiError(404, "No videos found");
  }
// console.log("new",result.docs);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalVideos: result.totalDocs,
        totalPages: result.totalPages,
        currentPage: result.page,
        videos: result.docs,
      },
      "Videos fetched successfully"
    )
  );
});
// for publish a video
const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if ([title, description].some((field) => field?.trim() === "")) {
    throw new apiError(400, "All fields are required");
  }

  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoLocalPath) {
    throw new apiError(400, "Video file is required");
  }
  if (!thumbnailLocalPath) {
    throw new apiError(400, "Thumbnail image is required");
  }

  const duration = await getVideoDurationInSeconds(videoLocalPath);
  const videoUpload = await uploadCloudinary(videoLocalPath);
  const thumbnailUpload = await uploadCloudinary(thumbnailLocalPath);

  if (!videoUpload?.url || !thumbnailUpload?.url) {
    throw new apiError(500, "Error uploading video or thumbnail to Cloudinary");
  }

  const newVideo = await Video.create({
    title,
    description,
    videoFile: videoUpload.url,
    thumbnail: thumbnailUpload.url,
    duration,
    owner: req.user._id, // optional but often required
  });

  const uploadedVideo = await Video.findById(newVideo._id);

  if (!uploadedVideo) {
    throw new apiError(500, "something went wrong while uploading Video");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, uploadedVideo, "Video Uploaded Succssfully"));
});
//for delete Video
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new apiError(401, "video Id is required");
  }

  if (!mongoose.isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid Video Id");
  }

  const validVideo = await Video.findById(videoId);

  if (!validVideo) {
    throw new apiError(400, "Video not found");
  }
  await Video.findByIdAndDelete(validVideo);

  return res
    .status(200)
    .json(new ApiResponse(200, "Video deleted successfully"));
});
//for get a video
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new apiError(400, "video Id is required");
  }

  if (!mongoose.isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid Video Id");
  }

  const validVideo = await Video.findById(videoId);

  if (!validVideo) {
    throw new apiError(400, "Video not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, validVideo, "fatching video Successfully "));
});
// for updateVideo Details
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!videoId) {
    throw new apiError(400, "video Id is required");
  }
  if (!mongoose.isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid Video Id");
  }
  if (!title || !description) {
    throw new apiError(400, "Title or Description fields are required");
  }

  const thumbnailLocalPath = req.file?.path;

  if (!thumbnailLocalPath) {
    throw new apiError(400, "Thumbnail image is required");
  }

  const thumbnailUpload = await uploadCloudinary(thumbnailLocalPath);

  if (!thumbnailUpload?.url) {
    throw new apiError(500, "Error uploading thumbnail to Cloudinary");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        ...(title && { title }),
        ...(description && { description }),
        ...(thumbnailUpload?.url && { thumbnail: thumbnailUpload.url }),
      },
    },
    { new: true }
  );

  if (!updatedVideo) {
    throw new apiError(404, "Video not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updateVideo, "video details updated successfully")
    );
});

const togglePublishStatus = asyncHandler(async (req, res) => {

  const { videoId } = req.params;
  if (!videoId) {
    throw new apiError(400, "video id is required");
  }
  if (!mongoose.isValidObjectId(videoId)) {
    throw new apiError(400, "Invalid Video Id");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new apiError(404, "Video not found");
  }
  video.isPublished = !video.isPublished;
  await video.save();
  return res.status(200).json(new ApiResponse(200,video,"Video publish status toggled successfully"))
});


// for user videos
const getMyVideo = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new apiError(401, "Unauthorized: user not logged in");
  }

  const myVideos = await Video.find({ owner: userId })
    .sort({ createdAt: -1 });

  if (!myVideos || myVideos.length === 0) {
    throw new apiError(404, "No videos found for this user");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      myVideos,
      "User videos fetched successfully"
    )
  );
});


export {
  getAllVideos,
  publishAVideo,
  deleteVideo,
  getVideoById,
  updateVideo,
  getMyVideo,
  togglePublishStatus,
};
