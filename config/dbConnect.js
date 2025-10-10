const mongoose = require("mongoose");
require("dotenv").config();
const {MONGO_USERNAME,MONGO_PASSWORD,MONGO_DATABASE_NAME} =require("./variables")
console.log(MONGO_USERNAME,MONGO_PASSWORD,MONGO_DATABASE_NAME)
const dbConnect = () => {
  console.log("Welcome to database")
  mongoose
    .connect(
    
   `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@cluster0.6kbhdsi.mongodb.net/${MONGO_DATABASE_NAME}`    
      , {
      serverSelectionTimeoutMS: 30000, 
      socketTimeoutMS: 45000, 
    })
    .then(() => {
      console.log("Connected to the database Atlas"); 
    })
    .catch((err) => {
      console.error("Error in connecting the database", err);
    });
};
 
module.exports = dbConnect;
