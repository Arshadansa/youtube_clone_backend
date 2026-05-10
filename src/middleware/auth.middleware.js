import jwt from "jsonwebtoken";
import apiError from "../utils/apiErros.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

export const verifyJwt = asyncHandler(async (req, _, next) => {
 try {
     const token =
       req.cookies?.accessToken ||
       req.header("Authorization")?.replace("Bearer ", "");
   
     if (!token) {
       throw new apiError(401, "unauthorization access");
     }
   
     const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
     const user = await User.findById(decodedToken?._id).select(
       "-password -refreshToken"
     );
      if(!user){
       throw new apiError(401,"invalied user");
      }
       
      req.user = user;
      next()
 } catch (error) {
    throw new apiError(401,error?.message || "invalied accessToken")
 }
});
