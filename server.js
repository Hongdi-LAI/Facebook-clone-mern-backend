import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import GridFsStorage from "multer-gridfs-storage";
import Grid from "gridfs-stream";
import bodyParser from "body-parser";
import path from "path";
import mongoPosts from "./postModel.js";
import Pusher from "pusher";

/* Create mongo for storage of images */
Grid.mongo = mongoose.mongo;

/* app config */
const app = express();
const port = process.env.PORT || 9000;

const pusher = new Pusher({
  appId: "1086450",
  key: "b696526d0a0e5ae1426a",
  secret: "65b7ad4a5851804af5aa",
  cluster: "ap1",
  useTLS: true,
});

/* middlewares */
app.use(bodyParser.json());
app.use(cors());

/* Db config */
const mongoURL =
  "mongodb+srv://admin:K8cxuWiGC03xRgDD@facebook-clone.j30nq.mongodb.net/facebook-db?retryWrites=true&w=majority";

/* Whenever Server Starting Up, Create Connection */
const connection = mongoose.createConnection(mongoURL, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.once("open", () => {
  const changeStream = mongoose.connection.collection("posts").watch();
  changeStream.on("change", (change) => {
    if (change.operationType === "insert") {
      console.log("triggering pusher");
      pusher.trigger("posts", "inserted", {
        change: change,
      });
    } else {
      console.log("error triggering pusher");
    }
  });
});

/* GFS = Grid File System for MongooseDb */
let gfs;

/* Once Db connected */
connection.once("open", () => {
  console.log("Db connected");
  gfs = Grid(connection.db, mongoose.mongo);
  gfs.collection("images");
});

/* Db Storage Setup */
const storage = new GridFsStorage({
  url: mongoURL,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = `image-${Date.now()}${path.extname(file.originalname)}`;

      const fileInfo = {
        filename: filename,
        bucketName: "images",
      };

      resolve(fileInfo);
    });
  },
});

/* File Upload Instance */
const upload = multer({ storage });

/* General Connecting to the Server and saving the post data*/
mongoose.connect(mongoURL, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

/* API routes */

/* Health Check */
app.get("/", (req, res) => res.status(200).send("Hello! The API is good"));

/* IN POSTING save image (so we get image name) -> save data post with image name */

/* Image Upload */
app.post("/upload/image", upload.single("file"), (req, res) => {
  res.status(201).send(req.file);
});

/* Data Post */
app.post("/upload/post", (req, res) => {
  const dbPost = req.body;

  /* create document within collection with the data */
  mongoPosts.create(dbPost, (err, data) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(201).send(data);
    }
  });
});

/* IN RETRIEVING get data post -> get image */
/* get document from the collection */
app.get("/retrieve/posts", (req, res) => {
  mongoPosts.find((err, data) => {
    if (err) {
      res.status(500).send(err);
    } else {
      /* sort data based on timestamp */
      data.sort((b, a) => {
        return a.timestamp - b.timestamp;
      });
      res.status(200).send(data);
    }
  });
});
/* get image from the document */
app.get("/retrieve/images/single", (req, res) => {
  gfs.files.findOne({ filename: req.query.name }, (err, file) => {
    if (err) {
      res.status(500).send(err);
    } else {
      if (!file || file.length === 0) {
        res.status(404).json({ err: "file not found" });
      } else {
        const readstream = gfs.createReadStream(file.filename);
        readstream.pipe(res);
      }
    }
  });
});

/* Listen */
app.listen(port, () => console.log(`listening on localhost:${port}`));
