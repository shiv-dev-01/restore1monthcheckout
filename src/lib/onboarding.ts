import { loadLeadAnswers } from "@/lib/lead-webhook";

const ONBOARDING_BASE = "https://restoredelivered.com/onboarding/";

export type OnboardingFields = {
  orderId?: string | number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  state?: string;
  dob?: string;
  sex?: string;
  heightFt?: string | number;
  heightIn?: string | number;
  weightLbs?: string | number;
  goalWeight?: string | number;
};

function splitDob(dob?: string) {
  if (!dob) return { day: "", month: "", year: "" };
  // Accept YYYY-MM-DD or MM/DD/YYYY
  if (dob.includes("-")) {
    const [year, month, day] = dob.split("-");
    return { day: day ?? "", month: month ?? "", year: year ?? "" };
  }
  if (dob.includes("/")) {
    const [month, day, year] = dob.split("/");
    return { day: day ?? "", month: month ?? "", year: year ?? "" };
  }
  return { day: "", month: "", year: "" };
}

/** Builds the Restore Delivered intake/onboarding URL with order + lead fields. */
export function buildOnboardingUrl(fields: OnboardingFields = {}): string {
  const lead = loadLeadAnswers();
  const dob = splitDob(fields.dob || String(lead.dob ?? ""));
  const params = new URLSearchParams();

  params.set("usState", fields.state || String(lead.state ?? ""));
  params.set("fullName[first]", fields.firstName || String(lead.first_name ?? ""));
  params.set("fullName[last]", fields.lastName || String(lead.last_name ?? ""));
  params.set("dob[day]", dob.day);
  params.set("dob[month]", dob.month);
  params.set("dob[year]", dob.year);
  params.set("email", fields.email || String(lead.email ?? ""));
  params.set("phoneNumber", fields.phone || String(lead.phone ?? ""));
  params.set("sex", fields.sex || String(lead.sex_at_birth ?? ""));
  params.set(
    "height_fi_feet",
    fields.heightFt != null ? String(fields.heightFt) : String(lead.height_ft ?? ""),
  );
  params.set(
    "height_fi_inches",
    fields.heightIn != null ? String(fields.heightIn) : String(lead.height_in ?? ""),
  );
  params.set(
    "weight_lbs",
    fields.weightLbs != null ? String(fields.weightLbs) : String(lead.current_weight ?? ""),
  );
  params.set(
    "goal_weight",
    fields.goalWeight != null ? String(fields.goalWeight) : String(lead.goal_weight ?? ""),
  );
  params.set("order_id", fields.orderId != null ? String(fields.orderId) : "");

  return `${ONBOARDING_BASE}?${params.toString()}`;
}
