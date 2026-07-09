"""
Generate a RoomBuddy booking invoice PDF.

Usage:
    pdf_bytes = generate_booking_invoice(booking)
    # Returns bytes — ready to attach to email or stream to response.
"""
import io
import logging
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

logger = logging.getLogger(__name__)


def generate_booking_invoice(booking) -> bytes:
    DARK = colors.HexColor("#1a1a1a")
    MID = colors.HexColor("#4a4a4a")
    LIGHT_TEXT = colors.HexColor("#6b7280")
    ACCENT = colors.HexColor("#2563EB")
    WHITE = colors.white
    BG_LIGHT = colors.HexColor("#F9FAFB")
    BORDER_LIGHT = colors.HexColor("#E5E7EB")
    BORDER_MED = colors.HexColor("#D1D5DB")
    SUCCESS = colors.HexColor("#059669")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title=f"RoomBuddy Invoice {booking.booking_code}",
        author="RoomBuddy Private Limited",
    )

    styles = getSampleStyleSheet()
    story = []

    def ps(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    RS = "Rs."

    def fmt(val):
        try:
            return f"{RS} {float(val):,.2f}"
        except Exception:
            return f"{RS} --"

    def fmt_int(val):
        try:
            return f"{RS} {float(val):,.0f}"
        except Exception:
            return f"{RS} --"

    # ── Data extraction ──────────────────────────────────────────────────
    def _name(user):
        try:
            p = user.profile
            parts = [p.first_name or "", p.last_name or ""]
            full = " ".join(x for x in parts if x).strip()
            return full or user.mobile_number or "-"
        except Exception:
            return "-"

    guest_name = booking.guest_name or "-"
    guest_email = booking.guest_email or "-"
    guest_phone = booking.guest_phone or getattr(booking.guest_user, "mobile_number", "") or "-"
    host_name = _name(booking.host_user)

    listing = booking.listing
    prop_title = listing.title if listing else "-"
    prop = getattr(listing, "property", None)

    location_parts = []
    if prop:
        apt = getattr(prop, "apartment_name", None)
        if apt and apt.strip():
            location_parts.append(apt.strip())
        floor = getattr(prop, "floor_number", None)
        if floor is not None:
            location_parts.append("Ground floor" if floor == 0 else f"Floor {floor}")
        for part in [
            getattr(prop, "address_line1", None),
            getattr(prop, "address_line2", None),
        ]:
            if part and part.strip():
                location_parts.append(part.strip())
        city = getattr(prop, "city_name", None)
        state = getattr(prop, "state", None)
        pincode = getattr(prop, "pincode", None)
        city_state = ", ".join(x for x in [city, state] if x and x.strip())
        if city_state:
            if pincode:
                city_state += f" - {pincode}"
            location_parts.append(city_state)
    location = ", ".join(location_parts) if location_parts else "-"

    invoice_date = booking.created_at.strftime("%d %b %Y") if booking.created_at else "-"
    checkin = booking.check_in_date.strftime("%a, %d %b %Y") if booking.check_in_date else "-"
    checkout = booking.check_out_date.strftime("%a, %d %b %Y") if booking.check_out_date else "-"
    nights = booking.nights or 1
    num_guests = booking.number_of_guests or 1

    # ── Header ────────────────────────────────────────────────────────────
    header_data = [[
        Paragraph(
            "<b>RoomBuddy</b>",
            ps("logo", fontSize=22, fontName="Helvetica-Bold", textColor=ACCENT, leading=28),
        ),
        Paragraph(
            "<b>INVOICE</b>",
            ps("inv_label", fontSize=18, fontName="Helvetica-Bold",
               textColor=DARK, alignment=2, leading=28),
        ),
    ]]
    header_tbl = Table(header_data, colWidths=["50%", "50%"])
    header_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 2 * mm))

    # ── Invoice meta ──────────────────────────────────────────────────────
    meta_data = [[
        Paragraph(
            f"<font color='#6b7280'>Invoice No:</font> <b>{booking.booking_code}</b>",
            ps("m1", fontSize=9, textColor=MID),
        ),
        Paragraph(
            f"<font color='#6b7280'>Date:</font> <b>{invoice_date}</b>",
            ps("m2", fontSize=9, textColor=MID, alignment=2),
        ),
    ]]
    meta_tbl = Table(meta_data, colWidths=["50%", "50%"])
    meta_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_LIGHT, spaceAfter=4 * mm))

    # ── Billed To / Property ──────────────────────────────────────────────
    lbl_style = ps("lbl", fontSize=8, textColor=LIGHT_TEXT, fontName="Helvetica-Bold", spaceAfter=4)
    val_style = ps("val", fontSize=10, textColor=DARK, fontName="Helvetica-Bold", leading=14)
    sub_style = ps("sub", fontSize=9, textColor=MID, leading=13)

    info_data = [
        [
            Paragraph("BILLED TO", lbl_style),
            Paragraph("PROPERTY", lbl_style),
        ],
        [
            Paragraph(f"<b>{guest_name}</b>", val_style),
            Paragraph(f"<b>{prop_title}</b>", val_style),
        ],
        [
            Paragraph(guest_email, sub_style),
            Paragraph(location, sub_style),
        ],
        [
            Paragraph(guest_phone, sub_style),
            Paragraph(f"Hosted by {host_name}", sub_style),
        ],
    ]
    info_tbl = Table(info_data, colWidths=["50%", "50%"])
    info_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(info_tbl)
    story.append(Spacer(1, 5 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_LIGHT, spaceAfter=5 * mm))

    # ── Stay details ──────────────────────────────────────────────────────
    stay_header = ["CHECK-IN", "CHECK-OUT", "NIGHTS", "GUESTS"]
    stay_values = [checkin, checkout, str(nights), str(num_guests)]
    stay_data = [stay_header, stay_values]
    stay_tbl = Table(stay_data, colWidths=["30%", "30%", "20%", "20%"])
    stay_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BG_LIGHT),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), LIGHT_TEXT),
        ("FONTSIZE", (0, 1), (-1, 1), 9),
        ("TEXTCOLOR", (0, 1), (-1, 1), DARK),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_MED),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER_MED),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(stay_tbl)
    story.append(Spacer(1, 6 * mm))

    # ── Price breakdown ───────────────────────────────────────────────────
    price_header = ["Description", "Amount"]
    price_rows = [price_header]

    per_night = float(booking.host_nightly_price)
    price_rows.append([
        f"Room charges ({fmt_int(per_night)} x {nights} night{'s' if nights > 1 else ''}) - pay host directly",
        fmt(booking.subtotal),
    ])

    if booking.meal_option_selected and booking.meal_total:
        meal_per_day = float(booking.meal_cost_per_day or 0)
        price_rows.append([
            f"Meals ({fmt_int(meal_per_day)} x {nights} day{'s' if nights > 1 else ''}) - pay host directly",
            fmt(booking.meal_total),
        ])

    if booking.security_deposit and float(booking.security_deposit) > 0:
        price_rows.append([
            "Security deposit (refundable) - pay host directly",
            fmt(booking.security_deposit),
        ])

    pay_to_host = (
        booking.subtotal
        + (booking.meal_total or 0)
        + (booking.security_deposit or 0)
    )
    price_rows.append(["Payable to host directly", fmt(pay_to_host)])
    price_rows.append(["RoomBuddy platform fee (paid online)", fmt(booking.platform_fee)])

    n = len(price_rows)

    price_tbl = Table(price_rows, colWidths=["70%", "30%"])
    price_tbl.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), BG_LIGHT),
        ("TEXTCOLOR", (0, 0), (-1, 0), LIGHT_TEXT),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        # Body
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 1), (0, -1), MID),
        ("TEXTCOLOR", (1, 1), (1, -1), DARK),
        ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 1), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 7),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        # Borders
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_MED),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER_MED),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, BORDER_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(price_tbl)
    story.append(Spacer(1, 1 * mm))

    # ── Total row ─────────────────────────────────────────────────────────
    total_data = [["Paid online (RoomBuddy fee)", fmt(booking.total_guest_pays)]]
    total_tbl = Table(total_data, colWidths=["70%", "30%"])
    total_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
        ("LEFTPADDING", (0, 0), (-1, 0), 10),
        ("RIGHTPADDING", (0, 0), (-1, 0), 10),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
    ]))
    story.append(total_tbl)
    story.append(Spacer(1, 6 * mm))

    # ── Cancellation policy ───────────────────────────────────────────────
    policy = booking.cancellation_policy or "flexible"
    policy_text = {
        "flexible": "100% refund if cancelled 2+ days before check-in; 50% thereafter.",
        "moderate": "100% refund if cancelled 7+ days before; 50% refund 2-6 days before; no refund within 2 days.",
        "strict": "50% refund if cancelled 7+ days before check-in; no refund thereafter.",
    }.get(policy, "")

    if policy_text:
        fee_txt = fmt(booking.platform_fee)
        policy_data = [[
            Paragraph(
                f"<b>Cancellation policy ({policy.title()}):</b> The {fee_txt} RoomBuddy "
                f"fee is non-refundable. Rent and deposit are paid to the host directly, so "
                f"any refund of those follows the host's policy: {policy_text}",
                ps("cp", fontSize=8, textColor=LIGHT_TEXT, leading=12),
            ),
        ]]
        policy_tbl = Table(policy_data, colWidths=["100%"])
        policy_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(policy_tbl)
        story.append(Spacer(1, 6 * mm))

    # ── Footer ────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_LIGHT, spaceAfter=4 * mm))

    footer_data = [[
        Paragraph(
            "<b>RoomBuddy Private Limited</b><br/>"
            "CIN: U55101UP2026PTC247772<br/>"
            "support@roombuddy.co.in",
            ps("ft", fontSize=7.5, textColor=LIGHT_TEXT, leading=11),
        ),
        Paragraph(
            "This is a computer-generated invoice<br/>"
            "and does not require a signature.",
            ps("ft2", fontSize=7.5, textColor=LIGHT_TEXT, leading=11, alignment=2),
        ),
    ]]
    footer_tbl = Table(footer_data, colWidths=["60%", "40%"])
    footer_tbl.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(footer_tbl)

    doc.build(story)
    return buf.getvalue()
