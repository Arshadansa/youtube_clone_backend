import { Subscription } from "../models/subscription.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";
import mongoose, { Mongoose } from "mongoose";
import apiError from "../utils/apiErros.js";

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!subscriberId) {
    throw new apiError(400, "subscriberId Id is required");
  }

  if (!mongoose.isValidObjectId(subscriberId)) {
    throw new apiError(400, "subscriberId Id is invalid");
  }
  console.log(subscriberId, "pppppppp");
  const channels = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users", // collection name (always lowercase plural of model name)
        localField: "channel",
        foreignField: "_id",
        as: "channelDetails",
      },
    },
    {
      $unwind: "$channelDetails",
    },
    {
      $project: {
        _id: "$channelDetails._id",
        fullname: "$channelDetails.fullname",
        username: "$channelDetails.username",
        avatar: "$channelDetails.avatar",
        subscribersCount: "$channelDetails.subscribersCount",
        subscribedAt: "$createdAt",
      },
    },
  ]);

  if (!channels.length) {
    console.log(channels);

    throw new apiError(404, "No subscribed channels found for this user");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, channels, "Subscribed channels fetched successfully")
    );
});

//for togglesubscription
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user?._id;

  if (!channelId) {
    throw new apiError(400, "channel id is required");
  }

  if (!mongoose.isValidObjectId(channelId)) {
    throw new apiError(400, "channel id is invalid");
  }

  if (channelId.toString() === userId.toString()) {
    throw new apiError(400, "user can not subscriber themself");
  }
  // Check if subscription exists
  const existingSubscription = await Subscription.findOne({
    subscriber: userId,
    channel: channelId,
  });
  if (existingSubscription) {
    await Subscription.findByIdAndDelete(existingSubscription._id);
    return res
      .status(200)
      .json(
        new ApiResponse(200, { subscribed: false }, "Unsubscribed successfully")
      );
  } else {
    await Subscription.create({
      subscriber: userId,
      channel: channelId,
    });
    return res
      .status(200)
      .json(
        new ApiResponse(200, { subscribed: true }, "Subscribed successfully")
      );
  }
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId) {
    throw new apiError(400, "channelId is required");
  }

  if (!mongoose.isValidObjectId(channelId)) {
    throw new apiError(400, "channel id is invalid");
  }
  // aggregation pipeline
  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users", 
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriberDetails",
      },
    },
    {
      $unwind: "$subscriberDetails",
    },
    {
      $project: {
        _id: 0,
        subscriberId: "$subscriberDetails._id",
        fullname: "$subscriberDetails.fullname",
        username: "$subscriberDetails.username",
        avatar: "$subscriberDetails.avatar",
        subscribedAt: "$createdAt",
      },
    },
  ]);

  if (!subscribers.length) {
    throw new apiError(404, "No subscribers found for this channel");
  }
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        count: subscribers.length,
        subscribers,
      },
      "Subscribers fetched successfully"
    )
  );
});

export { getSubscribedChannels, toggleSubscription, getUserChannelSubscribers };
