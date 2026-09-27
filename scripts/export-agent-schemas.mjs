// Dumps the Next.js <-> Python agent wire contract (lib/schemas/chat.ts) as
// JSON Schema, checked in at agent-service/schemas/*.json. Run after editing
// that file: `npm run export-agent-schemas`. See lib/schemas/chat.ts for why
// this exists instead of trying to share the TS types directly with Python.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";
import { agentChatRequestSchema, agentChatResponseSchema } from "../lib/schemas/chat.ts";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "..", "agent-service", "schemas");
mkdirSync(outDir, { recursive: true });

const files = {
  "agent-chat-request.schema.json": agentChatRequestSchema,
  "agent-chat-response.schema.json": agentChatResponseSchema,
};

for (const [file, schema] of Object.entries(files)) {
  const jsonSchema = z.toJSONSchema(schema);
  writeFileSync(path.join(outDir, file), `${JSON.stringify(jsonSchema, null, 2)}\n`);
  console.log(`Wrote agent-service/schemas/${file}`);
}
