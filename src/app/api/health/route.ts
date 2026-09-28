import { db } from "@/lib/db";
import { jsonResponse } from "@/lib/security/api";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("[health] database check failed", error);
    return jsonResponse({ status: "unhealthy", database: "unreachable" }, { status: 503 });
  }

  return jsonResponse({ status: "healthy", database: "reachable" });
}
