import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
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
    font: PDFFont;
    bold: PDFFont;
    y: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const INK = rgb(0.12, 0.07, 0.2);
const MUTED = rgb(0.42, 0.36, 0.49);
const LINE = rgb(0.88, 0.84, 0.91);
const BRAND = rgb(0.49, 0.25, 0.95);
const SUCCESS = rgb(0.08, 0.55, 0.28);

export async function renderInvoicePdf(data: PaymentDocumentData) {
    const billing = getBillingConfig();
    const ctx = await createDocument();
    const invoiceNumber = requireText(data.payment.invoice_number, "Missing invoice number");
    const invoiceDate = data.payment.invoice_issued_at || data.payment.paid_at || data.payment.created_at;
    const paidAt = data.payment.paid_at || data.payment.created_at;
    const templateName = data.template?.name || "Vilique Premium Template";
    const invitationTitle = data.invitation?.title || "Deleted Invitation";
    const description = `Digital Invitation Publishing - ${templateName}`;

    drawHeader(ctx, {
        title: "Payment Invoice",
        documentNumber: invoiceNumber,
        dateLabel: "Invoice date",
        dateValue: formatDate(invoiceDate),
        status: "Paid",
    });

    drawPartyDetails(ctx, billing, data.customer);
    drawKeyValues(ctx, "Transaction Details", [
        ["Razorpay payment ID", data.payment.provider_payment_id || "Not available"],
        ["Razorpay order ID", data.payment.provider_order_id || "Not available"],
        ["Internal reference", data.payment.id],
        ["Payment date", formatDateTime(paidAt)],
        ["Payment method", "Processed by Razorpay"],
        ["Currency", data.payment.currency],
        ["Payment status", documentStatusLabel(data.payment.status)],
    ]);

    drawKeyValues(ctx, "Purchase Details", [
        ["Description", description],
        ["Template", templateName],
        ["Invitation", invitationTitle],
        ["Publication type", formatLabel(data.invitation?.category || data.template?.category || "digital invitation")],
        ["Public invitation URL", getAvailablePublicUrl(data)],
        ["Published date", data.invitation?.published_at ? formatDateTime(data.invitation.published_at) : "Not available"],
    ]);

    drawAmountTable(ctx, "Invoice Summary", [
        ["Description", description],
        ["Quantity", "1"],
        ["Unit price", formatMoney(data.payment.amount_paise, data.payment.currency)],
        ["Subtotal", formatMoney(data.payment.amount_paise, data.payment.currency)],
        ["Tax", formatMoney(0, data.payment.currency)],
        ["Total paid", formatMoney(data.payment.amount_paise, data.payment.currency)],
    ]);

    drawFooter(ctx, [
        "This is a system-generated invoice.",
        `Support: ${billing.supportEmail}`,
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

    drawHeader(ctx, {
        title: "Refund Receipt",
        documentNumber: refundNumber,
        dateLabel: "Refund processed",
        dateValue: formatDate(processedAt),
        status: "Refunded",
    });

    drawBusinessBlock(ctx, billing);
    drawKeyValues(ctx, "Original Payment Details", [
        ["Original invoice number", originalInvoice],
        ["Original transaction reference", data.payment.id],
        ["Razorpay payment ID", data.payment.provider_payment_id || "Not available"],
        ["Original payment date", formatDateTime(data.payment.paid_at || data.payment.created_at)],
        ["Original paid amount", formatMoney(data.payment.amount_paise, data.payment.currency)],
    ]);

    drawKeyValues(ctx, "Refund Details", [
        ["Razorpay refund ID", data.payment.provider_refund_id || "Not available"],
        ["Refund amount", formatMoney(data.payment.amount_paise, data.payment.currency)],
        ["Currency", data.payment.currency],
        ["Refund processed date", formatDateTime(processedAt)],
        ["Refund reason", reason],
        ["Refund status", "Refunded"],
        ["Original payment method", "Processed by Razorpay"],
        ["Settlement", "Refunded to original payment method"],
    ]);

    drawAmountTable(ctx, "Refund Summary", [
        ["Original amount", formatMoney(data.payment.amount_paise, data.payment.currency)],
        ["Refunded amount", formatMoney(data.payment.amount_paise, data.payment.currency)],
        ["Remaining amount", formatMoney(0, data.payment.currency)],
    ]);

    drawFooter(ctx, [
        "This is a system-generated refund receipt.",
        "Bank settlement time may vary after Razorpay confirms the refund.",
        `Support: ${billing.supportEmail}`,
        `Refund Policy: ${siteConfig.url}/refund-policy`,
    ]);

    return ctx.doc.save();
}

function getBillingConfig(): BillingConfig {
    const isProduction = process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";
    const legalEntityName = process.env.VILIQUE_LEGAL_ENTITY_NAME?.trim();
    const businessAddress = process.env.VILIQUE_BUSINESS_ADDRESS?.trim();
    const supportEmail = process.env.VILIQUE_SUPPORT_EMAIL?.trim() || process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

    if (isProduction && (!legalEntityName || !businessAddress || !supportEmail)) {
        throw new Error("Missing production billing configuration for Vilique payment documents.");
    }

    return {
        legalEntityName: legalEntityName || "Vilique",
        businessAddress: businessAddress || "Business address configured before production",
        supportEmail: supportEmail || "support@vilique.com",
        gstin: process.env.VILIQUE_GSTIN?.trim() || null,
        pan: process.env.VILIQUE_PAN?.trim() || null,
        websiteUrl: siteConfig.url,
    };
}

async function createDocument(): Promise<DrawContext> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return {
        doc,
        page,
        font: await doc.embedFont(StandardFonts.Helvetica),
        bold: await doc.embedFont(StandardFonts.HelveticaBold),
        y: PAGE_HEIGHT - MARGIN,
    };
}

function drawHeader(ctx: DrawContext, input: {
    title: string;
    documentNumber: string;
    dateLabel: string;
    dateValue: string;
    status: string;
}) {
    const { page, font, bold } = ctx;
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 148, width: PAGE_WIDTH, height: 148, color: rgb(0.97, 0.95, 1) });
    page.drawText("Vilique", { x: MARGIN, y: PAGE_HEIGHT - 72, size: 25, font: bold, color: BRAND });
    page.drawText("Create. Invite. Celebrate.", { x: MARGIN, y: PAGE_HEIGHT - 92, size: 10, font, color: MUTED });
    page.drawText(input.title, { x: 356, y: PAGE_HEIGHT - 70, size: 21, font: bold, color: INK });
    page.drawText(input.documentNumber, { x: 356, y: PAGE_HEIGHT - 91, size: 10, font: bold, color: MUTED });
    drawBadge(page, bold, input.status, 356, PAGE_HEIGHT - 123);
    drawText(page, font, input.dateLabel, 450, PAGE_HEIGHT - 120, 8, MUTED);
    drawText(page, bold, input.dateValue, 450, PAGE_HEIGHT - 133, 9, INK);
    ctx.y = PAGE_HEIGHT - 178;
}

