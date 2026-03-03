const mongoose = require('mongoose');
const blogSchema = require('./models/blogSchema');
require('dotenv').config();

const { MONGO_USERNAME_JOB, MONGO_PASSWORD_JOB, MONGO_DATABASE_NAME_JOB } = require('./config/variables');

const seedBlogs = async () => {
    try {
        await mongoose.connect(`mongodb+srv://${MONGO_USERNAME_JOB}:${MONGO_PASSWORD_JOB}@cluster0.6kbhdsi.mongodb.net/${MONGO_DATABASE_NAME_JOB}`);
        console.log("Connected to Atlas for seeding...");

        const sampleBlogs = [
            {
                title: "Top 10 Career Tips for 2026",
                description: "Discover the essential skills and strategies you need to stay ahead in the rapidly evolving job market. From AI literacy to soft skills, we cover everything you need to succeed.",
                content: "Full content of the blog about career tips...",
                author: "Sarah Johnson",
                category: "Career Advice",
                image: "https://images.unsplash.com/photo-1454165833767-1330084bc6f9?q=80&w=2070&auto=format&fit=crop",
                createdAt: new Date()
            },
            {
                title: "How to Build a High-Performance Team",
                description: "Learn the secrets behind building and maintaining a remote team that delivers results. We dive deep into communication tools, cultural building, and management styles.",
                content: "Full content about team building...",
                author: "Michael Chen",
                category: "Management",
                image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop",
                createdAt: new Date()
            },
            {
                title: "The Future of AI in Recruitment",
                description: "AI is changing how we hire. Understand how to leverage automation without losing the human touch in your hiring process.",
                content: "Full content about AI in recruitment...",
                author: "Alex Rivera",
                category: "Technology",
                image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=2070&auto=format&fit=crop",
                createdAt: new Date()
            }
        ];

        await blogSchema.insertMany(sampleBlogs);
        console.log("Seed successful! 3 Blogs added.");
        process.exit(0);
    } catch (err) {
        console.error("Seed failed:", err);
        process.exit(1);
    }
};

seedBlogs();
