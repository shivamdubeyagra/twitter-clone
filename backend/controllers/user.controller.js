import NotificationModel from "../models/notification.model.js";
import UserModel from "../models/user.model.js";
import {v2 as cloudinary} from "cloudinary";
import bcrypt from "bcryptjs";
const getUserProfile = async (req, res) => {
  const { username } = req.params;
  try {
    const user = await UserModel.findOne({ username }).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const {following} = await UserModel.findById(userId).select("following -_id");
    console.log(following);
    const users = await UserModel.aggregate([
      {
        $match: {
          $and: [
            { _id: { $ne: userId } },
            { _id: { $nin: following } },
          ],
        },
      },
      {
        $project: { password: 0 },
      },
      {
        $sample: { size: 10 },
      },
    ]);
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const followUnfollowUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userToModify = await UserModel.findById(id);
    const currentUser = await UserModel.findById(req.user._id);

    if (id === req.user._id.toString()) {
      return res
        .status(400)
        .json({ error: "You can't follow/unfollow yourself" });
    }
    if (!userToModify || !currentUser) {
      return res.status(400).json({ error: "User not found" });
    }
    const isFollowing = currentUser.following.includes(id);

    if (isFollowing) {
      // unfollow the user
      await UserModel.findByIdAndUpdate(id, {
        $pull: { followers: req.user._id },
      });
      await UserModel.findByIdAndUpdate(req.user._id, {
        $pull: { following: id },
      });
      res.status(200).json({ message: "User unfollowed successfully" });
      // send the notification`user is unfollowing you`
    } else {
      // follow the user
      await UserModel.findByIdAndUpdate(id, {
        $push: { followers: req.user._id },
      });
      await UserModel.findByIdAndUpdate(req.user._id, {
        $push: { following: id },
      });
      // send the notification`user is following you`
      const notification = new NotificationModel({
        from: req.user._id,
        to: userToModify._id,
        type: "follow",
      });
      await notification.save();
      res.status(200).json({ message: "User followed successfully" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateUserProfile = async (req, res) => {
  const {fullName,email,username,currentPassword,newPassword,link,bio} = req.body;
  let {profileImage,coverImage} = req.body;
  const userId = req.user._id;
  try{
    const user = await UserModel.findById(userId);
    if(!user){
      return res.status(404).json({error:"User not found"});
    }
    if((!newPassword && currentPassword) || (!currentPassword && newPassword)){
      return res.status(400).json({error:"Please provide a both current and new password"});
    }
    if(currentPassword && newPassword){
      const isPasswordCorrect = await bcrypt.compare(currentPassword,user.password);
      if(!isPasswordCorrect){
        return res.status(400).json({error:"Invalid current password"});
      }
      if(newPassword.length < 6){
        return res.status(400).json({error:"New password must be at least 6 characters long"});
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword,salt);
      user.password = hashedPassword;
    }
    if(profileImage){
      if(user.profileImage){
        await cloudinary.uploader.destroy(user.profileImage.split("/").pop().split(".")[0]);
      }
      const result = await cloudinary.uploader.upload(profileImage);
      user.profileImage = result.secure_url;
    }
    if(coverImage){
      if(user.coverImage){
        await cloudinary.uploader.destroy(user.coverImage.split("/").pop().split(".")[0]);
      }
      const result = await cloudinary.uploader.upload(coverImage);
      user.coverImage = result.secure_url;
    }
    user.fullName = fullName || user.fullName;
    user.email = email || user.email;
    user.username = username || user.username;
    user.link = link || user.link;
    user.bio = bio || user.bio;

    const userData = await user.save();
    const { password, ...userWithoutPassword } = userData.toObject();
    res.status(200).json({message:"User profile updated successfully",user:userWithoutPassword});
  }catch(error){
    res.status(500).json({error:"Internal server error"});
  }
};

export {
  getUserProfile,
  getSuggestedUsers,
  followUnfollowUser,
  updateUserProfile,
};
