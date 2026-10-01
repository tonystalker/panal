import { NextResponse } from "next/server";
import { z } from "zod";

const LC_GRAPHQL_URL = "https://leetcode.com/graphql";

const LEETCODE_QUERY = `
  query recentSubmissions($username: String!, $limit: Int!) {
    recentSubmissionList(username: $username, limit: $limit) {
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
    matchedUser(username: $username) {
      username
      submissionCalendar
      submitStats {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
    }
  }
`;

const leetcodeRequestSchema = z.object({
  username: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(100).optional().default(100),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parseResult = leetcodeRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { username, limit } = parseResult.data;

    const res = await fetch(LC_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        query: LEETCODE_QUERY,
        variables: { username, limit },
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `LeetCode upstream error: ${res.status} ${res.statusText}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
