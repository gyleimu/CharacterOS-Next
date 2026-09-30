import {
  hashReadinessRequestV0,
  READINESS_SYSTEM_BYTES,
  READINESS_USER_BYTES,
  READINESS_PROBES_PLANNED,
  READINESS_TIMEOUT_MS,
  READINESS_REQUEST
} from "./contract-readiness.ts";
const FROZEN = "sha256:00339f4acf551b10c185c0cbbc427b511ec2f4a6c84530dd73075c001c96f338";
const now = hashReadinessRequestV0();
console.log("request hash now :", now);
console.log("HASH UNCHANGED   :", now === FROZEN);
console.log("system/user bytes:", READINESS_SYSTEM_BYTES, "/", READINESS_USER_BYTES);
console.log("num_predict/ctx/timeout:", READINESS_REQUEST.options.num_predict, "/", READINESS_REQUEST.options.num_ctx, "/", READINESS_TIMEOUT_MS);
console.log("planned N        :", READINESS_PROBES_PLANNED);
console.log("structured_output :", (READINESS_REQUEST as Record<string, unknown>)["format"] === undefined ? "ABSENT (no format field)" : "PRESENT");
