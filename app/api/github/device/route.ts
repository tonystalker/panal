import { NextResponse } from "next/server";

const DEVICE_CODE_URL = "https://github.com/login/device/code";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const res = await fetch(DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
