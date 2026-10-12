# routes/invoice.py

import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session, joinedload, object_mapper

from db.database import get_db
from models.daily_input import DailyInput
from models.invoice import Invoice
from routes.user import require_roles
from schemas.invoice import GenerateInvoiceRequest, InvoiceUpdate

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"],
)
permissions = [Depends(require_roles("admin", "supervisor"))]

INVOICES_DIR = Path(__file__).resolve().parent.parent / "invoices"


def utc_now():
    return datetime.now(timezone.utc)


def ensure_invoices_dir() -> Path:
    INVOICES_DIR.mkdir(parents=True, exist_ok=True)
    return INVOICES_DIR


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^\w\s.\-]", "", name.strip())
    cleaned = re.sub(r"\s+", "_", cleaned).strip("._")
    return cleaned or "Invoice"


LINE_ITEM_HEADERS = (
    "Code",
    "Item",
    "Qty",
    "Unit",
    "Rate",
    "Amount",
    "CGST %",
    "CGST Amt",
    "SGST %",
    "SGST Amt",
    "IGST %",
    "IGST Amt",
    "Total",
)


def escape_pdf(value) -> str:
    if value is None:
        return ""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def format_date(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    return str(value)


def item_code(entry) -> str:
    if entry.type == "raw_material" and entry.raw_material is not None:
        return entry.raw_material.code or ""
    if entry.type == "element" and entry.element is not None:
        return entry.element.code or ""
    return ""


def item_unit(entry) -> str:
    unit = getattr(entry, "unit", None)
    if unit:
        return unit
    if entry.type == "raw_material" and entry.raw_material is not None:
        return entry.raw_material.unit or ""
    if entry.type == "element" and entry.element is not None:
        return entry.element.unit or ""
    return ""


def item_rate(entry):
    if entry.raw_material is not None:
        return entry.raw_material.rate
    return 0


def item_gst_percents(entry):
    if entry.raw_material is not None:
        return (
            entry.raw_material.cgst_percent,
            entry.raw_material.ut_sgst_percent,
            entry.raw_material.igst_percent,
        )
    return (0, 0, 0)


def get_daily_input_snapshot(daily_inputs):
    snapshots = []
    for entry in daily_inputs:
        mapper = object_mapper(entry)
        row_data = {
            prop.key: getattr(entry, prop.key)
            for prop in mapper.column_attrs
            if prop.key != "deleted_at"
        }
        snapshots.append(jsonable_encoder(row_data))
    return snapshots


def invoice_response(invoice):
    return {
        "id": invoice.id,
        "name": invoice.name,
        "daily_input_ids": invoice.daily_input_ids,
        "daily_input_data": invoice.daily_input_data or [],
        "invoice_path": invoice.invoice_path,
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
        "deleted_at": invoice.deleted_at,
    }


def load_daily_inputs(ids, db):
    if not ids:
        raise HTTPException(
            status_code=422,
            detail="At least one Daily Input ID is required",
        )

    if any(input_id <= 0 for input_id in ids):
        raise HTTPException(
            status_code=422,
            detail="Daily Input IDs must be positive integers",
        )

    if len(ids) != len(set(ids)):
        raise HTTPException(
            status_code=422,
            detail="Duplicate Daily Input IDs are not allowed",
        )

    entries = (
        db.query(DailyInput)
        .options(
            joinedload(DailyInput.supplier),
            joinedload(DailyInput.raw_material),
            joinedload(DailyInput.element),
        )
        .filter(
            DailyInput.id.in_(ids),
            DailyInput.deleted_at.is_(None),
        )
        .all()
    )

    entries_by_id = {entry.id: entry for entry in entries}
    missing_ids = [input_id for input_id in ids if input_id not in entries_by_id]

    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Daily Inputs not found: {missing_ids}",
        )

    return [entries_by_id[input_id] for input_id in ids]


def format_money(value) -> str:
    try:
        return f"{float(value or 0):.2f}"
    except (TypeError, ValueError):
        return "0.00"


def format_percent(value) -> str:
    try:
        return f"{float(value or 0):.2f}"
    except (TypeError, ValueError):
        return "0.00"


def format_quantity(value) -> str:
    try:
        number = float(value or 0)
        if number.is_integer():
            return str(int(number))
        return f"{number:.2f}"
    except (TypeError, ValueError):
        return "0"


