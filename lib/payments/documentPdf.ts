import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { getPublicInvitationUrl, siteConfig } from "@/lib/config/site";

type BillingConfig = {
    legalEntityName: string;
    businessAddress: string;
    supportEmail: string;
    gstin: string | null;
    pan: string | null;
    websiteUrl: string;
};

export type PaymentDocumentData = {
    payment: {
        id: string;
        amount_paise: number;
        currency: string;
        status: string;
        payment_state?: string | null;
        publish_state?: string | null;
        refund_state?: string | null;
        recovery_state?: string | null;
        provider_order_id?: string | null;
        provider_payment_id?: string | null;
        provider_refund_id?: string | null;
        provider_status?: string | null;
        paid_at?: string | null;
        refunded_at?: string | null;
        refund_processed_at?: string | null;
        created_at: string;
        invoice_number?: string | null;
        invoice_issued_at?: string | null;
        invoice_version?: number | null;
        refund_receipt_number?: string | null;
        refund_receipt_issued_at?: string | null;
        refund_reason_public?: string | null;
    };
    customer: {
        name: string | null;
        email: string | null;
    };
    invitation: {
        title: string | null;
        slug: string | null;
        category: string | null;
        published_at: string | null;
    } | null;
    template: {
        name: string | null;
        category: string | null;
    } | null;
};

type DrawContext = {
    doc: PDFDocument;
    page: PDFPage;
    pages: PDFPage[];
    font: PDFFont;
    bold: PDFFont;
    italic: PDFFont;
    logo: PDFImage | null;
    y: number;
};

