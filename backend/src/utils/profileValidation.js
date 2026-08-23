import { EDUCATION_LEVELS, REQUIRED_PROFILE_FIELDS, SEX_OPTIONS } from "../models/User.js";

/**
 * One set of profile rules, shared by the two paths that write a profile:
 * signup (utils are called from otp.controller) and the profile editor
 * (users.controller). Keeping them in one place is what stops a value the
 * signup form accepts from being rejected the first time the user edits it.
 */

export const MIN_AGE_YEARS = 16;

/** The most recent birth date that still satisfies the minimum age. */
export const latestAllowedBirthDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  return d;
};

export const PHONE_PATTERN = /^[+\d][\d\s()-]{6,19}$/;

/** Labels the UI shows, so a field error reads the same on both sides. */
export const FIELD_LABELS = {
  fullName: "Full name",
  email: "Email",
  password: "Password",
  phone: "Mobile number",
  location: "Location",
  institution: "Institution",
  educationLevel: "Education level",
  fieldOfStudy: "Field of study",
  sex: "Sex",
  dateOfBirth: "Date of birth",
  bio: "Short bio",
};

const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

/**
 * Validates whichever profile fields are present and returns a
 * `{ field: message }` map — empty when everything checks out. Returning per
 * field rather than a single string is what lets both the API and the form
 * put each message directly under the input it belongs to.
 *
 * `requireAll` is used at signup, where the whole profile must be captured up
 * front; the profile editor patches individual fields and leaves it off.
 */
export const validateProfile = (fields = {}, { requireAll = false } = {}) => {
  const errors = {};
  const has = (name) => name in fields;

  if (requireAll) {
    if (isBlank(fields.fullName)) errors.fullName = "Full name is required";
    for (const name of REQUIRED_PROFILE_FIELDS) {
      if (isBlank(fields[name])) errors[name] = `${FIELD_LABELS[name] || name} is required`;
    }
  } else if (has("fullName") && isBlank(fields.fullName)) {
    errors.fullName = "Full name cannot be empty";
  }

  if (!errors.fullName && has("fullName") && String(fields.fullName).trim().length < 2) {
    errors.fullName = "Full name is too short";
  }
  if (!errors.phone && !isBlank(fields.phone) && !PHONE_PATTERN.test(String(fields.phone).trim())) {
    errors.phone = "That phone number looks invalid";
  }
  if (!errors.educationLevel && !isBlank(fields.educationLevel)
      && !EDUCATION_LEVELS.includes(fields.educationLevel)) {
    errors.educationLevel = "Choose an education level from the list";
  }
  if (!errors.sex && !isBlank(fields.sex) && !SEX_OPTIONS.includes(fields.sex)) {
    errors.sex = "Choose an option from the list";
  }

  if (!isBlank(fields.dateOfBirth)) {
    const dob = new Date(fields.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      errors.dateOfBirth = "That is not a valid date";
    } else if (dob > new Date()) {
      errors.dateOfBirth = "Date of birth cannot be in the future";
    } else if (dob > latestAllowedBirthDate()) {
      errors.dateOfBirth = `You must be at least ${MIN_AGE_YEARS} years old`;
    } else if (dob < new Date("1900-01-01")) {
      // Guards against obvious nonsense like a year of 1600.
      errors.dateOfBirth = "That date is unrealistically early";
    }
  }

  if (!isBlank(fields.bio) && String(fields.bio).length > 500) {
    errors.bio = "Bio must be 500 characters or fewer";
  }

  return errors;
};

/** First message from a field-error map, for callers that want one string. */
export const firstError = (errors) => {
  const key = Object.keys(errors)[0];
  return key ? errors[key] : null;
};

export default { validateProfile, firstError, MIN_AGE_YEARS, latestAllowedBirthDate, FIELD_LABELS };
