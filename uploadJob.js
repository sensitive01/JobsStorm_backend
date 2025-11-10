// controllers/bulkJobsController.js
const xlsx = require("xlsx");
const bcrypt = require("bcrypt");
const path = require("path");
const { v4: uuidv4 } = require('uuid');
const Employer = require("./models/employerSchema");
const Job = require("./models/jobSchema");

const DEFAULT_PASSWORD = process.env.DEFAULT_EMPLOYER_PASSWORD || "Temp@123";

/* ---------- helpers ---------- */
function parseMultilineToArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined || value === "") return [];
    return String(value)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/^[-*•\u2022]\s?/, "").trim());
}

function parseCsvOrMultiline(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined || value === "") return [];
    const text = String(value).trim();
    if (!text) return [];
    if (text.includes("\n")) return parseMultilineToArray(text);
    if (text.includes(",")) return text.split(",").map((s) => s.trim()).filter(Boolean);
    // sometimes Excel uses "[]" as a literal; handle that
    if (text === "[]" || text === "['']") return [];
    return [text];
}

function parseBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return !!value;
    if (!value && value !== 0) return false;
    const v = String(value).trim().toLowerCase();
    return ["true", "yes", "1", "y"].includes(v);
}

function parseNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

/* Generate unique jobId */
const generateJobId = async () => {
    let unique = false;
    let jobId;
    while (!unique) {
        const randomNumber = Math.floor(10000 + Math.random() * 90000);
        jobId = `JS${randomNumber}`;
        // check DB
        // Note: if huge dataset this might be slow; for now it's fine
        const existingJob = await Job.findOne({ jobId }).lean().exec();
        if (!existingJob) unique = true;
    }
    return jobId;
};


