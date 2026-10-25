import {
  EducationRecord,
  EmploymentRecord,
  PersonalInformation,
  ProfessionalInformation,
  ResumeParseDraft,
} from "../shared/types";
import { sanitizeString } from "../shared/validation";

/**
 * Extracts text locally from a File object (TXT, DOCX, PDF) without sending any
 * data over the network.
 */
export async function extractResumeTextFromFile(
  file: File
): Promise<{ text: string; warnings: string[] }> {
  const warnings: string[] = [];
  const lowerName = file.name.toLowerCase();

  if (
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    file.type === "text/plain"
  ) {
    const text = await file.text();
    return { text: sanitizeString(text, 50000), warnings };
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (lowerName.endsWith(".docx")) {
    const docxText = await extractTextFromDocxBytes(bytes);
    if (docxText.trim().length > 0) {
      return { text: sanitizeString(docxText, 50000), warnings };
    }
    warnings.push(
      "Could not decompress all DOCX XML streams automatically; please review or paste text manually."
    );
  }

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfText = extractTextFromPdfBytes(bytes);
    if (pdfText.trim().length > 0) {
      warnings.push(
        "Extracted text locally from PDF streams. Please verify all fields before applying."
      );
      return { text: sanitizeString(pdfText, 50000), warnings };
    }
    warnings.push(
      "This PDF appears to use compressed or scanned font streams. You can paste your resume text below for local parsing."
    );
  }

  // Fallback ASCII/UTF-8 printable extraction
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const rawDecoded = decoder.decode(bytes);
  const printable = rawDecoded
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { text: sanitizeString(printable, 50000), warnings };
}

