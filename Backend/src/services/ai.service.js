const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const puppeteer = require("puppeteer");
const { zodToJsonSchema } = require("zod-to-json-schema");

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

const MAX_AI_ATTEMPTS = 2;

const interviewReportJsonSchema = {
  type: "object",
  properties: {
    matchScore: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description:
        "Score from 0-100 indicating how well the candidate matches the job requirements",
    },
    technicalQuestions: {
      type: "array",
      minItems: 8,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The technical interview question",
          },
          intention: {
            type: "string",
            description: "What the interviewer is testing with this question",
          },
          answer: {
            type: "string",
            description:
              "Detailed answer with approach, key points, and pitfalls",
          },
        },
        required: ["question", "intention", "answer"],
      },
    },
    behavioralQuestions: {
      type: "array",
      minItems: 5,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The behavioral interview question",
          },
          intention: {
            type: "string",
            description: "What competency the interviewer is evaluating",
          },
          answer: {
            type: "string",
            description: "STAR method answer with key points to highlight",
          },
        },
        required: ["question", "intention", "answer"],
      },
    },
    skillGaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string", description: "The missing or weak skill" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["skill", "severity"],
      },
    },
    preparationPlan: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          day: { type: "integer", description: "Day number from 1 to 7" },
          focus: {
            type: "string",
            description: "Main topic to study that day",
          },
          task: {
            type: "string",
            description: "Specific actionable tasks for the day",
          },
        },
        required: ["day", "focus", "task"],
      },
    },
    title: {
      type: "string",
      description: "A Role fit based on report",
    },
  },
  required: [
    "matchScore",
    "technicalQuestions",
    "behavioralQuestions",
    "skillGaps",
    "preparationPlan",
    "title",
  ],
};

const interviewReportZodSchema = z.object({
  matchScore: z.number().min(0).max(100),
  technicalQuestions: z.array(
    z.object({
      question: z.string(),
      intention: z.string(),
      answer: z.string(),
    }),
  ),
  behavioralQuestions: z.array(
    z.object({
      question: z.string(),
      intention: z.string(),
      answer: z.string(),
    }),
  ),
  skillGaps: z.array(
    z.object({
      skill: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    }),
  ),
  preparationPlan: z.array(
    z.object({
      day: z.number().min(1).max(7),
      focus: z.string(),
      task: z.string(),
    }),
  ),
  title: z.string(),
});

const resumePdfSchema = z.object({
  html: z
    .string()
    .describe(
      "HTML content of the resume which can be converted to pdf using any library like puppeteer",
    ),
});

const parseAIResponseText = (response) => {
  if (!response || typeof response.text !== "string") {
    throw new Error("AI response is missing expected text payload.");
  }

  try {
    return JSON.parse(response.text);
  } catch (error) {
    throw new Error(`AI JSON parse error: ${error.message}`);
  }
};

const validateAIResponse = (payload, schema) => {
  try {
    return schema.parse(payload);
  } catch (error) {
    throw new Error(`AI validation error: ${error.message}`);
  }
};

const generateWithRetry = async ({
  model,
  contents,
  config,
  responseJsonSchema,
  validationSchema,
}) => {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          ...config,
          responseJsonSchema,
        },
      });

      const parsed = parseAIResponseText(response);
      if (!validationSchema) {
        return parsed;
      }

      return validateAIResponse(parsed, validationSchema);
    } catch (error) {
      lastError = error;
      console.warn(`[AI] attempt ${attempt} failed: ${error.message}`);
      if (attempt === MAX_AI_ATTEMPTS) {
        throw new Error(
          `AI generation failed after ${MAX_AI_ATTEMPTS} attempts: ${error.message}`,
        );
      }
    }
  }

  throw lastError;
};

const buildInterviewReportPrompt = ({ resume, jobDescription, selfDescription }) => `You are an expert technical recruiter and interview coach with 15+ years of experience.

Use the candidate context below to generate a structured interview preparation report.

### Candidate profile context
Resume:
${resume}

Job Description:
${jobDescription}

Self Description:
${selfDescription}

### Instructions
- Use only the provided context. Do not invent additional candidate details.
- Return valid JSON only, with no markdown, no explanations, and no extra fields.
- Ensure the output matches the schema exactly.

### Output structure
{
  "matchScore": integer,
  "technicalQuestions": [{ "question": string, "intention": string, "answer": string }],
  "behavioralQuestions": [{ "question": string, "intention": string, "answer": string }],
  "skillGaps": [{ "skill": string, "severity": "low" | "medium" | "high" }],
  "preparationPlan": [{ "day": integer, "focus": string, "task": string }],
  "title": string
}

### Output requirements
- matchScore: realistic 0-100 fit score.
- technicalQuestions: 8-10 questions based on the resume and job description.
- behavioralQuestions: 5-6 tailored STAR-style responses.
- skillGaps: missing or weak skills with severity.
- preparationPlan: exactly 7 daily tasks.
- title: concise summary of candidate's fit and preparation focus.
`;

const buildResumePdfPrompt = ({ resume, jobDescription, selfDescription }) => `You are an expert resume writer and career coach.

Use the candidate profile context below to produce a structured resume HTML payload.

### Candidate profile context
Resume:
${resume}

Job Description:
${jobDescription}

Self Description:
${selfDescription}

### Instructions
- Return valid JSON only, with a single field named "html".
- Do not add markdown, comments, or extra fields.
- The HTML output should be clean, professional, and ATS friendly.
- Keep the resume length to 1-2 pages when converted to PDF.

### Output structure
{
  "html": string
}
`;

async function generateInterviewReport({ resume, jobDescription, selfDescription }) {
  const prompt = buildInterviewReportPrompt({ resume, jobDescription, selfDescription });

  const data = await generateWithRetry({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
    responseJsonSchema: interviewReportJsonSchema,
    validationSchema: interviewReportZodSchema,
  });

  return data;
}

const generatePdfFromHtml = async (htmlContent) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
  });
  await browser.close();

  return pdfBuffer;
};

const generateResumePdf = async ({ jobDescription, resume, selfDescription }) => {
  const prompt = buildResumePdfPrompt({ resume, jobDescription, selfDescription });

  const jsonContent = await generateWithRetry({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
    responseJsonSchema: zodToJsonSchema(resumePdfSchema),
    validationSchema: resumePdfSchema,
  });

  const pdfBuffer = await generatePdfFromHtml(jsonContent.html);
  return pdfBuffer;
};

module.exports = { generateInterviewReport, generateResumePdf };
