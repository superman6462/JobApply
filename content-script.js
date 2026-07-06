/**
 * Project: BD Job Autofill
 * Module: Content Script
 * Purpose: Detects form fields on the active page and fills them using the
 *          supplied profile data when triggered by the popup. Consults
 *          teletalk-mapping.js for exact name/id matches on Teletalk-style
 *          hostnames before falling back to generic label-text matching.
 * Author: Lead Engineer
 * Version: 1.2.0
 * Dependencies: teletalk-mapping.js
 * Last Updated: 2026-07-06
 */

/**
 * Maps profile field keys to arrays of matching patterns tested against
 * input name, id, placeholder, and associated label text (all lowercased).
 * @type {Record<string, string[]>}
 */
const FIELD_PATTERNS = {
  fullName: ['full name', 'fullname', 'name', 'applicant name', 'candidate name'],
  fatherName: ["father's name", 'father name', 'fathername'],
  motherName: ["mother's name", 'mother name', 'mothername'],
  dateOfBirth: ['date of birth', 'dob', 'birth date', 'birthdate'],
  gender: ['gender', 'sex'],
  nid: ['nid', 'national id', 'national identity'],
  mobile: ['mobile', 'phone', 'contact number', 'cell'],
  email: ['email', 'e-mail'],
  presentAddress: ['present address', 'current address', 'mailing address'],
  permanentAddress: ['permanent address'],
  district: ['district', 'zilla'],
  postOffice: ['post office', 'post-office'],
  postCode: ['post code', 'postcode', 'zip'],
  fatherOccupation: ["father's occupation", 'father occupation'],
  religion: ['religion'],
  nationality: ['nationality'],
  maritalStatus: ['marital status'],
  bloodGroup: ['blood group'],
  quota: ['quota'],
  depStatus: ['departmental', 'candidate status', 'dep status', 'ds'],
  ssc: ['ssc', 'secondary school certificate'],
  hsc: ['hsc', 'higher secondary certificate'],
  bachelor: ['bachelor', 'graduation', 'honours'],
  master: ['master', 'masters', 'post-graduation'],
  postCodeArea: ['thana', 'upazila'],
  experienceComputer: ['word processing', 'email', 'fax machine', 'computer efficiency', 'experience in computer'],
  experienceSatlipi: ['satlipi', 'typing speed', 'words per minute', 'wpm']
};

/**
 * Normalizes a string for pattern matching: lowercase, trimmed, collapsed spaces.
 * @param {string} value
 * @returns {string}
 */
function normalize(value) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Builds a searchable text blob describing a form element (name, id,
 * placeholder, aria-label, and any associated <label> text).
 * @param {HTMLElement} element
 * @returns {string}
 */
function describeElement(element) {
  const parts = [
    element.getAttribute('name'),
    element.getAttribute('id'),
    element.getAttribute('placeholder'),
    element.getAttribute('aria-label')
  ];

  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label) {
      parts.push(label.textContent);
    }
  }

  const parentLabel = element.closest('label');
  if (parentLabel) {
    parts.push(parentLabel.textContent);
  }

  return normalize(parts.filter(Boolean).join(' '));
}

/**
 * Finds the profile field key that best matches a form element's description.
 * @param {string} description
 * @returns {string|null}
 */
function matchFieldKey(description) {
  for (const [fieldKey, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      if (description.includes(pattern)) {
        return fieldKey;
      }
    }
  }
  return null;
}

/**
 * Sets a value on a text-like input/textarea and dispatches events so
 * frameworks (React/Vue/vanilla listeners) observe the change.
 * @param {HTMLInputElement|HTMLTextAreaElement} element
 * @param {string} value
 */
function setTextValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Selects a matching <option> in a <select> element by visible text or value.
 * @param {HTMLSelectElement} element
 * @param {string} value
 * @returns {boolean} whether a match was applied
 */
function setSelectValue(element, value) {
  const normalizedValue = normalize(value);
  for (const option of element.options) {
    if (normalize(option.textContent) === normalizedValue || normalize(option.value) === normalizedValue) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  for (const option of element.options) {
    if (normalize(option.textContent).includes(normalizedValue) && normalizedValue.length > 0) {
      element.value = option.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Checks a radio button whose value or label matches the given value.
 * @param {string} name
 * @param {string} value
 * @returns {boolean} whether a match was applied
 */
function setRadioValue(name, value) {
  const normalizedValue = normalize(value);
  const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
  for (const radio of radios) {
    const description = describeElement(radio);
    if (description.includes(normalizedValue) || normalize(radio.value) === normalizedValue) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

/**
 * Resolves a profile field key for a form element: tries the Teletalk exact
 * name/id map first (when the active hostname qualifies), then falls back
 * to generic label-text matching so unmapped/new fields are still attempted.
 * @param {HTMLElement} element
 * @returns {string|null}
 */
function resolveFieldKey(element) {
  if (typeof isTeletalkHostname === 'function' && isTeletalkHostname(window.location.hostname)) {
    const exactKey = resolveTeletalkFieldKey(element.getAttribute('name'), element.getAttribute('id'));
    if (exactKey) {
      return exactKey;
    }
  }
  return matchFieldKey(describeElement(element));
}

/**
 * Fills all matchable form fields on the page using the given profile.
 * @param {Record<string, string>} profileData
 * @returns {number} count of fields successfully filled
 */
function fillForm(profileData) {
  let filledCount = 0;
  const seenRadioNames = new Set();

  const formElements = document.querySelectorAll('input, select, textarea');

  for (const element of formElements) {
    const type = (element.getAttribute('type') || '').toLowerCase();

    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'file' || element.disabled) {
      continue;
    }

    if (type === 'radio') {
      const name = element.getAttribute('name');
      if (!name || seenRadioNames.has(name)) {
        continue;
      }
      const fieldKey = resolveFieldKey(element) || matchFieldKey(name.toLowerCase());
      const profileValue = fieldKey ? profileData[fieldKey] : undefined;
      if (profileValue && setRadioValue(name, profileValue)) {
        filledCount += 1;
        seenRadioNames.add(name);
      }
      continue;
    }

    if (type === 'checkbox') {
      continue;
    }

    const fieldKey = resolveFieldKey(element);
    if (!fieldKey) {
      continue;
    }

    const profileValue = profileData[fieldKey];
    if (profileValue === undefined || profileValue === null || profileValue === '') {
      continue;
    }

    if (element.tagName === 'SELECT') {
      if (setSelectValue(element, profileValue)) {
        filledCount += 1;
      }
      continue;
    }

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      setTextValue(element, profileValue);
      filledCount += 1;
    }
  }

  return filledCount;
}

// Handle ping to check if content script is ready
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'PING') {
    sendResponse({ ok: true });
    return true;
  }

  if (!message || message.type !== 'AUTOFILL_PAGE') {
    return false;
  }

  try {
    const filledCount = fillForm(message.payload || {});
    sendResponse({ ok: true, data: { filledCount } });
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }

  return false;
});
