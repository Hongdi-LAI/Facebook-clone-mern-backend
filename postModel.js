import mongoose from "mongoose";

/* Db Model */
const postModel = mongoose.Schema({
  user: String,
  imgName: String,
  text: String,
  avatar: String,
  timestamp: String,
});

/* MongoDb puralises all the connection names */
export default mongoose.model("posts", postModel);
