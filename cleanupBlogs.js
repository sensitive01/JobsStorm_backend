const mongoose = require('mongoose');
const blogSchema = require('./models/blogSchema');
require('dotenv').config();
const { MONGO_USERNAME_JOB, MONGO_PASSWORD_JOB, MONGO_DATABASE_NAME_JOB } = require('./config/variables');

const cleanup = async () => {
    try {
        await mongoose.connect(`mongodb+srv://${MONGO_USERNAME_JOB}:${MONGO_PASSWORD_JOB}@cluster0.6kbhdsi.mongodb.net/${MONGO_DATABASE_NAME_JOB}`);
        const titlesToDelete = [
            'Top 10 Career Tips for 2026',
            'How to Build a High-Performance Team',
            'The Future of AI in Recruitment'
        ];
        const result = await blogSchema.deleteMany({ title: { $in: titlesToDelete } });
        console.log(`Successfully deleted ${result.deletedCount} dummy blogs.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

cleanup();
