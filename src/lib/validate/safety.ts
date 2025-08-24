const banned = [
  /\bage\b|\bhow old\b/i,
  /\breligion\b|\bfaith\b/i,
  /\bmarried|marital|pregnan|children|family planning\b/i,
  /\bnationality|citizenship|origin\b/i,
  /\bdisab|medical|health condition\b/i
];

const pii = [
  /\b\d{3}-\d{2}-\d{4}\b/,      // SSN-like
  /\b\d{16}\b/,                 // crude cc number
  /\b\d{5}(-\d{4})?\b/,         // ZIP
  /\b[\w.-]+@[\w.-]+\.\w+\b/    // emails
];

export function riskyQuestion(q: string) {
  return banned.some(rx => rx.test(q));
}

export function redactPII(text: string) {
  let t = text;
  pii.forEach(rx => t = t.replace(rx, "[REDACTED]"));
  return t;
}


