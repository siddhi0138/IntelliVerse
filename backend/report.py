"""Additive: export a completed analysis as Excel, PDF, or PowerPoint.

All three builders read from the same `result` dict returned by
POST /api/analyze (plus the original DataFrame for the Excel raw-data
sheet) — no re-computation, just formatting what's already been derived.
"""
from __future__ import annotations

import io
from typing import Any

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter
from pptx import Presentation
from pptx.util import Inches, Pt
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

MAX_EXCEL_DATA_ROWS = 5000


def build_excel_report(result: dict[str, Any], df: pd.DataFrame) -> bytes:
    wb = Workbook()

    summary = wb.active
    summary.title = "Summary"
    summary.append(["Filename", result.get("filename")])
    summary.append(["Domain", result.get("domain")])
    summary.append(["Rows", result.get("row_count")])
    summary.append(["Columns", result.get("column_count")])
    quality = result.get("quality") or {}
    summary.append(["Data quality score", quality.get("score")])
    for row in summary.iter_rows(min_row=1, max_row=summary.max_row, min_col=1, max_col=1):
        row[0].font = Font(bold=True)
    summary.column_dimensions["A"].width = 22
    summary.column_dimensions["B"].width = 40

    schema_ws = wb.create_sheet("Schema")
    schema_ws.append(["Column", "Type", "Semantic label", "Confidence"])
    for cell in schema_ws[1]:
        cell.font = Font(bold=True)
    for col in result.get("schema", []):
        schema_ws.append([col.get("name"), col.get("type"), col.get("semantic_label"), col.get("confidence")])

    findings_ws = wb.create_sheet("Findings")
    findings_ws.append(["Rank", "Title", "Summary", "Impact"])
    for cell in findings_ws[1]:
        cell.font = Font(bold=True)
    for i, f in enumerate(result.get("ranked_findings", []), start=1):
        findings_ws.append([i, f.get("title"), f.get("summary"), f.get("impact_score")])

    anomalies_ws = wb.create_sheet("Anomalies")
    anomalies_ws.append(["Column", "Row ID", "Value", "Direction"])
    for cell in anomalies_ws[1]:
        cell.font = Font(bold=True)
    for a in result.get("anomalies", []):
        anomalies_ws.append([a.get("column"), a.get("row_id"), a.get("value"), a.get("direction")])

    data_ws = wb.create_sheet("Raw Data")
    truncated_df = df.head(MAX_EXCEL_DATA_ROWS)
    data_ws.append(list(truncated_df.columns))
    for cell in data_ws[1]:
        cell.font = Font(bold=True)
    for row in truncated_df.itertuples(index=False):
        data_ws.append([None if pd.isna(v) else v for v in row])
    for i, col in enumerate(truncated_df.columns, start=1):
        data_ws.column_dimensions[get_column_letter(i)].width = 16

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def build_pdf_report(result: dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    story: list[Any] = []

    story.append(Paragraph("IntelliVerse Analysis Report", styles["Title"]))
    story.append(Paragraph(result.get("filename", "Untitled dataset"), styles["Heading2"]))
    story.append(Spacer(1, 12))

    quality = result.get("quality") or {}
    meta_rows = [
        ["Domain", result.get("domain", "unknown")],
        ["Rows", str(result.get("row_count", ""))],
        ["Columns", str(result.get("column_count", ""))],
        ["Data quality score", str(quality.get("score", "n/a"))],
    ]
    meta_table = Table(meta_rows, colWidths=[150, 300])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 18))

    story.append(Paragraph("Key findings", styles["Heading2"]))
    findings = result.get("ranked_findings", [])
    if findings:
        for f in findings[:10]:
            story.append(Paragraph(f"<b>{f.get('title', '')}</b> — {f.get('summary', '')}", styles["BodyText"]))
    else:
        story.append(Paragraph("No ranked findings for this dataset.", styles["BodyText"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Risk alerts", styles["Heading2"]))
    alerts = result.get("risk_alerts", [])
    if alerts:
        for a in alerts:
            story.append(Paragraph(f"<b>{a.get('severity', '')}</b>: {a.get('message', '')}", styles["BodyText"]))
    else:
        story.append(Paragraph("No risk alerts triggered.", styles["BodyText"]))
    story.append(Spacer(1, 12))

    forecast = result.get("forecast")
    story.append(Paragraph("Forecast", styles["Heading2"]))
    if forecast:
        story.append(Paragraph(
            f"Model: {forecast.get('model', 'n/a')} — column: {forecast.get('column', 'n/a')}",
            styles["BodyText"],
        ))
    else:
        story.append(Paragraph("No eligible forecast for this dataset.", styles["BodyText"]))

    doc.build(story)
    return buf.getvalue()


def build_pptx_report(result: dict[str, Any]) -> bytes:
    prs = Presentation()
    prs.slide_width = Inches(13.33)
    prs.slide_height = Inches(7.5)

    title_layout = prs.slide_layouts[0]
    bullet_layout = prs.slide_layouts[1]

    title_slide = prs.slides.add_slide(title_layout)
    title_slide.shapes.title.text = "IntelliVerse Analysis Report"
    title_slide.placeholders[1].text = result.get("filename", "Untitled dataset")

    kpi_slide = prs.slides.add_slide(bullet_layout)
    kpi_slide.shapes.title.text = "Dataset overview"
    quality = result.get("quality") or {}
    body = kpi_slide.placeholders[1].text_frame
    body.text = f"Domain: {result.get('domain', 'unknown')}"
    for line in [
        f"Rows: {result.get('row_count', '')}",
        f"Columns: {result.get('column_count', '')}",
        f"Data quality score: {quality.get('score', 'n/a')}",
    ]:
        p = body.add_paragraph()
        p.text = line
        p.font.size = Pt(20)

    findings_slide = prs.slides.add_slide(bullet_layout)
    findings_slide.shapes.title.text = "Key findings"
    findings = result.get("ranked_findings", [])[:6]
    fbody = findings_slide.placeholders[1].text_frame
    if findings:
        fbody.text = findings[0].get("title", "")
        for f in findings[1:]:
            p = fbody.add_paragraph()
            p.text = f.get("title", "")
            p.font.size = Pt(18)
    else:
        fbody.text = "No ranked findings for this dataset."

    alerts_slide = prs.slides.add_slide(bullet_layout)
    alerts_slide.shapes.title.text = "Risk alerts"
    alerts = result.get("risk_alerts", [])
    abody = alerts_slide.placeholders[1].text_frame
    if alerts:
        abody.text = alerts[0].get("message", "")
        for a in alerts[1:]:
            p = abody.add_paragraph()
            p.text = a.get("message", "")
            p.font.size = Pt(18)
    else:
        abody.text = "No risk alerts triggered."

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()
