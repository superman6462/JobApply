/**
 * Project: BD Job Autofill
 * Module: Teletalk Field Mapping
 * Purpose: Exact name/id-keyed field map for bsdb.teletalk.com.bd-style forms.
 *          Provides high-precision matching ahead of generic label-text
 *          matching in content-script.js. Unmapped fields fall through to
 *          the generic matcher so new/unseen fields are still attempted.
 * Author: Lead Engineer
 * Version: 1.1.0
 * Dependencies: none (consumed by content-script.js)
 * Last Updated: 2026-07-06
 */

/**
 * Maps a form element's exact `name` or `id` attribute to a profile field key.
 * Checked before generic label-text matching. Key precision here is what
 * makes Teletalk forms reliable, since label text on these forms is
 * inconsistent or bilingual.
 * @type {Record<string, string>}
 */
const TELETALK_EXACT_FIELD_MAP = {
  name: 'fullName',
  name_bn: 'nameBn',
  father: 'fatherName',
  father_bn: 'fatherBn',
  mother: 'motherName',
  mother_bn: 'motherBn',
  dob: 'dateOfBirth',
  nationality: 'nationality',
  religion: 'religion',
  gender: 'gender',
  nid: 'nidType',
  nid_no: 'nidNo',
  breg: 'nidType',
  breg_no: 'birthRegNo',
  passport: 'nidType',
  passport_no: 'passportNo',
  marital_status: 'maritalStatus',
  spouse_name: 'spouseName',
  mobile: 'mobile',
  confirm_mobile: 'mobileConfirm',
  email: 'email',
  quota: 'quota',
  quota_details: 'quotaDetails',
  dep_status: 'depStatus',
  ds: 'depStatus',
  present_careof: 'presentCareOf',
  present_village: 'presentAddress',
  present_district: 'presentDistrict',
  present_upazila: 'presentUpazila',
  present_post: 'presentPost',
  present_postcode: 'presentPostcode',
  same_as_present: 'sameAsPresent',
  permanent_careof: 'permanentCareOf',
  permanent_village: 'permanentAddress',
  permanent_district: 'permanentDistrict',
  permanent_upazila: 'permanentUpazila',
  permanent_post: 'permanentPost',
  permanent_postcode: 'permanentPostcode',
  ssc_exam: 'sscExam',
  ssc_roll: 'sscRoll',
  ssc_group: 'sscGroup',
  ssc_group_other: 'sscGroupOther',
  ssc_board: 'sscBoard',
  ssc_board_other: 'sscBoardOther',
  ssc_result_type: 'sscResultType',
  ssc_result: 'sscResult',
  ssc_year: 'sscYear',
  hsc_exam: 'hscExam',
  hsc_roll: 'hscRoll',
  hsc_group: 'hscGroup',
  hsc_group_other: 'hscGroupOther',
  hsc_board: 'hscBoard',
  hsc_board_other: 'hscBoardOther',
  hsc_result_type: 'hscResultType',
  hsc_result: 'hscResult',
  hsc_year: 'hscYear',
  experience_computer: 'experienceComputer',
  experience_satlipi: 'experienceSatlipi'
};

/**
 * Hostnames this mapping applies to. content-script.js should only consult
 * TELETALK_EXACT_FIELD_MAP when the active page hostname matches one of these.
 * @type {string[]}
 */
const TELETALK_HOSTNAMES = ['teletalk.com.bd'];

/**
 * Checks whether a given hostname belongs to a Teletalk-style domain.
 * @param {string} hostname
 * @returns {boolean}
 */
function isTeletalkHostname(hostname) {
  return TELETALK_HOSTNAMES.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * Resolves a profile field key from an element's exact name/id attributes.
 * Returns null if no exact match exists, signaling the caller to fall back
 * to generic label-text matching.
 * @param {string} nameAttr
 * @param {string} idAttr
 * @returns {string|null}
 */
function resolveTeletalkFieldKey(nameAttr, idAttr) {
  if (nameAttr && TELETALK_EXACT_FIELD_MAP[nameAttr]) {
    return TELETALK_EXACT_FIELD_MAP[nameAttr];
  }
  if (idAttr && TELETALK_EXACT_FIELD_MAP[idAttr]) {
    return TELETALK_EXACT_FIELD_MAP[idAttr];
  }
  return null;
}