def supplier_details_block(supplier, styles) -> list:
    if supplier is None:
        return [
            Paragraph("<b>Supplier</b>", styles["section"]),
            Paragraph("No supplier details available.", styles["body"]),
            Spacer(1, 8),
        ]

    address_parts = [
        part for part in (supplier.address, supplier.city, supplier.state) if part
    ]
    lines = [
        Paragraph("<b>Supplier</b>", styles["section"]),
        Paragraph(escape_pdf(supplier.company_name), styles["heading"]),
    ]
    if supplier.code:
        lines.append(Paragraph(f"Code: {escape_pdf(supplier.code)}", styles["body"]))
    if supplier.contact_person:
        lines.append(
            Paragraph(
                f"Contact person: {escape_pdf(supplier.contact_person)}",
                styles["body"],
            )
        )
    if address_parts:
        lines.append(
            Paragraph(f"Address: {escape_pdf(', '.join(address_parts))}", styles["body"])
        )
    if supplier.gst_number:
        lines.append(Paragraph(f"GST: {escape_pdf(supplier.gst_number)}", styles["body"]))
    contact_bits = []
    if supplier.phone:
        contact_bits.append(f"Phone: {escape_pdf(supplier.phone)}")
    if supplier.email:
        contact_bits.append(f"Email: {escape_pdf(supplier.email)}")
    if contact_bits:
        lines.append(Paragraph(" &nbsp;&nbsp; ".join(contact_bits), styles["body"]))
    lines.append(Spacer(1, 10))
    return lines


PAGE_CONTENT_WIDTH = 182 * mm
DOCUMENT_COL_WIDTH = PAGE_CONTENT_WIDTH / 4
LINE_ITEM_COL_WIDTHS = [
    14 * mm,  # Code
    26 * mm,  # Item
    11 * mm,  # Qty
    11 * mm,  # Unit
    12 * mm,  # Rate
    15 * mm,  # Amount
    11 * mm,  # CGST %
    15 * mm,  # CGST Amt
    11 * mm,  # SGST %
    15 * mm,  # SGST Amt
    11 * mm,  # IGST %
    15 * mm,  # IGST Amt
    15 * mm,  # Total
]


def document_details_row(entry, styles) -> Table:
    cells = [
        Paragraph(
            f"<b>DC No:</b> {escape_pdf(entry.dc_no)}",
            styles["meta"],
        ),
        Paragraph(
            f"<b>DC Date:</b> {escape_pdf(format_date(entry.dc_date))}",
            styles["meta"],
        ),
        Paragraph(
            f"<b>Bill No:</b> {escape_pdf(entry.bill_no)}",
            styles["meta"],
        ),
        Paragraph(
            f"<b>Bill Date:</b> {escape_pdf(format_date(entry.bill_date))}",
            styles["meta"],
        ),
    ]
    table = Table(
        [cells],
        colWidths=[DOCUMENT_COL_WIDTH] * 4,
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("BOX", (0, 0), (-1, -1), 0, colors.white),
                ("INNERGRID", (0, 0), (-1, -1), 0, colors.white),
            ]
        )
    )
    return table


