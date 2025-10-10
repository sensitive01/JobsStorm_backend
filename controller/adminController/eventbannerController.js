const Banner = require("../../models/eventsbanner");
const { uploadImage } = require("../../config/cloudinary");


const createBanner = async (req, res) => {
    try {
      const { id, name, page } = req.body;

      if (!id || !name || !page) {
        return res.status(400).json({ message: "id, name, and page are required" });
      }
  
      const existingBanner = await Banner.findOne({ id });
      if (existingBanner) {
        return res.status(409).json({ message: "Banner with this ID already exists" });
      }
  
      if (req.files && req.files.image) {
        const imageFile = req.files.image[0];
        const uploadedImageUrl = await uploadImage(imageFile.buffer, "Banner_images");
        image = uploadedImageUrl;
        console.log("Uploaded Image URL:", uploadedImageUrl);
      }

      const banner = new Banner({
        id,
        name,
        page,
        image, 
      });
  
      await banner.save();
  
      return res.status(201).json({
        message: "Banner created successfully",
        banner,
      });
    } catch (err) {
      console.error("Error creating banner:", err);
      return res.status(500).json({ message: "Internal server error", error: err.message });
    }
  };

const getBanners = async (req, res) => {
  try {

    const banners = await Banner.find();

    if (banners.length === 0) {
      return res.status(404).json({ message: "No banners found" });
    }

    return res.status(200).json({
      message: "Banners fetched successfully",
      banners,
    });
  } catch (err) {
    console.error("Error fetching banners:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

module.exports = {
    createBanner,
    getBanners,
};