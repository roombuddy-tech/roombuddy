"""
Generate a RoomBuddy booking invoice PDF.

Usage:
    pdf_bytes = generate_booking_invoice(booking)
    # Returns bytes — ready to attach to email or stream to response.
"""
import io
import logging
from decimal import Decimal
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

logger = logging.getLogger(__name__)


def generate_booking_invoice(booking) -> bytes:
    """
    Generate a PDF invoice for a confirmed booking.
    Returns raw PDF bytes.
    booking: apps.bookings.models.Booking instance (with .listing, .guest_user, .host_user)
    """

    # ── Brand colours ────────────────────────────────────────────────────
    TEAL   = colors.HexColor("#2C4A58")
    CORAL  = colors.HexColor("#D97055")
    LIGHT  = colors.HexColor("#F4EBDC")
    GREY   = colors.HexColor("#5A727E")
    WHITE  = colors.white
    BLACK  = colors.HexColor("#1A1A1A")
    BORDER = colors.HexColor("#E0D8CC")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=f"RoomBuddy Invoice {booking.booking_code}",
        author="RoomBuddy Private Limited",
    )

    styles = getSampleStyleSheet()
    story = []

    def ps(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    # ── Helper: safe decimal display ──────────────────────────────────────
    def fmt(val):
        try:
            return f"\u20b9{float(val):,.0f}"
        except Exception:
            return "\u20b9\u2013"

    # ── Guest / host names ────────────────────────────────────────────────
    def _name(user):
        try:
            p = user.profile
            parts = [p.first_name or "", p.last_name or ""]
            full = " ".join(x for x in parts if x).strip()
            return full or user.mobile_number or "–"
        except Exception:
            return "–"

    def _email(user):
        try:
            return user.email or "–"
        except Exception:
            return "–"

    guest_name  = _name(booking.guest_user)
    guest_email = _email(booking.guest_user)
    host_name   = _name(booking.host_user)

    listing   = booking.listing
    prop_title = listing.title if listing else "–"
    location  = "–"
    try:
        prop = listing.property
        parts = [prop.area_name, prop.city, prop.state]
        location = ", ".join(x for x in parts if x) or "–"
    except Exception:
        pass

    invoice_date = booking.created_at.strftime("%d %b %Y") if booking.created_at else "–"
    checkin      = booking.check_in_date.strftime("%a, %d %b %Y") if booking.check_in_date else "–"
    checkout     = booking.check_out_date.strftime("%a, %d %b %Y") if booking.check_out_date else "–"
    nights       = booking.nights or 1

    # ── Page header bar ───────────────────────────────────────────────────
    header_data = [[
        Paragraph(
            "<font color='#FFFFFF'><b>Room<font color='#D97055'>Buddy</font></b></font>",
            ps("hdr", fontSize=20, fontName="Helvetica-Bold", textColor=WHITE, leading=24),
        ),
        Paragraph(
            "<font color='#F4EBDC'><b>TAX INVOICE</b></font>",
            ps("inv", fontSize=13, fontName="Helvetica-Bold",
               textColor=LIGHT, alignment=2),
        ),
    ]]
    header_tbl = Table(header_data, colWidths=["55%", "45%"])
    header_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 6 * mm))

    # ── Meta row: booking code / invoice date ─────────────────────────────
    meta_data = [[
        Paragraph(f"<b>Booking code:</b> {booking.booking_code}",
                  ps("m", fontSize=9, textColor=GREY)),
        Paragraph(f"<b>Invoice date:</b> {invoice_date}",
                  ps("m2", fontSize=9, textColor=GREY, alignment=2)),
    ]]
    meta_tbl = Table(meta_data, colWidths=["50%", "50%"])
    meta_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_tbl)
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=5 * mm))

    # ── Guest & property info ─────────────────────────────────────────────
    info_data = [
        [
            Paragraph("<b>BILLED TO</b>",
                      ps("lbl", fontSize=7.5, textColor=CORAL, fontName="Helvetica-Bold",
                         spaceAfter=3)),
            Paragraph("<b>PROPERTY</b>",
                      ps("lbl2", fontSize=7.5, textColor=CORAL, fontName="Helvetica-Bold",
                         spaceAfter=3)),
        ],
        [
            Paragraph(f"<b>{guest_name}</b>",
                      ps("gn", fontSize=10, fontName="Helvetica-Bold", textColor=BLACK)),
            Paragraph(f"<b>{prop_title}</b>",
                      ps("pn", fontSize=10, fontName="Helvetica-Bold", textColor=BLACK)),
        ],
        [
            Paragraph(guest_email, ps("ge", fontSize=9, textColor=GREY)),
            Paragraph(location, ps("pl", fontSize=9, textColor=GREY)),
        ],
        [
            Paragraph(f"Hosted by {host_name}", ps("hn", fontSize=9, textColor=GREY)),
            Paragraph("", ps("empty")),
        ],
    ]
    info_tbl = Table(info_data, colWidths=["50%", "50%"])
    info_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(info_tbl)
    story.append(Spacer(1, 5 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=5 * mm))

    # ── Stay dates ────────────────────────────────────────────────────────
    dates_data = [
        ["CHECK-IN", "CHECK-OUT", "NIGHTS", "GUESTS"],
        [checkin, checkout, str(nights), str(booking.number_of_guests or 1)],
    ]
    dates_tbl = Table(dates_data, colWidths=["30%", "30%", "20%", "20%"])
    dates_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), LIGHT),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 7.5),
        ("TEXTCOLOR",     (0, 0), (-1, 0), TEAL),
        ("FONTSIZE",      (0, 1), (-1, 1), 9),
        ("TEXTCOLOR",     (0, 1), (-1, 1), BLACK),
        ("FONTNAME",      (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("BOX",      (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE]),
    ]))
    story.append(dates_tbl)
    story.append(Spacer(1, 5 * mm))

    # ── Price breakdown ───────────────────────────────────────────────────
    price_rows = [
        ["DESCRIPTION", "AMOUNT"],
        [f"Room charges  (\u20b9{float(booking.host_nightly_price):,.0f} \u00d7 {nights} nights)",
         fmt(booking.subtotal)],
    ]

    if booking.meal_option_selected and booking.meal_total:
        price_rows.append([
            f"Meals  (\u20b9{float(booking.meal_cost_per_day or 0):,.0f} \u00d7 {nights} days)",
            fmt(booking.meal_total),
        ])

    price_rows.append(["GST", fmt(booking.gst_amount)])
    price_rows.append(["Platform service fee", fmt(booking.platform_fee)])

    if booking.security_deposit and float(booking.security_deposit) > 0:
        price_rows.append([
            "Security deposit  (refundable at checkout)",
            fmt(booking.security_deposit),
        ])

    # Subtotal divider
    price_rows.append(["", ""])

    price_rows.append(["TOTAL PAID", fmt(booking.total_guest_pays)])

    col_w = ["70%", "30%"]
    price_tbl = Table(price_rows, colWidths=col_w)

    n = len(price_rows)
    total_row = n - 1

    price_tbl.setStyle(TableStyle([
        # Header row
        ("BACKGROUND",    (0, 0), (-1, 0), TEAL),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 8),
        ("TOPPADDING",    (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
        ("LEFTPADDING",   (0, 0), (-1, 0), 10),
        ("RIGHTPADDING",  (0, 0), (-1, 0), 10),

        # Body rows
        ("FONTSIZE",      (0, 1), (-1, n - 2), 9),
        ("TEXTCOLOR",     (0, 1), (-1, n - 2), BLACK),
        ("TOPPADDING",    (0, 1), (-1, n - 2), 6),
        ("BOTTOMPADDING", (0, 1), (-1, n - 2), 6),
        ("LEFTPADDING",   (0, 1), (-1, n - 2), 10),
        ("RIGHTPADDING",  (0, 1), (-1, n - 2), 10),
        ("ALIGN",         (1, 1), (1, n - 2), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, n - 2), [WHITE, LIGHT]),

        # Total row
        ("BACKGROUND",    (0, total_row), (-1, total_row), CORAL),
        ("TEXTCOLOR",     (0, total_row), (-1, total_row), WHITE),
        ("FONTNAME",      (0, total_row), (-1, total_row), "Helvetica-Bold"),
        ("FONTSIZE",      (0, total_row), (-1, total_row), 11),
        ("TOPPADDING",    (0, total_row), (-1, total_row), 10),
        ("BOTTOMPADDING", (0, total_row), (-1, total_row), 10),
        ("LEFTPADDING",   (0, total_row), (-1, total_row), 10),
        ("RIGHTPADDING",  (0, total_row), (-1, total_row), 10),
        ("ALIGN",         (1, total_row), (1, total_row), "RIGHT"),

        # Outer border
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    story.append(price_tbl)
    story.append(Spacer(1, 5 * mm))

    # ── Cancellation policy note ──────────────────────────────────────────
    policy = booking.cancellation_policy or "flexible"
    policy_text = {
        "flexible": "Flexible — 100% refund if cancelled 2+ days before check-in; 50% thereafter.",
        "moderate": "Moderate — 100% refund if cancelled 7+ days before; 50% refund 2–6 days before; no refund within 2 days.",
        "strict":   "Strict — 50% refund if cancelled 7+ days before check-in; no refund thereafter.",
    }.get(policy, "")

    if policy_text:
        story.append(Paragraph(
            f"<font color='#5A727E'><b>Cancellation policy:</b> {policy_text}</font>",
            ps("cp", fontSize=8, textColor=GREY, leading=12),
        ))
        story.append(Spacer(1, 4 * mm))

    # ── Footer ────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=4 * mm))

    footer_data = [[
        Paragraph(
            "<font color='#5A727E'>RoomBuddy Private Limited &nbsp;·&nbsp; "
            "CIN: U55101UP2026PTC247772<br/>"
            "support@roombuddy.co.in &nbsp;·&nbsp; roombuddy.co.in</font>",
            ps("ft", fontSize=7.5, textColor=GREY, leading=11),
        ),
        Paragraph(
            "<font color='#5A727E'>This is a computer-generated invoice<br/>"
            "and does not require a signature.</font>",
            ps("ft2", fontSize=7.5, textColor=GREY, leading=11, alignment=2),
        ),
    ]]
    footer_tbl = Table(footer_data, colWidths=["65%", "35%"])
    footer_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(footer_tbl)

    doc.build(story)
    return buf.getvalue()