def line_items_table(entries) -> Table:
    cell_style = ParagraphStyle(
        "InvoiceGridCell",
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#202a39"),
    )
    header_style = ParagraphStyle(
        "InvoiceGridHeader",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    money_style = ParagraphStyle(
        "InvoiceGridMoney",
        parent=cell_style,
        alignment=TA_RIGHT,
    )
    total_style = ParagraphStyle(
        "InvoiceGridTotal",
        parent=money_style,
        fontName="Helvetica-Bold",
    )
    total_label_style = ParagraphStyle(
        "InvoiceGridTotalLabel",
        parent=cell_style,
        fontName="Helvetica-Bold",
        alignment=TA_RIGHT,
    )

    def text_cell(value, style=cell_style):
        return Paragraph(escape_pdf(value), style)

    rows = [
        [text_cell(label, header_style) for label in LINE_ITEM_HEADERS]
    ]
    totals = {
        "quantity": 0.0,
        "amount": 0.0,
        "cgst_amount": 0.0,
        "ut_sgst_amount": 0.0,
        "igst_amount": 0.0,
        "total_amount": 0.0,
    }
    for entry in entries:
        quantity = float(entry.quantity or 0)
        amount = float(entry.amount or 0)
        cgst_amount = float(entry.cgst_amount or 0)
        ut_sgst_amount = float(entry.ut_sgst_amount or 0)
        igst_amount = float(entry.igst_amount or 0)
        total = float(entry.total_amount or 0)
        cgst_percent, ut_sgst_percent, igst_percent = item_gst_percents(entry)

        totals["quantity"] += quantity
        totals["amount"] += amount
        totals["cgst_amount"] += cgst_amount
        totals["ut_sgst_amount"] += ut_sgst_amount
        totals["igst_amount"] += igst_amount
        totals["total_amount"] += total

        rows.append(
            [
                text_cell(item_code(entry)),
                text_cell(entry.item or ""),
                text_cell(format_quantity(quantity), money_style),
                text_cell(item_unit(entry)),
                text_cell(format_money(item_rate(entry)), money_style),
                text_cell(format_money(amount), money_style),
                text_cell(format_percent(cgst_percent), money_style),
                text_cell(format_money(cgst_amount), money_style),
                text_cell(format_percent(ut_sgst_percent), money_style),
                text_cell(format_money(ut_sgst_amount), money_style),
                text_cell(format_percent(igst_percent), money_style),
                text_cell(format_money(igst_amount), money_style),
                text_cell(format_money(total), money_style),
            ]
        )
    rows.append(
        [
            "",
            text_cell("Grand Total", total_label_style),
            text_cell(format_quantity(totals["quantity"]), total_style),
            "",
            "",
            text_cell(format_money(totals["amount"]), total_style),
            "",
            text_cell(format_money(totals["cgst_amount"]), total_style),
            "",
            text_cell(format_money(totals["ut_sgst_amount"]), total_style),
            "",
            text_cell(format_money(totals["igst_amount"]), total_style),
            text_cell(format_money(totals["total_amount"]), total_style),
        ]
    )
    table = Table(
        rows,
        repeatRows=1,
        colWidths=LINE_ITEM_COL_WIDTHS,
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4779ca")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (2, 1), (2, -1), "RIGHT"),
                ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#c5cedb")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f2f5f9")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def grouped_daily_inputs(daily_inputs):
    groups = []
    index_by_key = {}
    for entry in daily_inputs:
        supplier_id = entry.supplier_id
        document_key = (
            supplier_id,
            entry.dc_no,
            str(entry.dc_date or ""),
            entry.bill_no,
            str(entry.bill_date or ""),
        )
        if document_key not in index_by_key:
            index_by_key[document_key] = len(groups)
            groups.append(
                {
                    "supplier": entry.supplier,
                    "document": entry,
                    "items": [],
                }
            )
        groups[index_by_key[document_key]]["items"].append(entry)
    return groups


def build_invoice_pdf(file_path: Path, invoice_name: str, daily_inputs) -> None:
    document = SimpleDocTemplate(
        str(file_path),
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "InvoiceTitle",
            parent=base["Title"],
            fontSize=16,
            spaceAfter=4,
            alignment=TA_LEFT,
        ),
        "heading": ParagraphStyle(
            "InvoiceHeading",
            parent=base["Heading2"],
            fontSize=12,
            leading=16,
            spaceAfter=2,
        ),
        "section": ParagraphStyle(
            "InvoiceSection",
            parent=base["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#5b6778"),
            spaceAfter=2,
        ),
        "body": ParagraphStyle(
            "InvoiceBody",
            parent=base["Normal"],
            fontSize=9,
            leading=13,
        ),
        "meta": ParagraphStyle(
            "InvoiceMeta",
            parent=base["Normal"],
            fontSize=9,
            leading=13,
        ),
        "muted": ParagraphStyle(
            "InvoiceMuted",
            parent=base["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#6b7787"),
            alignment=TA_RIGHT,
        ),
    }

    story = [
        Paragraph(escape_pdf(invoice_name), styles["title"]),
        Paragraph(
            f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            styles["muted"],
        ),
        Spacer(1, 8),
        HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#d5dce6")),
        Spacer(1, 10),
    ]

    groups = grouped_daily_inputs(daily_inputs)
    last_supplier_id = object()
    for index, group in enumerate(groups):
        supplier = group["supplier"]
        supplier_id = supplier.id if supplier is not None else None
        if supplier_id != last_supplier_id:
            if index > 0:
                story.append(Spacer(1, 14))
                story.append(
                    HRFlowable(
                        width="100%",
                        thickness=0.4,
                        color=colors.HexColor("#d5dce6"),
                    )
                )
                story.append(Spacer(1, 10))
            story.extend(supplier_details_block(supplier, styles))
            last_supplier_id = supplier_id

        story.append(document_details_row(group["document"], styles))
        story.append(Spacer(1, 8))
        story.append(line_items_table(group["items"]))
        story.append(Spacer(1, 10))

    document.build(story)


def resolve_unique_pdf_path(invoice_name: str) -> tuple[Path, str]:
    ensure_invoices_dir()
    base_name = sanitize_filename(invoice_name)
    if base_name.lower().endswith(".pdf"):
        base_name = base_name[:-4]

    candidate = INVOICES_DIR / f"{base_name}.pdf"
    counter = 1
    while candidate.exists():
        candidate = INVOICES_DIR / f"{base_name}_{counter}.pdf"
        counter += 1

    relative_path = f"invoices/{candidate.name}"
    return candidate, relative_path


@router.post("/generate-invoice", status_code=201, dependencies=permissions)
def generate_invoice(
    payload: GenerateInvoiceRequest,
    db: Session = Depends(get_db),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Invoice name is required")

    daily_inputs = load_daily_inputs(payload.daily_input_ids, db)
    now = utc_now()
    pdf_path, relative_path = resolve_unique_pdf_path(name)

    try:
        build_invoice_pdf(pdf_path, name, daily_inputs)
    except Exception as exc:
        if pdf_path.exists():
            pdf_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate invoice PDF: {exc}",
        ) from exc

    invoice = Invoice(
        name=name,
        daily_input_ids=payload.daily_input_ids,
        daily_input_data=get_daily_input_snapshot(daily_inputs),
        invoice_path=relative_path,
        created_at=now,
        updated_at=now,
    )

    db.add(invoice)
    try:
        db.commit()
    except Exception:
        db.rollback()
        if pdf_path.exists():
            pdf_path.unlink(missing_ok=True)
        raise

    db.refresh(invoice)
    return invoice_response(invoice)


@router.get("/get-invoice", dependencies=permissions)
def get_all_invoices(db: Session = Depends(get_db)):
    invoices = (
        db.query(Invoice)
        .filter(Invoice.deleted_at.is_(None))
        .order_by(Invoice.id.desc())
        .all()
    )
    return [invoice_response(invoice) for invoice in invoices]


@router.get("/get-invoice/{invoice_id}", dependencies=permissions)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.deleted_at.is_(None),
        )
        .first()
    )
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice_response(invoice)


