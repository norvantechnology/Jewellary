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

// Standard Helvetica / Helvetica-Bold glyph widths (1/1000 em) for ASCII 32-126, used to
// right-align money columns without embedding a font.
const HELV =
  "278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584"
    .split(",")
    .map(Number);
const HELV_BOLD =
  "278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584"
    .split(",")
    .map(Number);

function textWidth(text: string, font: "F1" | "F2", size: number): number {
  const table = font === "F2" ? HELV_BOLD : HELV;
  let units = 0;
  for (const ch of toPdfAscii(text)) {
    const code = ch.charCodeAt(0);
    units += table[code - 32] ?? 556;
  }
  return (units * size) / 1000;
}

/** Word-wraps text to a max width (in points), returning at most `maxLines` lines. */
function wrapText(text: string, font: "F1" | "F2", size: number, maxWidth: number, maxLines = 2) {
  const words = toPdfAscii(text).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, font, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last.length > 1 && textWidth(`${last}...`, font, size) > maxWidth) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = `${last.trimEnd()}...`;
    return kept;
  }
  return lines;
}

function friendlyStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING_PAYMENT: "Awaiting payment",
    PAYMENT_FAILED: "Payment failed",
    PAID: "Paid",
    PROCESSING: "In the workshop",
    PACKED: "Packed",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
  };
  return map[status] ?? status.replace(/_/g, " ").toLowerCase();
}

