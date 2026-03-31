// lib/editAssistClient.ts

export type EditAssistMode = "grammar" | "rewrite" | "continue" | "suggest";

export type EditAssistOptions = {
  text: string;
  mode?: EditAssistMode;
  instruction?: string;
};

export async function callEditAssist(opts: EditAssistOptions) {
  const text = (opts.text ?? "").toString();
  const mode: EditAssistMode = opts.mode ?? "grammar";
  const instruction = (opts.instruction ?? "").toString();

  const res = await fetch("/api/edit-assist", {
    method: "POST",
    credentials: "include", // CRITICAL for cookie-based auth
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      mode,
      instruction: instruction.trim(),
    }),
  });

  const json: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err =
      json?.error ||
      `Request failed: ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`;
    throw new Error(err);
  }

  const result = typeof json?.result === "string" ? json.result : "";
  return result.trim();
}