type DocumentTheme = {
    kind: "invoice" | "refund";
    title: string;
    eyebrow: string;
    status: string;
    documentNumber: string;
    dateLabel: string;
    dateValue: string;
    amountLabel: string;
    amount: string;
    accent: ReturnType<typeof rgb>;
    accentDark: ReturnType<typeof rgb>;
    accentSoft: ReturnType<typeof rgb>;
    footerLead: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = rgb(0.11, 0.07, 0.19);
const INK_SOFT = rgb(0.2, 0.15, 0.29);
const MUTED = rgb(0.43, 0.38, 0.52);
const MUTED_LIGHT = rgb(0.62, 0.57, 0.68);
const LINE = rgb(0.9, 0.88, 0.93);
const PAPER = rgb(1, 1, 1);
const CARD = rgb(1, 1, 1);
const WASH = rgb(0.98, 0.97, 1);
const BRAND = rgb(0.49, 0.25, 0.95);
const BRAND_DARK = rgb(0.22, 0.1, 0.44);
const SUCCESS = rgb(0.04, 0.48, 0.27);
const REFUND = rgb(0.76, 0.28, 0.09);
const REFUND_DARK = rgb(0.48, 0.16, 0.04);
const REFUND_SOFT = rgb(1, 0.98, 0.96);
const FOOTER_HEIGHT = 58;

export async function renderInvoicePdf(data: PaymentDocumentData) {
    const billing = getBillingConfig();
    const ctx = await createDocument();
    const invoiceNumber = requireText(data.payment.invoice_number, "Missing invoice number");
    const invoiceDate = data.payment.invoice_issued_at || data.payment.paid_at || data.payment.created_at;
    const paidAt = data.payment.paid_at || data.payment.created_at;
    const templateName = data.template?.name || "Vilique Premium Template";
    const invitationTitle = data.invitation?.title || "Deleted Invitation";
    const description = `Digital Invitation Publishing - ${templateName}`;
    const theme: DocumentTheme = {
        kind: "invoice",
        title: "Payment Invoice",
        eyebrow: "Premium digital invitation purchase",
        status: "Paid",
        documentNumber: invoiceNumber,
        dateLabel: "Invoice date",
        dateValue: formatDate(invoiceDate),
        amountLabel: "Total paid",
        amount: formatMoney(data.payment.amount_paise, data.payment.currency),
        accent: BRAND,
        accentDark: BRAND_DARK,
        accentSoft: WASH,
        footerLead: "This is a system-generated invoice.",
    };

    drawHero(ctx, theme);
    drawPartyCards(ctx, billing, data.customer);
    drawTwoColumnDetailCards(ctx, "Transaction", [
        ["Payment ID", data.payment.provider_payment_id || "Not available"],
        ["Order ID", data.payment.provider_order_id || "Not available"],
        ["Payment date", formatDateTime(paidAt)],
        ["Status", documentStatusLabel(data.payment.status)],
        ["Currency", data.payment.currency.toUpperCase()],
    ], "Purchase", [
        ["Template", templateName],
        ["Invitation", invitationTitle],
        ["Category", formatLabel(data.invitation?.category || data.template?.category || "digital invitation")],
        ["Published", data.invitation?.published_at ? formatDateTime(data.invitation.published_at) : "Not available"],
        ["Public URL", getAvailablePublicUrl(data)],
    ]);
    drawSummaryTable(ctx, "Invoice Summary", [
        ["Digital publishing service", description],
        ["Quantity", "1"],
        ["Subtotal", formatMoney(data.payment.amount_paise, data.payment.currency)],
        ["Tax", formatMoney(0, data.payment.currency)],
        ["Total paid", formatMoney(data.payment.amount_paise, data.payment.currency)],
    ], theme);
    drawReferenceStrip(ctx, [
        ["Internal reference", data.payment.id],
        ["Processor", "Razorpay"],
        ["Support", billing.supportEmail],
    ]);

    drawFooters(ctx, theme, [
        theme.footerLead,
        `Terms: ${siteConfig.url}/terms`,
        `Refund Policy: ${siteConfig.url}/refund-policy`,
    ]);
    return ctx.doc.save();
}

export async function renderRefundReceiptPdf(data: PaymentDocumentData) {
    const billing = getBillingConfig();
    const ctx = await createDocument();
    const refundNumber = requireText(data.payment.refund_receipt_number, "Missing refund receipt number");
    const originalInvoice = requireText(data.payment.invoice_number, "Missing original invoice number");
    const processedAt = data.payment.refund_processed_at || data.payment.refunded_at || data.payment.refund_receipt_issued_at || data.payment.created_at;
    const reason = data.payment.refund_reason_public
        || "Refund issued because the paid invitation could not be published after recovery attempts.";
    const theme: DocumentTheme = {
        kind: "refund",
        title: "Refund Receipt",
        eyebrow: "Confirmed refund document",
        status: "Refunded",
        documentNumber: refundNumber,
        dateLabel: "Refund processed",
        dateValue: formatDate(processedAt),
        amountLabel: "Refunded amount",
        amount: formatMoney(data.payment.amount_paise, data.payment.currency),
        accent: REFUND,
        accentDark: REFUND_DARK,
        accentSoft: REFUND_SOFT,
        footerLead: "This is a system-generated refund receipt.",
    };

    drawHero(ctx, theme);
    drawBusinessRefundCards(ctx, billing, originalInvoice);
    drawTwoColumnDetailCards(ctx, "Original Payment", [
        ["Invoice", originalInvoice],
        ["Transaction", data.payment.id],
        ["Payment ID", data.payment.provider_payment_id || "Not available"],
        ["Paid date", formatDateTime(data.payment.paid_at || data.payment.created_at)],
        ["Original amount", formatMoney(data.payment.amount_paise, data.payment.currency)],
    ], "Refund Details", [
        ["Refund ID", data.payment.provider_refund_id || "Not available"],
        ["Processed date", formatDateTime(processedAt)],
        ["Status", "Refunded"],
        ["Settlement", "Original payment method"],
        ["Reason", reason],
    ]);
    drawSummaryTable(ctx, "Refund Summary", [
        ["Original amount", formatMoney(data.payment.amount_paise, data.payment.currency)],
        ["Refunded amount", formatMoney(data.payment.amount_paise, data.payment.currency)],
        ["Remaining amount", formatMoney(0, data.payment.currency)],
    ], theme);
    drawReferenceStrip(ctx, [
        ["Processor", "Razorpay"],
        ["Support", billing.supportEmail],
        ["Website", billing.websiteUrl],
    ]);

    drawFooters(ctx, theme, [
        theme.footerLead,
        "Bank settlement time may vary after Razorpay confirms the refund.",
        `Refund Policy: ${siteConfig.url}/refund-policy`,
    ]);
    return ctx.doc.save();
}

function getBillingConfig(): BillingConfig {
    const legalEntityName = process.env.VILIQUE_LEGAL_ENTITY_NAME?.trim() || "Muhammed Safar";
    const businessAddress = process.env.VILIQUE_BUSINESS_ADDRESS?.trim() || "Kerala, India";
    const supportEmail =
        process.env.VILIQUE_SUPPORT_EMAIL?.trim() ||
        process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
        "support@vilique.com";

    return {
        legalEntityName,
        businessAddress,
        supportEmail,
        gstin: process.env.VILIQUE_GSTIN?.trim() || null,
        pan: process.env.VILIQUE_PAN?.trim() || null,
        websiteUrl: siteConfig.url,
    };
}

async function createDocument(): Promise<DrawContext> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
    const logo = await loadLogo(doc);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: PAPER });
    return { doc, page, pages: [page], font, bold, italic, logo, y: PAGE_HEIGHT - MARGIN };
}

