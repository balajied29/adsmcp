import { NextResponse, type NextRequest } from "next/server";
import { getAccountContext } from "@/lib/account";

/** GET ?q=fitness — live interest search for the audience builder. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAccountContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ interests: [] });

  try {
    const interests = await ctx.meta.launch.searchInterests(q);
    return NextResponse.json({ interests });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interest search failed" },
      { status: 502 },
    );
  }
}
