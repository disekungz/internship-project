export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

export const MANHOUR_API_ENDPOINT =
  `${API_BASE_URL}/mh/manhour`;

export const MANHOUR_VERSION_ENDPOINT =
  `${MANHOUR_API_ENDPOINT}/version`;

export const MANHOUR_MONTHS_ENDPOINT =
  `${MANHOUR_API_ENDPOINT}/months`;

export const MANHOUR_SUMMARY_ENDPOINT =
  `${MANHOUR_API_ENDPOINT}/summary`;

export const MANHOUR_CALENDAR_ENDPOINT =
  `${MANHOUR_API_ENDPOINT}/calendar`;

export const MANHOUR_HELP_SUMMARY_ENDPOINT =
  `${API_BASE_URL}/mh/help/summary`;

export const MANHOUR_IMPORT_ENDPOINT =
  `${MANHOUR_API_ENDPOINT}/import`;

export const MANHOUR_VDS_FORMULA_ENDPOINT =
  `${API_BASE_URL}/mh/lines/vds-formulas`;

export const MANHOUR_COST_CENTER_OPTIONS_ENDPOINT =
  `${API_BASE_URL}/mh/lines/cost-center-prefixes`;

export const MANHOUR_EMPLOYEES_SEARCH_ENDPOINT =
  `${API_BASE_URL}/mh/employees/search`;

export const MANHOUR_CUSTOM_MAPPINGS_ENDPOINT =
  `${API_BASE_URL}/mh/lines/custom-mappings`;