async function loadLogo(doc: PDFDocument) {
    try {
        const bytes = await readFile(path.join(process.cwd(), "public", "icon-192x192.png"));
        return doc.embedPng(bytes);
    } catch {
        return null;
    }
}

function drawHero(ctx: DrawContext, theme: DocumentTheme) {
    const { page, font, bold, italic, logo } = ctx;
    const logoSize = 30;
    if (logo) {
        page.drawImage(logo, { x: MARGIN, y: PAGE_HEIGHT - 70, width: logoSize, height: logoSize });
    }
    drawText(page, italic, "Vilique", MARGIN + 38, PAGE_HEIGHT - 61, 22, BRAND);
    drawText(page, font, "Create. Invite. Celebrate.", MARGIN + 39, PAGE_HEIGHT - 77, 8.5, MUTED);

    drawRightText(page, bold, theme.title, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 58, 19, INK);
    drawRightText(page, font, theme.documentNumber, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 77, 9.5, MUTED);
    drawBadge(page, bold, theme.status, PAGE_WIDTH - MARGIN - 74, PAGE_HEIGHT - 105, theme);
    drawText(page, font, theme.dateLabel.toUpperCase(), MARGIN, PAGE_HEIGHT - 124, 7.2, MUTED_LIGHT);
    drawText(page, bold, theme.dateValue, MARGIN, PAGE_HEIGHT - 139, 9.5, INK);
    drawRightText(page, font, theme.amountLabel.toUpperCase(), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 124, 7.2, MUTED_LIGHT);
    drawRightText(page, bold, theme.amount, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 143, 17, INK);
    page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 166 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 166 }, thickness: 0.6, color: LINE });
    ctx.y = PAGE_HEIGHT - 196;
}

function drawPartyCards(ctx: DrawContext, billing: BillingConfig, customer: PaymentDocumentData["customer"]) {
    const top = ctx.y;
    const gap = 14;
    const width = (CONTENT_WIDTH - gap) / 2;
    drawInfoCard(ctx, MARGIN, top, width, 108, "Billed By", [
        billing.legalEntityName,
        billing.businessAddress,
        `Support: ${billing.supportEmail}`,
        billing.gstin ? `GSTIN: ${billing.gstin}` : null,
        billing.pan ? `PAN: ${billing.pan}` : null,
    ]);
    drawInfoCard(ctx, MARGIN + width + gap, top, width, 108, "Billed To", [
        customer.name || "Customer name not collected",
        customer.email || "Customer email not available",
        "Billing address not collected",
    ]);
    ctx.y = top - 128;
}

function drawBusinessRefundCards(ctx: DrawContext, billing: BillingConfig, originalInvoice: string) {
    const top = ctx.y;
    const gap = 14;
    const width = (CONTENT_WIDTH - gap) / 2;
    drawInfoCard(ctx, MARGIN, top, width, 108, "Issued By", [
        billing.legalEntityName,
        billing.businessAddress,
        `Support: ${billing.supportEmail}`,
        billing.websiteUrl,
    ]);
    drawInfoCard(ctx, MARGIN + width + gap, top, width, 108, "Linked Invoice", [
        originalInvoice,
        "Refund receipt for the original paid invoice.",
        billing.gstin ? `GSTIN: ${billing.gstin}` : "GSTIN: Not applicable",
    ]);
    ctx.y = top - 128;
}

function drawTwoColumnDetailCards(
    ctx: DrawContext,
    leftTitle: string,
    leftRows: Array<[string, string | null]>,
    rightTitle: string,
    rightRows: Array<[string, string | null]>
) {
    const gap = 14;
    const width = (CONTENT_WIDTH - gap) / 2;
    const leftHeight = detailCardHeight(ctx, leftRows, width);
    const rightHeight = detailCardHeight(ctx, rightRows, width);
    const height = Math.max(leftHeight, rightHeight);
    ensureSpace(ctx, height + 20);
    const top = ctx.y;
    drawDetailCard(ctx, MARGIN, top, width, height, leftTitle, leftRows);
    drawDetailCard(ctx, MARGIN + width + gap, top, width, height, rightTitle, rightRows);
    ctx.y = top - height - 20;
}

