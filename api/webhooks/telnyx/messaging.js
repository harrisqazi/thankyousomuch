import app from "../../../artifacts/api-server/dist/app.mjs";

// Telnyx Ed25519 signatures cover the original JSON bytes. Vercel's default
// JSON body parser would turn req.body into an object and fail verification.
export const config = { api: { bodyParser: false } };

export default app;
