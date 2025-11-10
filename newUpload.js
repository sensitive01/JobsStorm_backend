// controllers/bulkJobsController.js
const xlsx = require("xlsx");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const path = require("path");

const Employer = require("./models/employerSchema");
const Job = require("./models/jobSchema");

const DEFAULT_PASSWORD = process.env.DEFAULT_EMPLOYER_PASSWORD || "Temp@123";

/* ---------- Helpers ---------- */
const parseMultilineToArray = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return String(value)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/^[-*•\u2022]\s?/, "").trim());
};

const parseCsvOrMultiline = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    const text = String(value).trim();
    if (!text) return [];
    if (text.includes("\n")) return parseMultilineToArray(text);
    if (text.includes(",")) return text.split(",").map((s) => s.trim()).filter(Boolean);
    if (["[]", "['']"].includes(text)) return [];
    return [text];
};

const parseBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return !!value;
    if (!value && value !== 0) return false;
    return ["true", "yes", "1", "y"].includes(String(value).toLowerCase());
};

const parseNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
};

/* Generate unique jobId (session-aware) */
const generateJobId = async (session) => {
    let jobId;
    let exists = true;
    while (exists) {
        const random = Math.floor(10000 + Math.random() * 90000);
        jobId = `JS${random}`;
        const query = Job.exists({ jobId });
        exists = await (session ? query.session(session) : query);
    }
    return jobId;
};

/* ---------- Bulk Import Function ---------- */
async function bulkImportJobs({ filePath }) {
    if (!filePath) throw new Error("filePath is required");

    const results = [];
    const session = await mongoose.startSession();

    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
        console.log(`📊 Total rows to import: ${rows.length}`);
        // Precompute default password hash once to avoid repeated bcrypt cost per employer
        const hashedPasswordDefault = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        const BATCH_SIZE = 100; // keep each transaction short to avoid Atlas aborts
        for (let start = 0; start < rows.length; start += BATCH_SIZE) {
            const batch = rows.slice(start, start + BATCH_SIZE);
            const batchStartTs = Date.now();
            console.log(`🚚 Processing batch rows ${start + 1}-${start + batch.length}...`);
            await session.withTransaction(async () => {
                const jobDocs = [];
                for (const [offset, row] of batch.entries()) {
                    const index = start + offset; // global row index
                    try {
                        // Map columns
                        const companyName = row.companyName || row.CompanyName || row["company name"] || "";
                        const contactPerson = row.contactPerson || row.contact || "";
                        const contactEmail = String(row.contactEmail || row.email || "").trim();
                        const contactPhone = row.contactPhone || row.mobileNumber || "";

                        const jobTitle = row.jobTitle || row.title || "";
                        const location = row.location || "";
                        const jobDescription = row.jobDescription || row.description || "";
                        const salaryFrom = parseNumber(row.salaryFrom || row.salary_from);
                        const salaryTo = parseNumber(row.salaryTo || row.salary_to);
                        const salaryType = row.salaryType || row.salary_type || "";
                        const category = row.category || "";
                        const position = row.position || "";
                        const vacancy = parseNumber(row.vacancy) || 1;
                        const jobType = row.jobType || "";
                        const experienceLevel = row.experienceLevel || row.experience || "";
                        const educationLevel = row.educationLevel || row.education || "";
                        const responsibilities = parseMultilineToArray(row.responsibilities);
                        const qualifications = parseMultilineToArray(row.qualifications);
                        const locationTypes = parseCsvOrMultiline(row.locationTypes);
                        const isRemote = parseBoolean(row.isRemote || false);
                        const companyWebsite = row.companyWebsite || row.website || "";
                        const applicationInstructions = row.applicationInstructions || "";
                        const companyAddress = row.companyAddress || row.address || "";
                        const benefits = parseCsvOrMultiline(row.benefits);
                        const skills = parseCsvOrMultiline(row.skills);

                        // Validate required fields
                        if (!companyName || !jobTitle || !contactEmail) {
                            results.push({
                                row: index + 1,
                                status: "Failed",
                                reason: !companyName ? "companyName missing" : !jobTitle ? "jobTitle missing" : "contactEmail missing"
                            });
                            continue;
                        }

                        // Find or create employer (session-bound)
                        let employer = await Employer.findOne({ contactEmail: { $regex: `^${contactEmail}$`, $options: "i" } }).session(session);
                        let employerWasCreated = false;
                        if (!employer) {
                            const defaultPostingLimit = parseNumber(row.totaljobpostinglimit) || 1;
                            employer = await new Employer({
                                companyName,
                                contactPerson,
                                contactEmail,
                                userMobile: contactPhone,
                                password: hashedPasswordDefault,
                                totaljobpostinglimit: defaultPostingLimit,
                                employerProfilePic: row.employerProfilePic || "",
                                employerName: row.employerName || companyName,
                                dataCompleteness: row.dataCompleteness || ""
                            }).save({ session });
                            employerWasCreated = true;
                        }

                        // Check posting limit
                        const canPostActive = employer.totaljobpostinglimit > 0;
                        const isActiveFlag = !!canPostActive;

                        // Check duplicate job (session-bound)
                        const duplicateJob = await Job.findOne({ jobTitle, employId: employer._id }).session(session);
                        if (duplicateJob) {
                            results.push({
                                row: index + 1,
                                status: "Skipped",
                                reason: "Duplicate job for this employer"
                            });
                            continue;
                        }

                        // Generate jobId using the same session
                        const jobId = await generateJobId(session);

                        // Build job payload
                        jobDocs.push({
                            jobId,
                            companyName,
                            employId: employer._id,
                            jobTitle,
                            description: jobDescription,
                            jobDescription,
                            category,
                            position,
                            vacancy,
                            jobType,
                            experienceLevel,
                            educationLevel,
                            responsibilities,
                            qualifications,
                            locationTypes,
                            isRemote,
                            location,
                            salaryFrom,
                            salaryTo,
                            salaryType,
                            companyWebsite,
                            applicationInstructions,
                            companyAddress,
                            benefits,
                            skills,
                            contactEmail,
                            contactPhone,
                            status: "open",
                            postingStatus: isActiveFlag ? "approved" : "pending",
                            isActive: isActiveFlag
                        });

                        // Deduct posting limit if active
                        if (isActiveFlag) {
                            employer.totaljobpostinglimit = Math.max(0, employer.totaljobpostinglimit - 1);
                            await employer.save({ session });
                        }

                        results.push({
                            row: index + 1,
                            status: "Queued",
                            companyName,
                            jobTitle,
                            employerId: employer._id.toString(),
                            employerWasCreated,
                            isActive: isActiveFlag
                        });
                    } catch (rowErr) {
                        results.push({ row: index + 1, status: "Failed", reason: rowErr.message || String(rowErr) });
                    }
                }

                // Bulk insert jobs for this batch
                if (jobDocs.length > 0) {
                    await Job.insertMany(jobDocs, { session });
                    // Update results for final status
                    results.forEach((r, i) => {
                        if (r.status === "Queued") r.status = "Job Posted";
                    });
                }
                const tookMs = Date.now() - batchStartTs;
                console.log(`✅ Batch ${start + 1}-${start + batch.length} committed. Inserted ${jobDocs.length} jobs. Took ${tookMs}ms.`);
            });
        }

        return { success: true, total: rows.length, results };
    } catch (err) {
        console.error("Bulk import error:", err);
        return { success: false, error: err.message || String(err) };
    } finally {
        session.endSession();
    }
}

module.exports = { bulkImportJobs };