function titleCase(input: string): string {
  return input.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

type Rgb = readonly [number, number, number];
const INK: Rgb = [0.09, 0.09, 0.09];
const BODY: Rgb = [0.25, 0.25, 0.25];
const MUTED: Rgb = [0.45, 0.45, 0.45];
const GOLD: Rgb = [0.72, 0.57, 0.23];
const GOLD_LIGHT: Rgb = [0.83, 0.69, 0.37];
const PANEL: Rgb = [0.965, 0.961, 0.953];
const LINE: Rgb = [0.88, 0.88, 0.88];
const WHITE: Rgb = [1, 1, 1];

/**
 * Generates a self-contained multi-page PDF 1.4 invoice without native binaries, so it runs in
 * serverless builds. Layout: brand header band, invoice details, bill/ship cards, item table,
 * totals panel, thank-you note and page numbers.
 */
export function buildOrderInvoicePdf(order: OrderConfirmationDTO, storeName: string): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 44;
  const right = pageWidth - marginX;
  const contentWidth = right - marginX;
  const bottomLimit = 70;

  const pages: string[][] = [];
  let ops: string[] = [];
  let y = 0;

  const money = (amount: string, currency = order.currency, dp = order.currencyDecimals) =>
    formatPdfMoney(amount, currency, dp);

  const rgbFill = (c: Rgb) => `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)} rg`;
  const rgbStroke = (c: Rgb) => `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)} RG`;

  const rect = (x: number, yPos: number, w: number, h: number, fill: Rgb) => {
    ops.push(`${rgbFill(fill)} ${x} ${yPos} ${w} ${h} re f`);
  };
  const rule = (yPos: number, color: Rgb = LINE, x1 = marginX, x2 = right, width = 0.7) => {
    ops.push(`${rgbStroke(color)} ${width} w ${x1} ${yPos} m ${x2} ${yPos} l S`);
  };
  const text = (
    x: number,
    yPos: number,
    value: string,
    opts: { font?: "F1" | "F2"; size?: number; color?: Rgb; align?: "left" | "right" } = {},
  ) => {
    const font = opts.font ?? "F1";
    const size = opts.size ?? 10;
    const color = opts.color ?? BODY;
    const xPos = opts.align === "right" ? x - textWidth(value, font, size) : x;
    ops.push(
      `BT /${font} ${size} Tf ${rgbFill(color)} ${xPos.toFixed(2)} ${yPos} Td (${escapePdfText(value)}) Tj ET`,
    );
  };

  // Columns for the item table.
  const colQty = 352;
  const colUnit = 462;
  const colAmount = right - 10;
  const itemTextWidth = colQty - marginX - 34;

  const drawTableHeader = () => {
    rect(marginX, y - 8, contentWidth, 24, PANEL);
    text(marginX + 10, y, "ITEM", { font: "F2", size: 8.5, color: MUTED });
    text(colQty, y, "QTY", { font: "F2", size: 8.5, color: MUTED, align: "right" });
    text(colUnit, y, "UNIT PRICE", { font: "F2", size: 8.5, color: MUTED, align: "right" });
    text(colAmount, y, "AMOUNT", { font: "F2", size: 8.5, color: MUTED, align: "right" });
    y -= 30;
  };

  const startPage = (first: boolean) => {
    if (ops.length > 0) pages.push(ops);
    ops = [];
    // Brand band + gold rule.
    const bandHeight = first ? 86 : 50;
    rect(0, pageHeight - bandHeight, pageWidth, bandHeight, INK);
    rect(0, pageHeight - bandHeight - 3, pageWidth, 3, GOLD);
    const brandY = pageHeight - (first ? 50 : 32);
    text(marginX, brandY, storeName.toUpperCase(), {
      font: "F2",
      size: first ? 20 : 13,
      color: GOLD_LIGHT,
    });
    text(right, brandY, first ? "INVOICE" : `INVOICE ${order.orderNumber} (continued)`, {
      font: "F2",
      size: first ? 18 : 10,
      color: WHITE,
      align: "right",
    });
    if (first) {
      text(marginX, brandY - 18, "Handmade fine jewelry", { size: 9, color: [0.8, 0.8, 0.8] });
      text(right, brandY - 18, order.contactEmail, {
        size: 9,
        color: [0.8, 0.8, 0.8],
        align: "right",
      });
    }
    y = pageHeight - bandHeight - 3 - (first ? 34 : 30);
  };

  const ensureSpace = (needed: number, withTableHeader = false) => {
    if (y - needed < bottomLimit) {
      startPage(false);
      if (withTableHeader) drawTableHeader();
    }
  };

  startPage(true);

  // Invoice details: four labelled columns.
  const rawPayment = (order.paymentStatus ?? (order.paidAt ? "PAID" : "PENDING")).toUpperCase();
  const paymentLabel = ["CAPTURED", "SUCCEEDED", "SUCCESS", "PAID", "AUTHORIZED"].includes(
    rawPayment,
  )
    ? "Paid"
    : titleCase(rawPayment.replace(/_/g, " "));
  const details: Array<[string, string]> = [
    ["INVOICE NUMBER", order.orderNumber],
    ["INVOICE DATE", formatPdfDate(order.createdAt)],
    [
      "PAYMENT",
      `${paymentLabel}${order.paymentProvider ? ` - ${titleCase(order.paymentProvider)}` : ""}`,
    ],
    ["ORDER STATUS", friendlyStatus(order.status)],
  ];
  const detailCol = contentWidth / details.length;
  details.forEach(([label, value], i) => {
    const x = marginX + i * detailCol;
    text(x, y, label, { font: "F2", size: 7.5, color: MUTED });
    text(x, y - 15, truncateText(value, 26), { font: "F2", size: 10, color: INK });
  });
  y -= 40;

  // Bill to / Ship to cards.
  const addressLines = (a: OrderConfirmationDTO["shippingAddress"]) =>
    [
      a.line1,
      a.line2 ?? "",
      `${a.city}${a.state ? `, ${a.state}` : ""} ${a.postalCode}`.trim(),
      formatCountryName(a.country),
      a.phone ? `Phone: ${a.phone}` : "",
    ].filter(Boolean);
  const cards = [
    {
      label: "BILL TO",
      name: order.billingAddress.fullName,
      lines: addressLines(order.billingAddress),
    },
    {
      label: `SHIP TO - ${order.shippingMethodName}`,
      name: order.shippingAddress.fullName,
      lines: addressLines(order.shippingAddress),
    },
  ];
  const gap = 14;
  const cardWidth = (contentWidth - gap) / 2;
  const cardHeight = 34 + Math.max(...cards.map((c) => c.lines.length)) * 13 + 12;
  cards.forEach((card, i) => {
    const x = marginX + i * (cardWidth + gap);
    rect(x, y - cardHeight + 12, cardWidth, cardHeight, PANEL);
    rect(x, y - cardHeight + 12, 3, cardHeight, GOLD);
    let cy = y - 4;
    text(x + 14, cy, truncateText(card.label, 44), { font: "F2", size: 7.5, color: MUTED });
    cy -= 16;
    text(x + 14, cy, truncateText(card.name, 40), { font: "F2", size: 10.5, color: INK });
    cy -= 14;
    for (const line of card.lines) {
      text(x + 14, cy, truncateText(line, 46), { size: 9, color: BODY });
      cy -= 13;
    }
  });
  y -= cardHeight + 18;

  // Items.
  drawTableHeader();
  order.items.forEach((item, idx) => {
    const titleLines = wrapText(item.titleSnapshot, "F2", 10, itemTextWidth, 2);
    const meta = [item.variantTitleSnapshot, item.skuSnapshot ? `SKU ${item.skuSnapshot}` : ""]
      .filter(Boolean)
      .join("  |  ");
    const rowHeight = titleLines.length * 13 + (meta ? 12 : 0) + 14;
    ensureSpace(rowHeight, true);
    const rowTop = y;
    titleLines.forEach((line, li) => {
      text(marginX + 10, rowTop - li * 13, line, { font: "F2", size: 10, color: INK });
    });
    if (meta) {
      text(marginX + 10, rowTop - titleLines.length * 13 - 1, truncateText(meta, 62), {
        size: 8.5,
        color: MUTED,
      });
    }
    text(colQty, rowTop, String(item.quantity), { size: 10, color: INK, align: "right" });
    text(colUnit, rowTop, money(item.unitPrice), { size: 9.5, color: BODY, align: "right" });
    text(colAmount, rowTop, money(item.lineTotal), {
      font: "F2",
      size: 10,
      color: INK,
      align: "right",
    });
    y -= rowHeight;
    if (idx < order.items.length - 1) rule(y + 9);
  });
  rule(y + 9, [0.75, 0.75, 0.75]);
  y -= 8;

  // Totals panel on the right.
  const totalsRows: Array<[string, string]> = [["Subtotal", money(order.subtotal)]];
  if (Number(order.discountAmount) > 0)
    totalsRows.push(["Discount", `-${money(order.discountAmount)}`]);
  totalsRows.push([
    "Shipping",
    Number(order.shippingCost) === 0 ? "Free" : money(order.shippingCost),
  ]);
  totalsRows.push(["Tax", money(order.taxAmount)]);
  const extraRows: Array<[string, string]> = [];
  if (order.chargedAmount && order.chargedCurrency && order.chargedCurrency !== order.currency) {
    extraRows.push([
      `Charged in ${order.chargedCurrency}`,
      money(order.chargedAmount, order.chargedCurrency, 2),
    ]);
  }

  const panelX = 330;
  const panelHeight = totalsRows.length * 17 + 52 + extraRows.length * 15;
  ensureSpace(panelHeight + 70);
  let ty = y;
  for (const [label, value] of totalsRows) {
    text(panelX + 12, ty, label, { size: 9.5, color: MUTED });
    text(colAmount, ty, value, { size: 9.5, color: INK, align: "right" });
    ty -= 17;
  }
  ty -= 6;
  rect(panelX, ty - 12, right - panelX, 28, INK);
  text(panelX + 12, ty - 2, `Total (${order.currency})`, { font: "F2", size: 11, color: WHITE });
  text(colAmount, ty - 2, money(order.total), {
    font: "F2",
    size: 12,
    color: GOLD_LIGHT,
    align: "right",
  });
  ty -= 34;
  for (const [label, value] of extraRows) {
    text(panelX + 12, ty, label, { size: 8.5, color: MUTED });
    text(colAmount, ty, value, { size: 8.5, color: BODY, align: "right" });
    ty -= 15;
  }

  // Thank-you note on the left of the totals.
  text(marginX, y, "Thank you for your order.", { font: "F2", size: 11, color: INK });
  const note = wrapText(
    `Every piece is handmade to order by our jewelers. For questions about this invoice, sizing or care, write to ${order.contactEmail}.`,
    "F1",
    9,
    panelX - marginX - 24,
    5,
  );
  note.forEach((line, i) => text(marginX, y - 16 - i * 12, line, { size: 9, color: BODY }));
  y = Math.min(ty, y - 16 - note.length * 12) - 10;

  pages.push(ops);

  // Page footers ("Page x of n") on every page.
  pages.forEach((pageOps, idx) => {
    ops = pageOps;
    rule(48, LINE);
    text(marginX, 34, `${storeName}  |  Invoice ${order.orderNumber}`, { size: 8, color: MUTED });
    text(right, 34, `Page ${idx + 1} of ${pages.length}`, {
      size: 8,
      color: MUTED,
      align: "right",
    });
  });

  const contentOpsPages = pages;

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
