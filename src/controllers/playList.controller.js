import { ApiResponse } from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose, { isValidObjectId } from "mongoose";
import apiError from "../utils/apiErros.js";
import { Video } from "../models/video.model.js";
import { PlayList } from "../models/playLists.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name || name.trim === "") {
    throw new apiError(400, "playlist name is required");
  }
  const userId = req.user?.id;
  if (!userId) {
    throw new apiError(401, "Unauthorized: User not found");
  }
  const playlist = await PlayList.create({
    name: name.trim(),
    description: description?.trim() || "",
    owner: userId,
    videos: [],
  });
  if (!playlist) {
    throw new apiError(500, "Failed to create playlist");
  }

  // Respond with success
  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  // Validate playlistId
  if (!playlistId) {
    throw new apiError(400, "Playlist ID is required");
  }
  if (!mongoose.isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid Playlist ID");
  }

  //  Build aggregation pipeline
  const pipeline = [
    {
      $match: { _id: new mongoose.Types.ObjectId(playlistId) },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",       // field in playlist model
        foreignField: "_id",       // field in video model
        as: "videoDetails",
      },
    },
    {
      $unwind: {
        path: "$videoDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "videoDetails.owner",
        foreignField: "_id",
        as: "videoOwner",
      },
    },
    {
      $unwind: {
        path: "$videoOwner",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: "$_id",
        name: { $first: "$name" },
        description: { $first: "$description" },
        owner: { $first: "$owner" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
        videos: {
          $push: {
            _id: "$videoDetails._id",
            title: "$videoDetails.title",
            thumbnail: "$videoDetails.thumbnail",
            duration: "$videoDetails.duration",
            videoFile: "$videoDetails.videoFile",
            owner: {
              _id: "$videoOwner._id",
              username: "$videoOwner.username",
              fullName: "$videoOwner.fullName",
              avatar: "$videoOwner.avatar",
            },
          },
        },
      },
    },
    {
      $addFields: {
        totalVideos: {
          $size: {
            $filter: {
              input: "$videos",
              as: "v",
              cond: { $ne: ["$$v._id", null] },
            },
          },
        },
      },
    },
  ];

  //  Run aggregation
  const playlist = await PlayList.aggregate(pipeline);

  //  Handle no results
  if (!playlist || playlist.length === 0) {
    throw new apiError(404, "Playlist not found");
  }

  //  Return response
  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist[0], "Playlist fetched successfully")
    );
});

const updatePlaylist = asyncHandler(async (req, res) => {
const { playlistId } = req.params;
  const { name, description } = req.body;

  // Validate ID
  if (!playlistId) {
    throw new apiError(400, "Playlist ID is required");
  }
  if (!mongoose.isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid Playlist ID");
  }
 
  //  Find Playlist
  const playlist = await PlayList.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }

   if (name) playlist.name = name.trim();
  if (description) playlist.description = description.trim();

  //  Save updated playlist
  const updatedPlaylist = await playlist.save();

  //  Return success response
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );

});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  //  Validate ID
  if (!playlistId) {
    throw new apiError(400, "Playlist ID is required");
  }
  if (!mongoose.isValidObjectId(playlistId)) {
    throw new apiError(400, "Invalid Playlist ID");
  }

  // Find the playlist
  const playlist = await PlayList.findById(playlistId);

  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }
  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new apiError(403, "You are not authorized to delete this playlist");
   }

  //  Delete the playlist
  await PlayList.findByIdAndDelete(playlistId);

  //  Return success response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist deleted successfully"));

});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const userId = req.user?.id;

  if (!playlistId || !videoId) {
    throw new apiError(400, "Playlist ID and Video ID are required");
  }
  const playlist = await PlayList.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }
  if (playlist.owner.toString() !== userId.toString()) {
    throw new apiError(403, "You are not authorized to modify this playlist");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new apiError(404, "Video not found");
  }

  // Check if video already exists in playlist
  if (playlist.video.includes(videoId)) {
    throw new apiError(400, "Video already exists in this playlist");
  }

  // Add video to playlist
  playlist.video.push(videoId);
  await playlist.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Video added to playlist successfully")
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!playlistId || !videoId) {
    throw new apiError(400, "Playlist ID and Video ID are required");
  }
  if (
    !mongoose.isValidObjectId(playlistId) ||
    !mongoose.isValidObjectId(videoId)
  ) {
    throw new apiError(400, "Invalid Playlist or Video ID");
  }

  //  Find Playlist
  const playlist = await PlayList.findById(playlistId);
  if (!playlist) {
    throw new apiError(404, "Playlist not found");
  }
  const videoExists = playlist.video.includes(videoId);
  if (!videoExists) {
    throw new apiError(404, "Video not found in this playlist");
  }

  //. Remove the Video
  playlist.video = playlist.video.filter(
    (id) => id.toString() !== videoId.toString()
  );

  //. Save updated Playlist
  await playlist.save();

  //. Return Success Response
  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Video removed from playlist successfully")
    );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new apiError(400, "User ID is required");
  }
  if (!mongoose.isValidObjectId(userId)) {
    throw new apiError(400, "Invalid User ID");
  }

  const pipeline = [
    // Match playlists owned by this user
    {
      $match: { owner: new mongoose.Types.ObjectId(userId) },
    },

    // Lookup all videos in this playlist
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "videoDetails",
      },
    },

    // Unwind videoDetails so we can fetch video owners
    {
      $unwind: {
        path: "$videoDetails",
        preserveNullAndEmptyArrays: true,
      },
    },

    // Lookup the owner of each video
    {
      $lookup: {
        from: "users",
        localField: "videoDetails.owner",
        foreignField: "_id",
        as: "videoOwner",
      },
    },
    {
      $unwind: {
        path: "$videoOwner",
        preserveNullAndEmptyArrays: true,
      },
    },

    // Group back to playlist level
    {
      $group: {
        _id: "$_id",
        name: { $first: "$name" },
        description: { $first: "$description" },
        owner: { $first: "$owner" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
        videos: {
          $push: {
            _id: "$videoDetails._id",
            title: "$videoDetails.title",
            thumbnail: "$videoDetails.thumbnail",
            duration: "$videoDetails.duration",
            videoFile: "$videoDetails.videoFile",
            isPublished: "$videoDetails.isPublished",
            views: "$videoDetails.views",
            owner: {
              _id: "$videoOwner._id",
              username: "$videoOwner.username",
              fullName: "$videoOwner.fullName",
              avatar: "$videoOwner.avatar",
            },
          },
        },
        totalVideos: { $sum: 1 },
      },
    },

    // Sort newest first
    { $sort: { createdAt: -1 } },
  ];

  const playlists = await PlayList.aggregate(pipeline);

  if (!playlists || playlists.length === 0) {
    throw new apiError(404, "No playlists found for this user");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlists, "User playlists fetched successfully")
    );
});

export {
  createPlaylist,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  getUserPlaylists,
};
