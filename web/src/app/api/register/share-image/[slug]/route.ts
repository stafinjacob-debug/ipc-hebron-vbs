import { buildRegistrationPortalShareImage } from "@/lib/registration-portal-share-image";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const image = await buildRegistrationPortalShareImage(slug);
  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
