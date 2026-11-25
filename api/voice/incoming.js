// Explicit Vercel entrypoint: a root dynamic function does not cover nested paths.
import app from "../../artifacts/api-server/dist/app.mjs";

export const config = { api: { bodyParser: false } };

export default app;
