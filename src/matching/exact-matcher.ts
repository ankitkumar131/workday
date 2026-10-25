import {
  DetectedField,
  QuestionAnswer,
  UserProfile,
} from "../shared/types";
import { normalizeQuestion } from "./normalize-question";

export interface ExactMatchCandidate {
  source: "question-bank-exact" | "question-bank-alt" | "profile";
  answerId?: string;
  matchedQuestion: string;
  value: string | string[] | boolean;
  confidence: number;
  priority: number;
}

/**
 * Checks Question Bank for:
 * Priority 1: Exact normalized question match (confidence 1.0)
 * Priority 2: Exact normalized alternative phrasing match (confidence 0.97)
 */
export function findExactQuestionBankMatches(
  normalizedFieldQuestion: string,
  questions: QuestionAnswer[]
): ExactMatchCandidate[] {
  if (!normalizedFieldQuestion) return [];
  const matches: ExactMatchCandidate[] = [];

  for (const q of questions) {
    if (!q.enabled) continue;
    const qNorm = q.normalizedQuestion || normalizeQuestion(q.question);

    if (qNorm === normalizedFieldQuestion) {
      matches.push({
        source: "question-bank-exact",
        answerId: q.id,
        matchedQuestion: q.question,
        value: q.answer,
        confidence: 1.0,
        priority: q.priority ?? 5,
      });
      continue;
    }

    if (q.alternativeQuestions && q.alternativeQuestions.length > 0) {
      const altHit = q.alternativeQuestions.find(
        (alt) => normalizeQuestion(alt) === normalizedFieldQuestion
      );
      if (altHit) {
        matches.push({
          source: "question-bank-alt",
          answerId: q.id,
          matchedQuestion: altHit,
          value: q.answer,
          confidence: 0.97,
          priority: q.priority ?? 5,
        });
      }
    }
  }

  return matches.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.priority - a.priority;
  });
}

/**
 * Resolves direct profile values for standard Workday personal, professional,
 * repeatable education, and repeatable employment history fields.
 */
