const path = require("path");
const mongoose = require("mongoose");
const { bulkImportJobs } = require("./uploadJob");
const dbConnect = require("./config/dbConnect");

// ✅ Your Excel file path
const filePath = path.join(__dirname, "assets/final_dubai_it_data(2).xlsx");

// ✅ Your MongoDB connection string
const MONGO_URI = "mongodb://127.0.0.1:27017/jobstorm";  // change if needed

async function runImport() {
    try {
        console.log("⏳ Connecting to DB...");
        dbConnect()

        console.log("📥 Importing jobs from Excel:", filePath);

        // Track progress
        let processed = 0;
        let success = 0;
        let failed = 0;
        let skipped = 0;

        // Function to update the console output
        const updateProgress = () => {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`🔄 Processing... | ✅ Success: ${success} | ⚠️ Skipped: ${skipped} | ❌ Failed: ${failed} | 📊 Total: ${processed}`);
        };

        // Start progress tracking
        const progressInterval = setInterval(updateProgress, 100);

        // Handle job import with progress updates
        const result = await bulkImportJobs({
            filePath,
            onProgress: (status) => {
                processed++;
                if (status.includes('Skipped')) skipped++;
                else if (status.includes('Failed')) failed++;
                else success++;
                updateProgress();
            }
        });

        // Clear the interval and print final results
        clearInterval(progressInterval);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);

        console.log("✅ DONE");
        console.log(result);

        process.exit(0);
    } catch (error) {
        console.error("❌ Import failed:", error);
        process.exit(1);
    }
}

runImport();
