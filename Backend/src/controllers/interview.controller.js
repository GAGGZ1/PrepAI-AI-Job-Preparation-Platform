const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf, generateAdditionalInterviewQuestions } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")
const crypto = require("crypto");
const redisClient = require("../config/redis");

/**
 * @description Function to generate cache key for interview report based on userId, resume, job description and self description.
 */
const getCacheKey = ({ userId, resume, jobDescription, selfDescription }) => {
  const hash = crypto
    .createHash("sha256")
    .update(`${resume}|${jobDescription}|${selfDescription}`)
    .digest("hex");

  return `interviewReport:${userId}:${hash}`;
};

const getResumePdfCacheKey = (interviewReportId) => `resumePdf:${interviewReportId}`;

/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 * The controller first checks if a cached report exists for the given input. If it does, it returns the cached report. If not, it generates a new report using the AI service, saves it to the database, caches it in Redis, and returns the new report.
 */
async function generateInterViewReportController(req, res) {
  try {
    const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText();
    const { selfDescription, jobDescription } = req.body;
    const userId = req.user.id;

    const cacheKey = getCacheKey({
      userId,
      resume: resumeContent.text,
      jobDescription,
      selfDescription,
    });

    const cached = await redisClient.get(cacheKey);
    if (cached) {
       console.log("CACHE HIT:", cacheKey);
      return res.status(200).json({
       
        message: "Interview report fetched from cache.",
        interviewReport: JSON.parse(cached),
        cached: true,
      });
    }

    console.log("CACHE MISS:", cacheKey);


    const interviewReportByAi = await generateInterviewReport({
      resume: resumeContent.text,
      selfDescription,
      jobDescription,
    });

    const interviewReport = await interviewReportModel.create({
      user: userId,
      resume: resumeContent.text,
      selfDescription,
      jobDescription,
      ...interviewReportByAi,
    });

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(interviewReport));

    res.status(201).json({
      message: "Interview report generated successfully.",
      interviewReport,
      cached: false,
    });
  } catch (error) {
    console.error("Error in generateInterViewReportController:", error);
    res.status(500).json({
      message: "Failed to generate interview report.",
      error: error.message
    });
  }
}
/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {
    try {
        const { interviewId } = req.params

        const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        res.status(200).json({
            message: "Interview report fetched successfully.",
            interviewReport
        })
    } catch (error) {
        console.error("Error in getInterviewReportByIdController:", error);
        res.status(500).json({
            message: "Failed to fetch interview report.",
            error: error.message
        })
    }
}

async function loadMoreQuestionsController(req, res) {
    try {
        const { interviewReportId } = req.params
        const { type = "technical", count = 3 } = req.body

        if (!["technical", "behavioral"].includes(type)) {
            return res.status(400).json({ message: "Question type must be technical or behavioral." })
        }

        const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })
        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        const existingQuestions = type === "technical" ? interviewReport.technicalQuestions : interviewReport.behavioralQuestions
        const newQuestions = await generateAdditionalInterviewQuestions({
            resume: interviewReport.resume,
            jobDescription: interviewReport.jobDescription,
            selfDescription: interviewReport.selfDescription,
            existingQuestions,
            type,
            count: Number(count),
        })

        interviewReport[`${type}Questions`] = [...existingQuestions, ...newQuestions]
        await interviewReport.save()

        res.status(200).json({
            message: "More questions loaded successfully.",
            interviewReport,
        })
    } catch (error) {
        console.error("Error in loadMoreQuestionsController:", error)
        res.status(500).json({
            message: "Failed to load more questions.",
            error: error.message
        })
    }
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

        res.status(200).json({
            message: "Interview reports fetched successfully.",
            interviewReports
        })
    } catch (error) {
        console.error("Error in getAllInterviewReportsController:", error);
        res.status(500).json({
            message: "Failed to fetch interview reports.",
            error: error.message
        })
    }
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    try {
        const { interviewReportId } = req.params

        const interviewReport = await interviewReportModel.findById(interviewReportId)

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        const cacheKey = getResumePdfCacheKey(interviewReportId)
        const cachedPdfBase64 = await redisClient.get(cacheKey)

        if (cachedPdfBase64) {
            const pdfBuffer = Buffer.from(cachedPdfBase64, "base64")

            res.set({
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
            })

            return res.send(pdfBuffer)
        }

        const { resume, jobDescription, selfDescription } = interviewReport
        const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

        await redisClient.setEx(cacheKey, 24 * 60 * 60, pdfBuffer.toString("base64"))

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        res.send(pdfBuffer)
    } catch (error) {
        console.error("Error in generateResumePdfController:", error);
        res.status(500).json({
            message: "Failed to generate resume PDF.",
            error: error.message
        })
    }
}






module.exports = { generateInterViewReportController, getInterviewReportByIdController, loadMoreQuestionsController, getAllInterviewReportsController, generateResumePdfController }