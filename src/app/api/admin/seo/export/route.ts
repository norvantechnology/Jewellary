import { NextResponse, type NextRequest } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { listBulkSeoItems, listRedirectsAndNotFoundAdmin } from "@/modules/seo/seo.service";
import { getOptionalSession } from "@/server/dal";
import { db } from "@/server/db";

function csvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function toCsvRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(csvCell).join(",");
}

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session || !hasPermission(session.user.role, "settings:manage")) {
    return NextResponse.json({ error: "Administrator permission required." }, { status: 403 });
  }

  const kind = request.nextUrl.searchParams.get("kind") || "bulk";

  if (kind === "redirects") {
    const data = await listRedirectsAndNotFoundAdmin();
    const lines = [
      toCsvRow(["from_path", "to_path", "status_code", "hits", "active", "note", "last_hit_at"]),
      ...data.rules.map((r) =>
        toCsvRow([
          r.fromPath,
          r.toPath ?? "",
          r.statusCode,
          r.hits,
          r.isActive,
          r.note ?? "",
          r.lastHitAt ?? "",
        ]),
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="seo-redirects.csv"',
      },
    });
  }

  if (kind === "audit") {
    const latest = await db.seoAuditRun.findFirst({ orderBy: { createdAt: "desc" } });
    const rawIssues = Array.isArray(latest?.issues) ? latest.issues : [];
    const lines = [
      toCsvRow(["severity", "code", "entity_type", "url", "message"]),
      ...rawIssues.map((entry) => {
        const obj = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
        return toCsvRow([
          String(obj.severity ?? ""),
          String(obj.code ?? ""),
          String(obj.entityType ?? ""),
          String(obj.url ?? ""),
          String(obj.message ?? ""),
        ]);
      }),
    ];
    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="seo-audit-issues.csv"',
      },
    });
  }

  const bulk = await listBulkSeoItems();
  const lines = [
    toCsvRow([
      "entity_type",
      "id",
      "name",
      "url",
      "seo_title",
      "seo_description",
      "seo_keywords",
      "noindex",
      "score",
      "issues_count",
    ]),
    ...bulk.map((item) =>
      toCsvRow([
        item.entityType,
        item.id,
        item.name,
        item.url,
        item.seoTitle ?? "",
        item.seoDescription ?? "",
        item.seoKeywords ?? "",
        item.noindex,
        item.score,
        item.issuesCount,
      ]),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="seo-bulk-metadata.csv"',
    },
  });
}