function drawPartyDetails(ctx: DrawContext, billing: BillingConfig, customer: PaymentDocumentData["customer"]) {
    const top = ctx.y;
    drawSectionTitle(ctx, "Business Details", MARGIN, top);
    drawTextBlock(ctx, [
        billing.legalEntityName,
        billing.businessAddress,
        `Support: ${billing.supportEmail}`,
        billing.gstin ? `GSTIN: ${billing.gstin}` : null,
        billing.pan ? `PAN: ${billing.pan}` : null,
        billing.websiteUrl,
    ], MARGIN, top - 22, 230);

    drawSectionTitle(ctx, "Customer Details", 330, top);
    drawTextBlock(ctx, [
        customer.name || "Customer name not collected",
        customer.email || "Customer email not available",
        "Billing address not collected",
    ], 330, top - 22, 210);
    ctx.y = top - 106;
}

function drawBusinessBlock(ctx: DrawContext, billing: BillingConfig) {
    drawKeyValues(ctx, "Business Details", [
        ["Legal entity", billing.legalEntityName],
        ["Address", billing.businessAddress],
        ["Support email", billing.supportEmail],
        ["GSTIN", billing.gstin || "Not applicable"],
        ["Website", billing.websiteUrl],
    ]);
}

function drawKeyValues(ctx: DrawContext, title: string, rows: Array<[string, string | null]>) {
    ensureSpace(ctx, 36 + rows.length * 18);
    drawSectionTitle(ctx, title, MARGIN, ctx.y);
    ctx.y -= 24;
    for (const [label, value] of rows) {
        const rowY = ctx.y;
        drawText(ctx.page, ctx.bold, label, MARGIN, rowY, 8.5, MUTED);
        drawWrappedText(ctx, clean(value || "Not available"), 190, rowY, 338, 9.5, INK);
        ctx.y -= Math.max(18, wrappedLineCount(ctx.font, clean(value || "Not available"), 338, 9.5) * 12);
    }
    ctx.y -= 10;
}