async function bulkImportJobs(options = {}) {
    const { filePath, onProgress } = options;
    if (!filePath) throw new Error("filePath is required (options.filePath)");

    const results = [];
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

        for (const [index, row] of rows.entries()) {
            try {
                // Map common column names (tolerant)
                const companyName =
                    row.companyName || row.CompanyName || row["company name"] || row["Company Name"] || row.company || "";
                const contactPerson = row.contactPerson || row.contact || row.Contact || "";
                const contactEmail = String(row.contactEmail || row.email || row["contact email"] || "").trim();
                const contactPhone = row.contactPhone || row.mobileNumber || row.phone || row.contactPhone || "";

                const jobTitle = row.jobTitle || row.title || row["Job Title"] || "";
                const location = row.location || row.Location || "";
                const jobDescription =
                    row.jobDescription || row.description || row["jobDescription"] || row["description"] || "";
                const salaryFrom = parseNumber(row.salaryFrom || row.salary_from || row["Salary From"]);
                const salaryTo = parseNumber(row.salaryTo || row.salary_to || row["Salary To"]);
                const salaryType = row.salaryType || row.salary_type || row["salary type"] || "";
                const category = row.category || "";
                const position = row.position || "";
                const vacancy = parseNumber(row.vacancy || row.vacancies || row.Vacancy) || 1;
                const jobType = row.jobType || row.type || "";
                const experienceLevel = row.experienceLevel || row.experience || "";
                const educationLevel = row.educationLevel || row.education || "";
                const responsibilities = parseMultilineToArray(row.responsibilities || row.Responsibilities || "");
                const qualifications = parseMultilineToArray(row.qualifications || row.Qualifications || "");
                const locationTypes = parseCsvOrMultiline(row.locationTypes || row.location_types || row.LocationTypes || "");
                const isRemote = parseBoolean(row.isRemote || row.remote || row.IsRemote || false);
                const companyWebsite = row.companyWebsite || row.website || row.CompanyWebsite || "";
                const applicationInstructions = row.applicationInstructions || row.application_instructions || "";
                const companyAddress = row.companyAddress || row.address || row.companyAddress || "";
                const benefits = parseCsvOrMultiline(row.benefits || "").join(", ");
                // Convert region to string if it's an array
                let region = row.region || "";
                if (Array.isArray(region)) {
                    region = region.join(", ").trim();
                } else if (region) {
                    region = String(region).trim();
                }
                const skills = parseCsvOrMultiline(row.skills || "");
                // We'll ignore fields that should be generated: status, postingStatus, isActive, createdAt, updatedAt, _id, jobId, employId

                // Basic validation
                if (!companyName) {
                    results.push({ row: index + 1, status: "Failed", reason: "companyName missing" });
                    continue;
                }
                if (!jobTitle) {
                    results.push({ row: index + 1, companyName, status: "Failed", reason: "jobTitle missing" });
                    continue;
                }
                if (!contactEmail) {
                    results.push({ row: index + 1, companyName, jobTitle, status: "Failed", reason: "contactEmail missing" });
                    continue;
                }

                // Find employer by email (case-insensitive)
                let employer = await Employer.findOne({ contactEmail });
                let employerWasCreated = false;

                if (!employer) {
                    // Create new employer if not exists
                    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
                    employer = new Employer({
                        uuid: uuidv4(), // Generate new UUID
                        companyName,
                        contactPerson,
                        contactEmail,
                        contactPhone,
                        password: hashedPassword,
                        isVerified: true,
                        emailverifedstatus: true,
                        verificationstatus: 'approved'
                    });
                    await employer.save();
                    employerWasCreated = true;
                }

                // Determine isActive based on employer posting limit
                const canPostActive =
                    Number.isFinite(Number(employer.totaljobpostinglimit)) && employer.totaljobpostinglimit > 0;
                const isActiveFlag = !!canPostActive;

                const jobId = await generateJobId();

                // Helper function to escape regex special characters
                const escapeRegExp = (string) => {
                    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                };

                // Check if the exact same job already exists (same title, company, and contact)
                // This allows companies to post multiple different jobs, but prevents exact duplicates
                const existingJob = await Job.findOne({
                    jobTitle: { $regex: `^${escapeRegExp(jobTitle)}$`, $options: 'i' },
                    companyName: { $regex: `^${escapeRegExp(companyName)}$`, $options: 'i' },
                    contactEmail: { $regex: `^${escapeRegExp(contactEmail)}$`, $options: 'i' },
                    // Add more fields to make the duplicate check more strict if needed
                    ...(location && { location: { $regex: `^${escapeRegExp(location)}$`, $options: 'i' } }),
                    ...(jobType && { jobType: { $regex: `^${escapeRegExp(jobType)}$`, $options: 'i' } })
                });

                if (existingJob) {
                    const status = "Skipped - Exists";
                    results.push({ row: index + 1, status, companyName, jobTitle });
                    if (onProgress) onProgress(status);
                    continue;
                }

                // Build job payload
                const jobPayload = {
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
                    isActive: isActiveFlag,
                    region
                };

                const jobDoc = new Job(jobPayload);
                const savedJob = await jobDoc.save();

                // Deduct posting limit if job is active
                if (isActiveFlag) {
                    employer.totaljobpostinglimit = Math.max(0, (employer.totaljobpostinglimit || 0) - 1);
                    await employer.save();
                }

                const status = "Job Posted";
                results.push({
                    row: index + 1,
                    status,
                    companyName,
                    jobTitle,
                    jobId,
                    employerId: employer._id.toString(),
                    employerWasCreated,
                    isActive: isActiveFlag,
                });
                if (onProgress) onProgress(status);
            } catch (rowErr) {
                console.error(`Row ${index + 1} import error:`, rowErr);
                const status = "Failed - " + (rowErr.message || String(rowErr));
                results.push({ row: index + 1, status, reason: rowErr.message || String(rowErr) });
                if (onProgress) onProgress(status);
            }
        } // for rows

        return { success: true, total: rows.length, results };
    } catch (err) {
        console.error("Bulk import error:", err);
        return { success: false, error: err.message || String(err) };
    }
}

module.exports = { bulkImportJobs };
