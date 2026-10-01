import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const DEVICE_CODE_URL = "https://github.com/login/device/code";

const deviceRequestSchema = z.object({
  client_id: z.string().min(1).max(100),
  scope: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = deviceRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const res = await fetch(DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parseResult.data),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
