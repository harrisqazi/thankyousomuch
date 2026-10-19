import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { get, list } from "@vercel/blob";

async function storageToken(): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const apiToken = process.env.VERCEL_API_TOKEN?.trim();
  if (!apiToken) throw new Error("BLOB_READ_WRITE_TOKEN or VERCEL_API_TOKEN must be saved in Secrets.");
  const project = "prj_YajX779TmS3MMMkSRPg3frVv9ml0";
  const headers = { Authorization: `Bearer ${apiToken}` };
  const envResponse = await fetch(`https://api.vercel.com/v10/projects/${project}/env`, { headers });
  if (!envResponse.ok) throw new Error(`Could not access storage configuration (${envResponse.status}).`);
  const { envs } = await envResponse.json() as { envs: Array<{ id: string; key: string }> };
  const env = envs.find(value => value.key === "BLOB_READ_WRITE_TOKEN");
  if (!env) throw new Error("The private inquiry store is not connected to this Vercel project.");
  const tokenResponse = await fetch(`https://api.vercel.com/v1/projects/${project}/env/${env.id}`, { headers });
  if (!tokenResponse.ok) throw new Error(`Could not authenticate to private storage (${tokenResponse.status}).`);
  const result = await tokenResponse.json() as { value?: string };
  if (!result.value) throw new Error("Private storage credential is unavailable.");
  return result.value;
}

async function main() {
  const token = await storageToken();
  const inquiries: unknown[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ token, prefix: "inquiries/", cursor, limit: 100 });
    for (const blob of page.blobs) {
      const result = await get(blob.pathname, { token, access: "private", useCache: false });
      if (!result || result.statusCode !== 200) throw new Error("An inquiry could not be read. Export stopped rather than omitting it.");
      inquiries.push(await new Response(result.stream).json());
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const directory = resolve(fileURLToPath(new URL("../../", import.meta.url)), ".local/lead-backups");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const output = resolve(directory, `inquiries-${new Date().toISOString().replaceAll(":", "-")}.json`);
  await writeFile(output, JSON.stringify({ exportedAt: new Date().toISOString(), count: inquiries.length, inquiries }, null, 2), { mode: 0o600 });
  console.log(`Exported ${inquiries.length} private inquiries to ${output}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Inquiry export failed.");
  process.exitCode = 1;
});