function drawAmountTable(ctx: DrawContext, title: string, rows: Array<[string, string]>) {
    ensureSpace(ctx, 64 + rows.length * 28);
    drawSectionTitle(ctx, title, MARGIN, ctx.y);
    ctx.y -= 24;
    const x = MARGIN;
    const width = PAGE_WIDTH - MARGIN * 2;
    pageLine(ctx.page, ctx.y + 10);
    rows.forEach(([label, value], index) => {
        const y = ctx.y - index * 24;
        drawText(ctx.page, index === rows.length - 1 ? ctx.bold : ctx.font, label, x + 12, y, index === rows.length - 1 ? 11 : 9.5, index === rows.length - 1 ? INK : MUTED);
        const valueWidth = ctx.bold.widthOfTextAtSize(value, 10.5);
        drawText(ctx.page, ctx.bold, value, x + width - 12 - valueWidth, y, 10.5, INK);
        pageLine(ctx.page, y - 9);
    });
    ctx.y -= rows.length * 24 + 18;
}

function drawFooter(ctx: DrawContext, lines: string[]) {
    const footerY = 54;
    pageLine(ctx.page, footerY + 35);
    lines.slice(0, 4).forEach((line, index) => {
        drawText(ctx.page, ctx.font, line, MARGIN, footerY + 19 - index * 12, 8.5, MUTED);
    });
    drawText(ctx.page, ctx.font, "Page 1 of 1", PAGE_WIDTH - MARGIN - 45, footerY - 16, 8.5, MUTED);
}

function drawSectionTitle(ctx: DrawContext, title: string, x: number, y: number) {
    drawText(ctx.page, ctx.bold, title, x, y, 11, INK);
}

function drawTextBlock(ctx: DrawContext, lines: Array<string | null>, x: number, y: number, width: number) {
    let currentY = y;
    for (const line of lines) {
        if (!line) continue;
        const used = drawWrappedText(ctx, line, x, currentY, width, 9, MUTED);
        currentY -= used * 12;
    }
}

function drawWrappedText(ctx: DrawContext, text: string, x: number, y: number, width: number, size: number, color = INK) {
    const lines = wrapText(ctx.font, text, width, size);
    lines.forEach((line, index) => drawText(ctx.page, ctx.font, line, x, y - index * 12, size, color));
    return lines.length;
}

function drawBadge(page: PDFPage, font: PDFFont, label: string, x: number, y: number) {
    const textWidth = font.widthOfTextAtSize(label, 9);
    page.drawRectangle({ x, y, width: textWidth + 20, height: 19, borderColor: rgb(0.72, 0.9, 0.79), borderWidth: 1, color: rgb(0.91, 0.98, 0.94) });
    drawText(page, font, label, x + 10, y + 6, 9, SUCCESS);
}

function pageLine(page: PDFPage, y: number) {
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.6, color: LINE });
}

function ensureSpace(ctx: DrawContext, needed: number) {
    if (ctx.y - needed > 100) return;
    drawFooter(ctx, ["Continued document generated by Vilique."]);
    ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN;
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, color = INK) {
    page.drawText(clean(text), { x, y, size, font, color });
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
        current = word;
    }
    if (current) lines.push(current);
    return lines.length ? lines : ["Not available"];
}

function wrappedLineCount(font: PDFFont, text: string, maxWidth: number, size: number) {
    return wrapText(font, text, maxWidth, size).length;
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