function detailCardHeight(ctx: DrawContext, rows: Array<[string, string | null]>, width: number) {
    const valueWidth = width - 28;
    const rowHeight = rows.reduce((sum, [, value]) => {
        const lines = wrapText(ctx.font, clean(value || "Not available"), valueWidth, 8.7).length;
        return sum + Math.max(23, lines * 10 + 11);
    }, 0);
    return Math.max(130, 38 + rowHeight + 12);
}

function drawInfoCard(ctx: DrawContext, x: number, top: number, width: number, height: number, title: string, lines: Array<string | null>) {
    const { page, font, bold } = ctx;
    drawCard(page, x, top - height, width, height);
    drawText(page, bold, title, x + 16, top - 24, 10.5, INK);
    let y = top - 46;
    for (const line of lines) {
        if (!line) continue;
        const used = drawWrappedText(ctx, line, x + 16, y, width - 32, 8.7, MUTED);
        y -= used * 11;
    }
    page.drawLine({ start: { x: x + 16, y: top - 34 }, end: { x: x + width - 16, y: top - 34 }, thickness: 0.5, color: LINE });
    drawText(page, font, "", x, top, 1, MUTED);
}

function drawDetailCard(ctx: DrawContext, x: number, top: number, width: number, height: number, title: string, rows: Array<[string, string | null]>) {
    const { page, font, bold } = ctx;
    drawCard(page, x, top - height, width, height);
    drawText(page, bold, title, x + 16, top - 24, 10.5, INK);
    page.drawLine({ start: { x: x + 16, y: top - 34 }, end: { x: x + width - 16, y: top - 34 }, thickness: 0.5, color: LINE });
    let y = top - 52;
    for (const [label, value] of rows) {
        const cleanValue = clean(value || "Not available");
        drawText(page, bold, label.toUpperCase(), x + 16, y, 6.8, MUTED_LIGHT);
        const used = drawWrappedText(ctx, cleanValue, x + 16, y - 12, width - 32, 8.7, INK_SOFT);
        y -= Math.max(23, used * 10 + 11);
    }
    drawText(page, font, "", x, top, 1, MUTED);
}

function drawSummaryTable(ctx: DrawContext, title: string, rows: Array<[string, string]>, theme: DocumentTheme) {
    const height = 58 + rows.length * 28;
    ensureSpace(ctx, height + 22);
    const x = MARGIN;
    const top = ctx.y;
    const width = CONTENT_WIDTH;
    const bottom = top - height;
    drawCard(ctx.page, x, bottom, width, height);
    drawText(ctx.page, ctx.bold, title, x + 16, top - 26, 12.5, INK);
    ctx.page.drawLine({ start: { x: x + 16, y: top - 40 }, end: { x: x + width - 16, y: top - 40 }, thickness: 0.5, color: LINE });

    let y = top - 66;
    rows.forEach(([label, value], index) => {
        const isTotal = index === rows.length - 1;
        drawText(ctx.page, isTotal ? ctx.bold : ctx.font, label, x + 18, y, isTotal ? 10.5 : 9, isTotal ? INK : MUTED);
        drawRightText(ctx.page, ctx.bold, value, x + width - 18, y, isTotal ? 11.5 : 9.5, isTotal ? theme.accentDark : INK);
        ctx.page.drawLine({ start: { x: x + 16, y: y - 11 }, end: { x: x + width - 16, y: y - 11 }, thickness: isTotal ? 0.7 : 0.45, color: LINE });
        y -= 28;
    });
    ctx.y = bottom - 18;
}

function drawReferenceStrip(ctx: DrawContext, items: Array<[string, string]>) {
    if (ctx.y - 60 <= FOOTER_HEIGHT + 18) return;
    const x = MARGIN;
    const top = ctx.y;
    const width = CONTENT_WIDTH;
    ctx.page.drawRectangle({ x, y: top - 50, width, height: 50, color: CARD, borderColor: LINE, borderWidth: 0.7 });
    const colWidth = width / items.length;
    items.forEach(([label, value], index) => {
        const colX = x + colWidth * index + 14;
        if (index > 0) {
            ctx.page.drawLine({ start: { x: x + colWidth * index, y: top - 42 }, end: { x: x + colWidth * index, y: top - 8 }, thickness: 0.45, color: LINE });
        }
        drawText(ctx.page, ctx.bold, label.toUpperCase(), colX, top - 19, 6.8, MUTED_LIGHT);
        drawWrappedText(ctx, value, colX, top - 33, colWidth - 24, 8.2, INK_SOFT);
    });
    ctx.y = top - 70;
}

