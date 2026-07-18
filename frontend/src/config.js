export const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
export const API_BASE = `${API_ORIGIN}/api`;

// OCR document scanning needs easyocr/torch on the backend, which doesn't
// fit free-tier hosting memory limits — hide the feature when disabled there.
export const OCR_ENABLED = import.meta.env.VITE_ENABLE_OCR_SCAN !== "false";