export function findProfileFieldMatch(
  field: Pick<
    DetectedField,
    | "questionText"
    | "normalizedQuestion"
    | "inputType"
    | "sectionType"
    | "sectionIndex"
    | "automationId"
  >,
  profile: UserProfile
): ExactMatchCandidate | null {
  const norm =
    field.normalizedQuestion || normalizeQuestion(field.questionText);
  const autoId = (field.automationId || "").toLowerCase();
  const secType = field.sectionType || "general";
  const idx = field.sectionIndex ?? 0;

  // 1. Repeatable Work Experience Section
  if (secType === "experience" || /workexperience/.test(autoId)) {
    const emp = profile.employment[idx];
    if (!emp) return null;

    if (
      /\b(job title|title|position|role)\b/.test(norm) ||
      /jobtitle/.test(autoId)
    ) {
      return makeProfileHit("Job Title", emp.jobTitle, 0.96);
    }
    if (
      /\b(company|employer|organization)\b/.test(norm) ||
      /company|employer/.test(autoId)
    ) {
      return makeProfileHit("Company / Employer Name", emp.employerName, 0.96);
    }
    if (/\blocation\b/.test(norm)) {
      return makeProfileHit("Work Location", emp.location, 0.94);
    }
    if (/\b(start date|from date|from)\b/.test(norm)) {
      return makeProfileHit("Role Start Date", emp.startDate, 0.94);
    }
    if (/\b(end date|to date|to)\b/.test(norm) && !emp.currentlyEmployed) {
      return makeProfileHit("Role End Date", emp.endDate, 0.94);
    }
    if (/\b(currently work|current job|currently employed)\b/.test(norm)) {
      return {
        source: "profile",
        matchedQuestion: "Currently Work Here",
        value: emp.currentlyEmployed,
        confidence: 0.95,
        priority: 9,
      };
    }
    if (
      /\b(role description|responsibilities|description|summary of duties)\b/.test(
        norm
      )
    ) {
      const combined = emp.achievements
        ? `${emp.responsibilities}\n${emp.achievements}`
        : emp.responsibilities;
      return makeProfileHit("Role Description", combined, 0.94);
    }
  }

  // 2. Repeatable Education Section
  if (secType === "education" || /education/.test(autoId)) {
    const edu = profile.education[idx];
    if (!edu) return null;

    if (
      /\b(school|institution|university|college)\b/.test(norm) ||
      /school|institution/.test(autoId)
    ) {
      return makeProfileHit("School or University", edu.institution, 0.96);
    }
    if (/\bdegree\b/.test(norm) || /degree/.test(autoId)) {
      return makeProfileHit("Degree", edu.degree, 0.95);
    }
    if (
      /\b(field of study|major|discipline|specialization)\b/.test(norm) ||
      /fieldofstudy|major/.test(autoId)
    ) {
      return makeProfileHit("Field of Study", edu.fieldOfStudy, 0.95);
    }
    if (/\b(gpa|grade point average|overall result)\b/.test(norm)) {
      return makeProfileHit("GPA", edu.gpa, 0.95);
    }
    if (/\b(start date|from year|start year)\b/.test(norm)) {
      return makeProfileHit("Education Start Date", edu.startDate, 0.93);
    }
    if (
      /\b(graduation date|end date|completion date|to year|end year)\b/.test(
        norm
      )
    ) {
      return makeProfileHit("Graduation Date", edu.graduationDate, 0.94);
    }
  }

  // 3. Personal & Contact Information
  if (
    /^(legal )?first name$/.test(norm) ||
    /^(given name)$/.test(norm) ||
    /legalnamesection.*firstname/.test(autoId)
  ) {
    return makeProfileHit("First Name", profile.personal.firstName, 0.99);
  }
  if (
    /^(legal )?middle name$/.test(norm) ||
    /legalnamesection.*middlename/.test(autoId)
  ) {
    return makeProfileHit("Middle Name", profile.personal.middleName, 0.98);
  }
  if (
    /^(legal )?(last name|surname|family name)$/.test(norm) ||
    /legalnamesection.*lastname/.test(autoId)
  ) {
    return makeProfileHit("Last Name", profile.personal.lastName, 0.99);
  }
  if (/^(preferred name|nickname)$/.test(norm)) {
    return makeProfileHit(
      "Preferred Name",
      profile.personal.preferredName || profile.personal.firstName,
      0.96
    );
  }
  if (/^(full name|legal name)$/.test(norm)) {
    const full = [profile.personal.firstName, profile.personal.lastName]
      .filter(Boolean)
      .join(" ");
    return makeProfileHit("Full Name", full, 0.97);
  }
  if (/^(email|email address|e mail address)$/.test(norm) || /email/.test(autoId)) {
    return makeProfileHit("Email Address", profile.personal.email, 0.99);
  }
  if (
    /^(phone|phone number|mobile phone|telephone number|primary phone|contact number)$/.test(
      norm
    ) ||
    /phonenumber/.test(autoId)
  ) {
    return makeProfileHit("Phone Number", profile.personal.phone, 0.99);
  }
  if (/^(country phone code|phone country code)$/.test(norm)) {
    return makeProfileHit(
      "Phone Country Code",
      profile.personal.phoneCountryCode,
      0.96
    );
  }
  if (
    /^(address|address line 1|street address|current address|mailing address)$/.test(
      norm
    ) ||
    /addresssection.*addressline1/.test(autoId)
  ) {
    return makeProfileHit("Address Line 1", profile.personal.addressLine1, 0.98);
  }
  if (
    /^(address line 2|apartment|apt suite|suite)$/.test(norm) ||
    /addresssection.*addressline2/.test(autoId)
  ) {
    return makeProfileHit("Address Line 2", profile.personal.addressLine2, 0.96);
  }
  if (/^(city|town)$/.test(norm) || /addresssection.*city/.test(autoId)) {
    return makeProfileHit("City", profile.personal.city, 0.98);
  }
  if (
    /^(state|province|region|state province)$/.test(norm) ||
    /addresssection.*countryregion/.test(autoId)
  ) {
    return makeProfileHit("State / Province", profile.personal.state, 0.97);
  }
  if (
    /^(postal code|zip code|zip|zip postal code)$/.test(norm) ||
    /addresssection.*postalcode/.test(autoId)
  ) {
    return makeProfileHit("Postal Code", profile.personal.postalCode, 0.98);
  }
  if (/^country$/.test(norm) || /addresssection.*country\b/.test(autoId)) {
    return makeProfileHit("Country", profile.personal.country, 0.98);
  }
  if (/\blinkedin\b/.test(norm) || /linkedin/.test(autoId)) {
    return makeProfileHit("LinkedIn URL", profile.personal.linkedInUrl, 0.98);
  }
  if (/\bgithub\b/.test(norm) || /github/.test(autoId)) {
    return makeProfileHit("GitHub URL", profile.personal.githubUrl, 0.98);
  }
  if (/\b(portfolio|personal website|website url|blog url)\b/.test(norm)) {
    return makeProfileHit("Portfolio URL", profile.personal.portfolioUrl, 0.96);
  }

  // 4. General Fallback for top-level school / degree / current title
  if (/^(current job title|current title)$/.test(norm)) {
    return makeProfileHit(
      "Current Job Title",
      profile.professional.currentJobTitle,
      0.95
    );
  }
  if (/^(current company|current employer)$/.test(norm)) {
    return makeProfileHit(
      "Current Employer",
      profile.professional.currentEmployer,
      0.95
    );
  }
  if (/^(professional summary|summary)$/.test(norm)) {
    return makeProfileHit(
      "Professional Summary",
      profile.professional.summary,
      0.94
    );
  }
  if (/^(cover letter)$/.test(norm)) {
    return makeProfileHit(
      "Cover Letter",
      profile.skillsAndDocs.coverLetterText,
      0.94
    );
  }

  return null;
}

function makeProfileHit(
  label: string,
  value: string,
  confidence: number
): ExactMatchCandidate | null {
  if (!value || !value.trim()) return null;
  return {
    source: "profile",
    matchedQuestion: `Profile: ${label}`,
    value: value.trim(),
    confidence,
    priority: 10,
  };
}
