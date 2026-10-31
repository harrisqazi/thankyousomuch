import { businesses } from "../telnyx/config";
import { getVoiceFlow } from "./flows";
import { voiceFlows } from "./text-to-speech";

try {
  for (const id of Object.keys(voiceFlows)) getVoiceFlow(id);
  const configured = businesses();
  process.stdout.write(`Phone configuration valid: ${configured.length} business(es), ${Object.keys(voiceFlows).length} voice flow(s).\n`);
  if (process.env.TELNYX_BUSINESSES_JSON) {
    process.stdout.write("NOTE: TELNYX_BUSINESSES_JSON overrides phone-numbers.ts. Edit that override or remove it to use the file.\n");
  }
  process.stdout.write("This checks code configuration only, not carrier approval, webhook setup, publication, or delivery.\n");
} catch {
  process.stderr.write("Invalid phone configuration. Check numbers, unique business/profile IDs, flow IDs, voices, placeholders, and keypad actions.\n");
  process.exitCode = 1;
}
