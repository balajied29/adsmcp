import { NextResponse, type NextRequest } from "next/server";
import { getAccountContext } from "@/lib/account";

const MAX_BYTES = 8 * 1024 * 1024; // Meta's ad image limit is 30MB; keep uploads snappy
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** POST multipart/form-data { file } — uploads to the account's image library, returns image_hash. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAccountContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Send the image as form field 'file'." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large — keep it under 8MB." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    const hash = await ctx.meta.launch.uploadImage(ctx.account.account_id, bytes);
    return NextResponse.json({ hash, filename: file.name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 502 },
    );
  }
}
