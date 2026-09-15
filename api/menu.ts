// Vercel serverless function — zero-config: any api/*.ts file exporting a
// default (req, res) handler is deployed as its own serverless function
// automatically, no vercel.json needed. Reachable at /api/menu once this
// app is deployed on Vercel.
//
// GET /api/menu?dispensaryId=<id> -> { dispensaryId, dispensaryName, totalCount, items }
//                                     or { error } with a 400/404 status.
//
// Locally (npm run dev / npm run preview, no Vercel involved), the exact
// same route is served by a small Vite dev-server plugin in
// vite.config.ts, which reuses handleMenuRequest below — so this works
// identically with or without an actual Vercel deployment.
import { handleMenuRequest, writeJsonResult, type JsonWritableResponse } from './_menuHandler'

export default function handler(req: { url?: string }, res: JsonWritableResponse): void {
  writeJsonResult(res, handleMenuRequest(req.url))
}
