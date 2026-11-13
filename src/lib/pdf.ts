import type { OrderConfirmationDTO } from "@/modules/orders/order.service";
import { formatCountryName } from "@/lib/countries";

function toPdfAscii(input: string): string {
  return input
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(input: string): string {
  return toPdfAscii(input).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function truncateText(input: string, maxChars: number): string {
  const clean = toPdfAscii(input);
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 3))}...`;
}

function formatPdfMoney(amount: string, currency: string, decimals: number): string {
  const num = Number(amount);
  const formatted = Number.isFinite(num)
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(num)
    : amount;
  return `${currency} ${formatted}`;
}

function formatPdfDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Generates a self-contained single/multi-page PDF 1.4 receipt buffer without
 * runtime native binaries so it runs reliably in serverless and container builds.
 */
export function buildOrderInvoicePdf(order: OrderConfirmationDTO, storeName: string): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 48;

  const contentOpsPages: string[][] = [];
  let ops: string[] = [];
  let y = 740;

  const pushPage = () => {
    if (ops.length > 0) {
      contentOpsPages.push(ops);
    }
    ops = [];
    y = 740;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < 64) {
      pushPage();
    }
  };

  const textLine = (
    x: number,
    yPos: number,
    text: string,
    opts?: { font?: "F1" | "F2"; size?: number; gray?: number },
  ) => {
    const font = opts?.font ?? "F1";
    const size = opts?.size ?? 10;
    const gray = opts?.gray ?? 0.1;
    ops.push(
      `BT /${font} ${size} Tf ${gray.toFixed(2)} g ${x} ${yPos} Td (${escapePdfText(text)}) Tj ET`,
    );
  };

  const ruleLine = (yPos: number, gray = 0.82) => {
    ops.push(`${gray.toFixed(2)} G 0.7 w ${marginX} ${yPos} m ${pageWidth - marginX} ${yPos} l S`);
  };

  // Header
  textLine(marginX, y, storeName.toUpperCase(), { font: "F2", size: 16, gray: 0.08 });
  textLine(430, y, "TAX INVOICE / RECEIPT", { font: "F2", size: 11, gray: 0.25 });
  y -= 18;
  textLine(marginX, y, `Order Number: ${order.orderNumber}`, { font: "F2", size: 10, gray: 0.15 });
  textLine(430, y, `Date: ${formatPdfDate(order.createdAt)}`, { size: 10, gray: 0.25 });
  y -= 14;
  textLine(marginX, y, `Order Status: ${order.status}`, { size: 9, gray: 0.3 });
  textLine(
    430,
    y,
    `Payment: ${order.paymentStatus ?? (order.paidAt ? "PAID" : "PENDING")}${order.paymentProvider ? ` (${order.paymentProvider})` : ""}`,
    { size: 9, gray: 0.3 },
  );
  y -= 14;
  textLine(
    marginX,
    y,
    `Display Currency: ${order.currency} | FX Snapshot: 1 ${order.baseCurrency} = ${Number(order.exchangeRate).toFixed(4)} ${order.currency}`,
    { size: 9, gray: 0.35 },
  );
  y -= 16;
  ruleLine(y, 0.75);
  y -= 18;

  // Shipping & Billing two columns
  const colRight = 320;
  textLine(marginX, y, "DELIVERY ADDRESS", { font: "F2", size: 9, gray: 0.35 });
  textLine(colRight, y, "BILLING ADDRESS", { font: "F2", size: 9, gray: 0.35 });
  y -= 14;

  const shipLines = [
    order.shippingAddress.fullName,
    order.shippingAddress.line1,
    ...(order.shippingAddress.line2 ? [order.shippingAddress.line2] : []),
    `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
    formatCountryName(order.shippingAddress.country),
    order.shippingAddress.phone,
  ];
  const billLines = [
    order.billingAddress.fullName,
    order.billingAddress.line1,
    ...(order.billingAddress.line2 ? [order.billingAddress.line2] : []),
    `${order.billingAddress.city}, ${order.billingAddress.state} ${order.billingAddress.postalCode}`,
    formatCountryName(order.billingAddress.country),
    order.billingAddress.phone,
  ];

  const addrRows = Math.max(shipLines.length, billLines.length);
  for (let i = 0; i < addrRows; i++) {
    if (shipLines[i]) {
      textLine(marginX, y, truncateText(shipLines[i]!, 42), { size: 9, gray: 0.15 });
    }
    if (billLines[i]) {
      textLine(colRight, y, truncateText(billLines[i]!, 42), { size: 9, gray: 0.15 });
    }
    y -= 13;
  }

  y -= 10;
  ruleLine(y, 0.75);
  y -= 18;

  // Items header
  textLine(marginX, y, "PIECE / DESCRIPTION", { font: "F2", size: 9, gray: 0.35 });
  textLine(325, y, "SKU", { font: "F2", size: 9, gray: 0.35 });
  textLine(400, y, "QTY", { font: "F2", size: 9, gray: 0.35 });
  textLine(438, y, "UNIT", { font: "F2", size: 9, gray: 0.35 });
  textLine(510, y, "TOTAL", { font: "F2", size: 9, gray: 0.35 });
  y -= 8;
  ruleLine(y, 0.85);
  y -= 15;

  for (const item of order.items) {
    ensureSpace(34);
    textLine(marginX, y, truncateText(item.titleSnapshot, 42), { font: "F2", size: 9.5 });
    textLine(325, y, truncateText(item.skuSnapshot, 12), { size: 9, gray: 0.3 });
    textLine(402, y, String(item.quantity), { size: 9.5 });
    textLine(438, y, formatPdfMoney(item.unitPrice, order.currency, order.currencyDecimals), {
      size: 9,
    });
    textLine(510, y, formatPdfMoney(item.lineTotal, order.currency, order.currencyDecimals), {
      font: "F2",
      size: 9,
    });
    y -= 13;
    if (item.variantTitleSnapshot) {
      textLine(marginX, y, truncateText(item.variantTitleSnapshot, 48), { size: 8.5, gray: 0.4 });
      y -= 12;
    }
    y -= 4;
  }

  ensureSpace(140);
  y -= 6;
  ruleLine(y, 0.75);
  y -= 18;

  // Totals summary (right aligned columns)
  const labelX = 365;
  const valX = 485;
  const summaryRow = (label: string, value: string, bold = false) => {
    textLine(labelX, y, label, {
      font: bold ? "F2" : "F1",
      size: bold ? 10.5 : 9.5,
      gray: bold ? 0.08 : 0.25,
    });
    textLine(valX, y, value, {
      font: bold ? "F2" : "F1",
      size: bold ? 10.5 : 9.5,
      gray: bold ? 0.08 : 0.15,
    });
    y -= 15;
  };

  summaryRow("Subtotal", formatPdfMoney(order.subtotal, order.currency, order.currencyDecimals));
  if (Number(order.discountAmount) > 0) {
    summaryRow(
      "Discount",
      `-${formatPdfMoney(order.discountAmount, order.currency, order.currencyDecimals)}`,
    );
  }
  summaryRow(
    truncateText(order.shippingMethodName, 18),
    Number(order.shippingCost) === 0
      ? "Complimentary"
      : formatPdfMoney(order.shippingCost, order.currency, order.currencyDecimals),
  );
  summaryRow("Tax", formatPdfMoney(order.taxAmount, order.currency, order.currencyDecimals));
  y -= 2;
  ruleLine(y + 8, 0.85);
  summaryRow("Total", formatPdfMoney(order.total, order.currency, order.currencyDecimals), true);

  if (order.currency !== order.baseCurrency) {
    summaryRow(
      `Base Reference (${order.baseCurrency})`,
      formatPdfMoney(order.baseTotal, order.baseCurrency, 2),
    );
  }
  if (order.chargedAmount && order.chargedCurrency) {
    const chargedDp = order.chargedCurrency === order.currency ? order.currencyDecimals : 2;
    summaryRow(
      `Settled (${order.chargedCurrency})`,
      formatPdfMoney(order.chargedAmount, order.chargedCurrency, chargedDp),
    );
  }

  // Footer
  y = Math.min(y - 12, 82);
  if (y < 60) {
    pushPage();
    y = 700;
  }
  ruleLine(y + 12, 0.88);
  textLine(marginX, y, `Questions regarding this commission? Contact ${order.contactEmail}`, {
    size: 8.5,
    gray: 0.45,
  });

  contentOpsPages.push(ops);

  // Build PDF object tree
  // 1: Catalog, 2: Pages, 3: F1 Helvetica, 4: F2 Helvetica-Bold, then pairs of (PageObj, ContentStreamObj)
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const pageRefs: string[] = [];
  const startObjId = 5;
  contentOpsPages.forEach((_, idx) => {
    pageRefs.push(`${startObjId + idx * 2} 0 R`);
  });

  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${contentOpsPages.length} >>\nendobj\n`,
  );
  objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");

  contentOpsPages.forEach((pageOps, idx) => {
    const pageId = startObjId + idx * 2;
    const contentId = pageId + 1;
    const stream = `${pageOps.join("\n")}\n`;
    const byteLen = Buffer.byteLength(stream, "latin1");

    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${byteLen} >>\nstream\n${stream}endstream\nendobj\n`,
    );
  });

  const chunks: Buffer[] = [];
  const header = Buffer.from("%PDF-1.4\n", "latin1");
  chunks.push(header);
  let offset = header.length;
  const offsets: number[] = [0];

  for (const objStr of objects) {
    offsets.push(offset);
    const buf = Buffer.from(objStr, "latin1");
    chunks.push(buf);
    offset += buf.length;
  }

  const xrefStart = offset;
  const xrefLines = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n"];
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  chunks.push(Buffer.from(xrefLines.join("") + trailer, "latin1"));
  return new Uint8Array(Buffer.concat(chunks));
}
