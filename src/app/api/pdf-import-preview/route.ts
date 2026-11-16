import { isPdfPreviewEnabled, loadPdfPilotAsset, loadFullPdfAsset } from "@/lib/pdf-preview-server";

export async function GET(request: Request) {
  // No private source material is available in production, even if a preview
  // environment variable is accidentally copied into Render settings.
  const url = new URL(request.url);
  if (!isPdfPreviewEnabled() || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return new Response(null, { status: 404 });
  try {
    const name = url.searchParams.get("asset") || "";
    const data = url.searchParams.get("batch") === "full" ? await loadFullPdfAsset(name) : await loadPdfPilotAsset(name);
    if (!data) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(data), { headers: {
      "Content-Type": "image/png", "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
    } });
  } catch { return new Response(null, { status: 404 }); }
}
