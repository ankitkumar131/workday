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
 * Also supports long multi-paragraph Workday questions that end with the saved question sentence.
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

    // Support long Workday preamble paragraphs ending with the exact question sentence
    if (
      qNorm.length >= 24 &&
      normalizedFieldQuestion.length > qNorm.length &&
      normalizedFieldQuestion.endsWith(qNorm)
    ) {
      matches.push({
        source: "question-bank-exact",
        answerId: q.id,
        matchedQuestion: q.question,
        value: q.answer,
        confidence: 0.99,
        priority: q.priority ?? 5,
      });
      continue;
    }

    if (q.alternativeQuestions && q.alternativeQuestions.length > 0) {
      const altHit = q.alternativeQuestions.find((alt) => {
        const altNorm = normalizeQuestion(alt);
        if (!altNorm) return false;
        if (altNorm === normalizedFieldQuestion) return true;
        return (
          altNorm.length >= 24 &&
          normalizedFieldQuestion.length > altNorm.length &&
          normalizedFieldQuestion.endsWith(altNorm)
        );
      });
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
    const emp = profile.employment[idx] || profile.employment[0];
    if (!emp) return null;

    if (
      /\b(job title|title|position|role)\b/.test(norm) &&
      !/\bdescription\b/.test(norm)
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
    if (
      /\b(start date|from date)\b/.test(norm) ||
      /^from(\s+month|\s+year)?$/.test(norm) ||
      /startdate/.test(autoId)
    ) {
      return makeProfileHit("Role Start Date", emp.startDate, 0.95);
    }
    if (
      (/\b(end date|to date)\b/.test(norm) ||
        /^to(\s+month|\s+year)?$/.test(norm) ||
        /enddate/.test(autoId)) &&
      !emp.currentlyEmployed
    ) {
      return makeProfileHit("Role End Date", emp.endDate, 0.95);
    }
    if (
      /\b(currently work here|i currently work here|current job|currently employed)\b/.test(
        norm
      )
    ) {
      return {
        source: "profile",
        matchedQuestion: "I currently work here",
        value: emp.currentlyEmployed,
        confidence: 0.96,
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
      return makeProfileHit("Role Description", combined, 0.95);
    }
  }

  // 2. Repeatable Education Section
  if (secType === "education" || /education/.test(autoId)) {
    const edu = profile.education[idx] || profile.education[0];
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
    if (/\b(gpa|cgpa|grade point average|overall result)\b/.test(norm)) {
      return makeProfileHit("Overall Result (GPA)", edu.gpa, 0.96);
    }
    if (
      /\b(start date|from year|start year)\b/.test(norm) ||
      /^from$/.test(norm)
    ) {
      return makeProfileHit("Education From Year", edu.startDate, 0.94);
    }
    if (
      /\b(graduation date|end date|completion date|to year|end year|actual or expected)\b/.test(
        norm
      ) ||
      /^to$/.test(norm)
    ) {
      return makeProfileHit("Education To Year", edu.graduationDate, 0.94);
    }
  }

  // 3. Personal & Contact Information (including Workday's Given Name(s), Local Given Name(s), Family Name, etc.)
  if (
    /^(legal\s+)?(local\s+)?(first\s+name|given\s+name(\s+s)?)$/.test(norm) ||
    /\b(given\s+name(\s+s)?|first\s+name)$/.test(norm) ||
    /legalnamesection.*firstname|givenname/.test(autoId)
  ) {
    return makeProfileHit("First / Given Name", profile.personal.firstName, 0.99);
  }
  if (
    /^(legal\s+)?(local\s+)?middle\s+name$/.test(norm) ||
    /legalnamesection.*middlename/.test(autoId)
  ) {
    return makeProfileHit("Middle Name", profile.personal.middleName, 0.98);
  }
  if (
    /^(legal\s+)?(local\s+)?(last\s+name|surname|family\s+name)$/.test(norm) ||
    /\b(family\s+name|last\s+name|surname)$/.test(norm) ||
    /legalnamesection.*lastname|familyname/.test(autoId)
  ) {
    return makeProfileHit("Last / Family Name", profile.personal.lastName, 0.99);
  }
  if (/^(preferred\s+name|nickname)$/.test(norm)) {
    return makeProfileHit(
      "Preferred Name",
      profile.personal.preferredName || profile.personal.firstName,
      0.96
    );
  }
  if (/^(full\s+name|legal\s+name)$/.test(norm)) {
    const full = [profile.personal.firstName, profile.personal.lastName]
      .filter(Boolean)
      .join(" ");
    return makeProfileHit("Full Name", full, 0.97);
  }
  if (
    /^(email|email\s+address|email\s+address\s+email|e\s+mail\s+address)$/.test(
      norm
    ) ||
    /email/.test(autoId)
  ) {
    return makeProfileHit("Email Address", profile.personal.email, 0.99);
  }
  if (
    /^(phone\s+)?(phone\s+number|mobile\s+phone|telephone\s+number|primary\s+phone|contact\s+number)$/.test(
      norm
    ) ||
    /^phone$/.test(norm) ||
    /phonenumber/.test(autoId)
  ) {
    return makeProfileHit("Phone Number", profile.personal.phone, 0.99);
  }
  if (
    /\b(country\s+phone\s+code|phone\s+country\s+code)\b/.test(norm) ||
    /countryphonecode/.test(autoId)
  ) {
    const code = profile.personal.phoneCountryCode || "+91";
    const country = profile.personal.country || "India";
    const formatted =
      code === "+91" && /india/i.test(country) ? "India (+91)" : code;
    return makeProfileHit("Country Phone Code", formatted, 0.97);
  }
  if (
    /\b(phone\s+device\s+type|device\s+type)\b/.test(norm) ||
    /phonetype|devicetype/.test(autoId)
  ) {
    return makeProfileHit("Phone Device Type", "Mobile", 0.97);
  }
  if (
    /^(address\s+)?(address\s+line\s+1|street\s+address|current\s+address|mailing\s+address)$/.test(
      norm
    ) ||
    /^address$/.test(norm) ||
    /addresssection.*addressline1/.test(autoId)
  ) {
    return makeProfileHit("Address Line 1", profile.personal.addressLine1, 0.98);
  }
  if (
    /^(address\s+)?(address\s+line\s+2|apartment|apt\s+suite|suite)$/.test(
      norm
    ) ||
    /addresssection.*addressline2/.test(autoId)
  ) {
    return makeProfileHit("Address Line 2", profile.personal.addressLine2, 0.96);
  }
  if (
    /^(address\s+)?(city|town)$/.test(norm) ||
    /addresssection.*city/.test(autoId)
  ) {
    return makeProfileHit("City", profile.personal.city, 0.98);
  }
  if (
    /^(address\s+)?(state|province|region|state\s+province)$/.test(norm) ||
    /addresssection.*countryregion/.test(autoId)
  ) {
    return makeProfileHit("State / Province", profile.personal.state, 0.97);
  }
  if (
    /^(address\s+)?(postal\s+code|zip\s+code|zip|zip\s+postal\s+code|pin\s+code)$/.test(
      norm
    ) ||
    /addresssection.*postalcode/.test(autoId)
  ) {
    return makeProfileHit("Postal Code", profile.personal.postalCode, 0.98);
  }
  if (
    /^(address\s+)?country$/.test(norm) ||
    /addresssection.*country\b/.test(autoId)
  ) {
    return makeProfileHit("Country", profile.personal.country, 0.98);
  }
  if (/\blinkedin\b/.test(norm) || /linkedin/.test(autoId)) {
    return makeProfileHit("LinkedIn URL", profile.personal.linkedInUrl, 0.98);
  }
  if (/\bgithub\b/.test(norm) || /github/.test(autoId)) {
    return makeProfileHit("GitHub URL", profile.personal.githubUrl, 0.98);
  }
  if (/\b(portfolio|personal\s+website|website\s+url|blog\s+url)\b/.test(norm)) {
    return makeProfileHit("Portfolio URL", profile.personal.portfolioUrl, 0.96);
  }

  // 4. General Fallback for top-level school / degree / GPA / skills / role
  if (
    /\b(school\s+or\s+university|university|institution)\b/.test(norm) &&
    profile.education[0]
  ) {
    return makeProfileHit(
      "School or University",
      profile.education[0].institution,
      0.95
    );
  }
  if (/\b(overall\s+result\s+gpa|gpa|cgpa)\b/.test(norm) && profile.education[0]) {
    return makeProfileHit("GPA", profile.education[0].gpa, 0.95);
  }
  if (
    /\b(type\s+to\s+add\s+skills|technical\s+skills)\b/.test(norm) &&
    profile.skillsAndDocs.technicalSkills.length > 0
  ) {
    return {
      source: "profile",
      matchedQuestion: "Profile: Technical Skills",
      value: profile.skillsAndDocs.technicalSkills.slice(0, 12),
      confidence: 0.94,
      priority: 8,
    };
  }
  if (/^(current\s+job\s+title|current\s+title|job\s+title)$/.test(norm)) {
    return makeProfileHit(
      "Current Job Title",
      profile.professional.currentJobTitle,
      0.95
    );
  }
  if (/^(current\s+company|current\s+employer|company)$/.test(norm)) {
    return makeProfileHit(
      "Current Employer",
      profile.professional.currentEmployer,
      0.95
    );
  }
  if (/^(professional\s+summary|summary)$/.test(norm)) {
    return makeProfileHit(
      "Professional Summary",
      profile.professional.summary,
      0.94
    );
  }
  if (/^(cover\s+letter)$/.test(norm)) {
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
