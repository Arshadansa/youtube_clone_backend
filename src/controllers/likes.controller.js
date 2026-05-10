import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";
import mongoose, { Mongoose } from "mongoose";
import apiError from "../utils/apiErros.js";
import { Like } from "../models/likes.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comments.model.js";
import { Tweet } from "../models/tweets.model.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) throw new apiError(400, "Video ID is required");
  if (!mongoose.isValidObjectId(videoId))
    throw new apiError(400, "Invalid Video ID");

  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    // REMOVE LIKE
    await Like.findByIdAndDelete(existingLike._id);
    await Video.findByIdAndUpdate(videoId, { $inc: { likesCount: -1 } });

    return res
      .status(200)
      .json(new ApiResponse(200, { liked: false }, "Like removed"));
  }

  // ADD LIKE
  const newLike = await Like.create({
    video: videoId,
    likedBy: req.user._id,
  });

  await Video.findByIdAndUpdate(videoId, { $inc: { likesCount: 1 } });

  // POPULATE LIKE INFO
  const [populatedLike] = await Like.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(newLike._id) } },
    {
      $lookup: {
        from: "users",
        localField: "likedBy",
        foreignField: "_id",
        as: "likedBy",
        pipeline: [{ $project: { fullname: 1, username: 1, avatar: 1 } }],
      },
    },
    { $unwind: "$likedBy" },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [{ $project: { title: 1, thumbnail: 1, likesCount: 1 } }],
      },
    },
    { $unwind: "$video" },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, populatedLike, "Video liked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  //  Validate commentId
  if (!commentId) {
    throw new apiError(400, "Comment ID is required");
  }
  if (!mongoose.isValidObjectId(commentId)) {
    throw new apiError(400, "Invalid Comment ID format");
  }

  //  Check if like already exists
  const existingLike = await Like.findOne({
    comment: commentId,
    likedBy: req.user?._id,
  });

  let message = "";

  if (existingLike) {
    //  Unlike the comment

    await Like.findByIdAndDelete(existingLike._id);
    await Comment.findByIdAndUpdate(commentId, { $inc: { likesCount: -1 } });
    message = "Comment unliked successfully";
  } else {
    //  Like the comment
    const newLike = await Like.create({
      comment: commentId,
      likedBy: req.user?._id,
    });

    await Comment.findByIdAndUpdate(
      commentId,
      { $inc: { likesCount: 1 } },
      { new: true }
    );
    const pipeline = [
      {
        $match: { _id: new mongoose.Types.ObjectId(newLike._id) },
      },
      {
        $lookup: {
          from: "users",
          localField: "likedBy",
          foreignField: "_id",
          as: "likedBy",
          pipeline: [{ $project: { fullname: 1, username: 1, avatar: 1 } }],
        },
      },
      { $unwind: "$likedBy" },
      {
        $lookup: {
          from: "comments",
          localField: "comment",
          foreignField: "_id",
          as: "comment",
          pipeline: [{ $project: { content: 1, likesCount: 1, video: 1 } }],
        },
      },
      { $unwind: "$comment" },
    ];

    const [populatedLike] = await Like.aggregate(pipeline);

    return res
      .status(200)
      .json(new ApiResponse(200, populatedLike, "Comment liked successfully"));
  }
  return res.status(200).json(new ApiResponse(200, {}, message));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  // Validate tweetId
  if (!tweetId) {
    throw new apiError(400, "Tweet ID is required");
  }

  if (!mongoose.isValidObjectId(tweetId)) {
    throw new apiError(400, "Invalid Tweet ID format");
  }

  // Check if like already exists
  const existingLike = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user?._id,
  });

  let message = "";
  let populatedLike = null;
  if (existingLike) {
    // Unlike
    await Like.findByIdAndDelete(existingLike._id);
    await Tweet.findByIdAndUpdate(tweetId, { $inc: { likesCount: -1 } });
    message = "Tweet unliked successfully";
  } else {
    // Like
    const newLike = await Like.create({
      tweet: tweetId,
      likedBy: req.user?._id,
    });

    await Tweet.findByIdAndUpdate(
      tweetId,
      { $inc: { likesCount: 1 } },
      { new: true }
    );
    const pipeline = [
      {
        $match: { _id: new mongoose.Types.ObjectId(newLike._id) },
      },
      {
        $lookup: {
          from: "users",
          localField: "likedBy",
          foreignField: "_id",
          as: "likedBy",
          pipeline: [{ $project: { fullname: 1, username: 1, avatar: 1 } }],
        },
      },
      { $unwind: "$likedBy" },
      {
        $lookup: {
          from: "tweets",
          localField: "tweet",
          foreignField: "_id",
          as: "tweet",
          pipeline: [{ $project: { content: 1, likesCount: 1 } }],
        },
      },
      { $unwind: "$tweet" },
    ];

    [populatedLike] = await Like.aggregate(pipeline);
    message = "Tweet liked successfully";
  }

  return res
    .status(200)
    .json(new ApiResponse(200, populatedLike || {}, message));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new apiError(401, "Unauthorized access");
  }
  const pipeline = [
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(userId),
        video: { $exists: true, $ne: null },
        // Only likes related to videos
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
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
          {
            $project: {
              title: 1,
              thumbnail: 1,
              duration: 1,
              views: 1,
              likesCount: 1,
              owner: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
    { $unwind: "$video" },
    { $sort: { createdAt: -1 } },
  ];

  const likedVideos = await Like.aggregate(pipeline);
  if (!likedVideos.length) {
    throw new apiError(404, "No liked videos found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    );
});

export { toggleVideoLike, toggleCommentLike, toggleTweetLike, getLikedVideos };
