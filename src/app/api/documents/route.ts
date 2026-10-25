import { z } from "zod";
import { HttpError, handle, jsonError, ndjson, rateLimit, uploadLimits } from "@/lib/server/http";
import { ingestPdf, validateUpload } from "@/lib/server/ingest";
import { listDocuments } from "@/lib/store/repo";

export const maxDuration = 60;

/** GET /api/documents — metadata and status only, never raw text. */
export const GET = handle(async () => {
  const documents = await listDocuments();
  return Response.json({ documents });
});

const Meta = z.object({
  title: z.string().trim().max(160).default(""),
  grade: z.coerce.number().int().min(1).max(10).default(1),
  subject: z.string().trim().min(1).max(40).default("English"),
});

/** POST /api/documents — multipart upload; streams NDJSON progress (extracting → indexing → done). */
export const POST = handle(async (req: Request) => {
  rateLimit(req, "upload", 10);
  const { maxMb } = uploadLimits();
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxMb * 1024 * 1024 + 64 * 1024)
    return jsonError(413, `That file is larger than the ${maxMb} MB limit. Upload a single chapter or compress the PDF.`);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Send the PDF as multipart/form-data in a field named \"file\".");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "No file was attached. Choose a PDF to upload.");
  validateUpload(file.name, file.type, file.size);
  const meta = Meta.safeParse({
    title: form.get("title") ?? undefined,
    grade: form.get("grade") ?? undefined,
    subject: form.get("subject") ?? undefined,
  });
  if (!meta.success) throw new HttpError(400, "Class must be 1–10 and the subject must be filled in.");
  const bytes = new Uint8Array(await file.arrayBuffer());

  return ndjson(async (emit) => {
    emit({ stage: "uploaded", bytes: bytes.byteLength });
    const document = await ingestPdf({ bytes, filename: file.name, mimeType: file.type, ...meta.data }, emit);
    return { document };
  });
});