@router.get("/{invoice_id}/pdf", dependencies=permissions)
def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.deleted_at.is_(None),
        )
        .first()
    )
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not invoice.invoice_path:
        raise HTTPException(status_code=404, detail="Invoice PDF not found")

    file_path = Path(__file__).resolve().parent.parent / invoice.invoice_path
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Invoice PDF file is missing")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=file_path.name,
    )


@router.patch("/{invoice_id}", dependencies=permissions)
def edit_invoice(
    invoice_id: int,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
):
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.deleted_at.is_(None),
        )
        .first()
    )
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=422,
            detail="Provide name or daily_input_ids to update",
        )

    if "name" in changes:
        if changes["name"] is None:
            raise HTTPException(status_code=422, detail="Invoice name cannot be null")
        name = changes["name"].strip()
        if not name:
            raise HTTPException(status_code=422, detail="Invoice name cannot be empty")
        invoice.name = name

    if "daily_input_ids" in changes:
        ids = changes["daily_input_ids"]
        if ids is None:
            raise HTTPException(
                status_code=422,
                detail="daily_input_ids cannot be null",
            )
        daily_inputs = load_daily_inputs(ids, db)
        invoice.daily_input_ids = ids
        invoice.daily_input_data = get_daily_input_snapshot(daily_inputs)

    invoice.updated_at = utc_now()
    db.commit()
    db.refresh(invoice)
    return invoice_response(invoice)


@router.delete("/{invoice_id}", dependencies=permissions)
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.deleted_at.is_(None),
        )
        .first()
    )
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    now = utc_now()
    invoice.deleted_at = now
    invoice.updated_at = now
    db.commit()
    db.refresh(invoice)

    return {
        "message": "Invoice deleted successfully",
        "id": invoice.id,
        "deleted_at": invoice.deleted_at,
    }
