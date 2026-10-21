import { delay } from "./api.js?v=20261020d";
export async function analyzeIssue({
  category = "Other",
  description = "",
} = {}) {
  await delay(1300);
  return {
    category,
    severity: description.toLowerCase().includes("water") ? "High" : "Medium",
    confidence: 92,
    notes:
      "Mock assessment: image and description are queued for review by the municipal team.",
  };
}
export async function verifyResolution() {
  await delay(900);
  return {
    confidence: 94,
    result: "Likely resolved",
    note: "Mock AI comparison. Final status requires human verification.",
  };
}
