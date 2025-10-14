const mongoose = require("mongoose");
require("dotenv").config();
const {MONGO_USERNAME_JOB,MONGO_PASSWORD_JOB,MONGO_DATABASE_NAME_JOB} =require("./variables")
console.log(MONGO_USERNAME_JOB,MONGO_PASSWORD_JOB,MONGO_DATABASE_NAME_JOB)
const dbConnect = () => {
  console.log("Welcome to database")
  mongoose
    .connect(
    
   `mongodb+srv://${MONGO_USERNAME_JOB}:${MONGO_PASSWORD_JOB}@cluster0.6kbhdsi.mongodb.net/${MONGO_DATABASE_NAME_JOB}`    
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