async function extractTextFromDocxBytes(bytes: Uint8Array): Promise<string> {
  // Scan local zip file headers for word/document.xml
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset + 30 < bytes.length) {
    // PK\x03\x04 signature = 0x04034b50
    if (view.getUint32(offset, true) !== 0x04034b50) {
      offset++;
      continue;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLength);
    const fileName = new TextDecoder().decode(nameBytes);
    const dataStart = offset + 30 + fileNameLength + extraLength;

    if (fileName === "word/document.xml" && compressedSize > 0) {
      const slice = bytes.subarray(dataStart, dataStart + compressedSize);
      try {
        if (compressionMethod === 0) {
          const xml = new TextDecoder().decode(slice);
          return stripXmlTags(xml);
        } else if (
          compressionMethod === 8 &&
          typeof DecompressionStream !== "undefined"
        ) {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.write(slice as unknown as BufferSource);
          writer.close();
          const decompressed = await new Response(ds.readable).arrayBuffer();
          const xml = new TextDecoder().decode(decompressed);
          return stripXmlTags(xml);
        }
      } catch {
        // Fallback below
      }
    }

    offset = dataStart + Math.max(1, compressedSize);
  }

  // Fallback if XML is stored uncompressed anywhere in buffer
  const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (raw.includes("<w:t")) {
    return stripXmlTags(raw);
  }
  return "";
}

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTextFromPdfBytes(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const chunks: string[] = [];

  // Extract parenthesized literal strings in PDF text operators: (Hello) Tj or [(Hello)] TJ
  const literalRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*(?:Tj|')/g;
  let match: RegExpExecArray | null;
  while ((match = literalRegex.exec(raw)) !== null) {
    const cleaned = match[1]
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .trim();
    if (cleaned.length > 1) {
      chunks.push(cleaned);
    }
  }

  const arrayRegex = /\[((?:\([^()\\]*(?:\\.[^()\\]*)*\)|[^[\]])+)\]\s*TJ/g;
  while ((match = arrayRegex.exec(raw)) !== null) {
    const inner = match[1];
    const parts = inner.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g);
    if (parts) {
      const line = parts
        .map((p) => p.slice(1, -1).replace(/\\\(/g, "(").replace(/\\\)/g, ")"))
        .join("");
      if (line.trim().length > 1) {
        chunks.push(line.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

/**
 * Parses unstructured resume text into structured candidate fields for user review.
 */
export function parseResumeTextToDraft(
  fileName: string,
  rawText: string,
  existingWarnings: string[] = []
): ResumeParseDraft {
  const cleaned = sanitizeString(rawText, 50000);
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const extractedPersonal: Partial<PersonalInformation> = {};
  const extractedProfessional: Partial<ProfessionalInformation> = {};
  const extractedEducation: EducationRecord[] = [];
  const extractedEmployment: EmploymentRecord[] = [];
  const warnings = [...existingWarnings];

  // 1. Email
  const emailMatch = cleaned.match(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
  );
  if (emailMatch) {
    extractedPersonal.email = emailMatch[0];
  }

  // 2. Phone
  const phoneMatch = cleaned.match(
    /(?:\+?(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/
  );
  if (phoneMatch) {
    if (phoneMatch[1]) {
      extractedPersonal.phoneCountryCode = `+${phoneMatch[1]}`;
    }
    extractedPersonal.phone = `${phoneMatch[2]}-${phoneMatch[3]}-${phoneMatch[4]}`;
  }

  // 3. LinkedIn, GitHub, Portfolio URLs
  const urlMatches = cleaned.match(/https?:\/\/[^\s|,;)]+/gi) || [];
  for (const url of urlMatches) {
    if (/linkedin\.com/i.test(url) && !extractedPersonal.linkedInUrl) {
      extractedPersonal.linkedInUrl = url;
    } else if (/github\.com/i.test(url) && !extractedPersonal.githubUrl) {
      extractedPersonal.githubUrl = url;
    } else if (!extractedPersonal.portfolioUrl) {
      extractedPersonal.portfolioUrl = url;
    }
  }

  // 4. First & Last Name heuristic from first non-empty line
  if (lines.length > 0) {
    const firstLine = lines[0].split(/[|•,-]/)[0].trim();
    const words = firstLine.split(/\s+/).filter((w) => /^[A-Za-z.'-]+$/.test(w));
    if (words.length >= 2 && words.length <= 4) {
      extractedPersonal.firstName = words[0];
      extractedPersonal.lastName = words[words.length - 1];
      if (words.length === 3) {
        extractedPersonal.middleName = words[1];
      }
    }
  }

  // 5. Location heuristic (e.g., "San Francisco, CA")
  const cityStateMatch = cleaned.match(
    /\b([A-Z][a-zA-Z.\s]{2,24}),\s*([A-Z]{2})\b/
  );
  if (cityStateMatch) {
    extractedPersonal.city = cityStateMatch[1].trim();
    extractedPersonal.state = cityStateMatch[2].trim();
  }

  // 6. Years of experience heuristic
  const yearsMatch = cleaned.match(/(\d{1,2})\+?\s*years?\s+of\s+experience/i);
  if (yearsMatch) {
    extractedProfessional.totalYearsExperience = yearsMatch[1];
  }

  // 7. Summary heuristic
  const summaryIdx = lines.findIndex((l) =>
    /^(professional\s+summary|summary|profile|objective)$/i.test(l)
  );
  if (summaryIdx !== -1 && lines[summaryIdx + 1]) {
    extractedProfessional.summary = lines
      .slice(summaryIdx + 1, summaryIdx + 4)
      .join(" ");
  } else if (lines.length > 1) {
    const candidateSummary = lines.find(
      (l) => l.length > 60 && !l.includes("@") && !l.includes("http")
    );
    if (candidateSummary) {
      extractedProfessional.summary = candidateSummary;
    }
  }

  // 8. Skills heuristic
  const knownTechSkills = [
    "TypeScript",
    "JavaScript",
    "React",
    "Node.js",
    "Python",
    "Java",
    "Go",
    "C#",
    "C++",
    "SQL",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "GraphQL",
    "REST",
    "AWS",
    "Azure",
    "GCP",
    "Docker",
    "Kubernetes",
    "Git",
    "HTML",
    "CSS",
    "Next.js",
    "Vue",
    "Angular",
    "Playwright",
    "Vitest",
    "Jest",
  ];
  const extractedSkills = knownTechSkills.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(cleaned);
  });

  // 9. Education heuristic
  const degreeRegex =
    /\b(Bachelor|Master|B\.S\.|M\.S\.|B\.A\.|M\.B\.A\.|Ph\.D\.)[^,\n]*(?:in\s+([A-Za-z\s&]+))?/i;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(degreeRegex);
    if (m) {
      const nextLine = lines[i + 1] || "";
      extractedEducation.push({
        id: `edu-draft-${extractedEducation.length + 1}`,
        degree: m[1],
        fieldOfStudy: (m[2] || "Computer Science").trim(),
        institution: nextLine && nextLine.length < 80 ? nextLine : "University",
        startDate: "",
        graduationDate: "",
        gpa: "",
      });
      break;
    }
  }

  // 10. Employment heuristic
  const roleRegex =
    /\b(Senior\s+Software\s+Engineer|Software\s+Engineer|Frontend\s+Engineer|Backend\s+Engineer|Full\s*Stack\s+Developer|Product\s+Manager|Data\s+Scientist|Engineering\s+Manager)\b/i;
  const roleMatch = cleaned.match(roleRegex);
  if (roleMatch) {
    extractedProfessional.currentJobTitle = roleMatch[1];
    extractedEmployment.push({
      id: "emp-draft-1",
      employerName: "Extracted Employer (Review Before Saving)",
      jobTitle: roleMatch[1],
      employmentType: "Full-time",
      location: extractedPersonal.city
        ? `${extractedPersonal.city}, ${extractedPersonal.state || ""}`.trim()
        : "",
      startDate: "",
      endDate: "",
      currentlyEmployed: true,
      responsibilities: extractedProfessional.summary || "",
      achievements: "",
      skillsUsed: extractedSkills.slice(0, 6),
    });
  }

  if (
    !extractedPersonal.firstName &&
    !extractedPersonal.email &&
    extractedSkills.length === 0
  ) {
    warnings.push(
      "Limited structured fields were detected. Please review and edit the fields below before applying to your profile."
    );
  }

  return {
    fileName,
    rawText: cleaned,
    extractedPersonal,
    extractedProfessional,
    extractedEducation,
    extractedEmployment,
    extractedSkills,
    warnings,
  };
}
