// Today's official CBAR exchange rates. Fetched from cbar.az at most once an
// hour (Next.js data cache); if cbar.az can't be reached, the bundled copy is
// returned, marked origin: "snapshot", so the page always shows a dated rate.
import { NextResponse } from "next/server";
import { getRates } from "@/lib/rates-server";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(await getRates());
}