function drawCard(page: PDFPage, x: number, y: number, width: number, height: number) {
    page.drawRectangle({ x, y, width, height, color: CARD, borderColor: LINE, borderWidth: 0.7 });
}

function drawBadge(page: PDFPage, font: PDFFont, label: string, x: number, y: number, theme: DocumentTheme) {
    const textWidth = font.widthOfTextAtSize(label, 8.5);
    page.drawRectangle({ x, y, width: textWidth + 22, height: 20, color: CARD, borderColor: theme.kind === "invoice" ? SUCCESS : REFUND, borderWidth: 0.7 });
    drawText(page, font, label, x + 11, y + 6, 8.5, theme.kind === "invoice" ? SUCCESS : REFUND);
}

function ensureSpace(ctx: DrawContext, needed: number) {
    if (ctx.y - needed > FOOTER_HEIGHT + 18) return;
    ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.pages.push(ctx.page);
    ctx.page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: PAPER });
    ctx.y = PAGE_HEIGHT - 48;
}

function drawFooters(ctx: DrawContext, theme: DocumentTheme, lines: string[]) {
    const total = ctx.pages.length;
    ctx.pages.forEach((page, index) => {
        page.drawLine({ start: { x: MARGIN, y: FOOTER_HEIGHT + 18 }, end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_HEIGHT + 18 }, thickness: 0.5, color: LINE });
        const footerLines = index === total - 1 ? lines.slice(0, 3) : [`Continued ${theme.title.toLowerCase()} generated by Vilique.`];
        footerLines.forEach((line, lineIndex) => {
            drawText(page, ctx.font, line, MARGIN, FOOTER_HEIGHT + 4 - lineIndex * 11, 7.7, MUTED);
        });
        drawRightText(page, ctx.font, `Page ${index + 1} of ${total}`, PAGE_WIDTH - MARGIN, FOOTER_HEIGHT - 18, 7.7, MUTED);
    });
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, color = INK) {
    page.drawText(clean(text), { x, y, size, font, color });
}

function drawRightText(page: PDFPage, font: PDFFont, text: string, rightX: number, y: number, size: number, color = INK) {
    const value = clean(text);
    page.drawText(value, { x: rightX - font.widthOfTextAtSize(value, size), y, size, font, color });
}

function drawWrappedText(ctx: DrawContext, text: string, x: number, y: number, width: number, size: number, color = INK) {
    const lines = wrapText(ctx.font, text, width, size);
    lines.forEach((line, index) => drawText(ctx.page, ctx.font, line, x, y - index * 10.5, size, color));
    return lines.length;
}

function wrapText(font: PDFFont, text: string, maxWidth: number, size: number) {
    const words = clean(text).split(/\s+/);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
            current = candidate;
            continue;
        }
        if (current) lines.push(current);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
            current = word;
            continue;
        }
        const chunks = chunkLongWord(font, word, maxWidth, size);
        lines.push(...chunks.slice(0, -1));
        current = chunks[chunks.length - 1] || "";
    }
    if (current) lines.push(current);
    return lines.length ? lines : ["Not available"];
}

function chunkLongWord(font: PDFFont, word: string, maxWidth: number, size: number) {
    const chunks: string[] = [];
    let current = "";
    for (const char of word) {
        const candidate = current + char;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
            current = candidate;
        } else {
            if (current) chunks.push(current);
            current = char;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

function formatMoney(paise: number, currency: string) {
    const amount = Math.max(0, Number.isFinite(paise) ? paise : 0) / 100;
    return `${currency.toUpperCase()} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-IN", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(value));
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
    }).format(new Date(value));
}

function documentStatusLabel(status: string) {
    if (status === "published") return "Paid and published";
    if (status === "refunded") return "Paid, later refunded";
    if (status === "refund_pending") return "Paid, refund pending";
    if (status === "captured" || status === "paid") return "Paid";
    return formatLabel(status);
}

function formatLabel(value: string) {
    return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getAvailablePublicUrl(data: PaymentDocumentData) {
    if (!data.invitation?.slug || data.payment.status === "refunded") return "Not available";
    if (data.payment.publish_state && data.payment.publish_state !== "published") return "Not available";
    return getPublicInvitationUrl(data.invitation.slug);
}

function clean(value: string) {
    return value
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1200);
}

function requireText(value: string | null | undefined, message: string) {
    if (!value) throw new Error(message);
    return value;
}
