import { NextResponse } from "next/server";
import { z } from "zod";

const TOKEN_URL = "https://github.com/login/oauth/access_token";

const tokenRequestSchema = z.object({
  client_id: z.string().min(1).max(100),
  device_code: z.string().min(1).max(200),
  grant_type: z.literal("urn:ietf:params:oauth:grant-type:device_code"),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = tokenRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const res = await fetch(TOKEN_URL, {
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
