import { connection } from "next/server";
import { publicAiStatus } from "@/lib/ai/config";
import { uploadLimits } from "@/lib/server/http";
import { storageStatus } from "@/lib/store/kv";

/** Browser-safe view of the current mode, storage and limits. */
export async function GET() {
  await connection();
  return Response.json({ ai: publicAiStatus(), storage: storageStatus(), limits: uploadLimits() });
}
