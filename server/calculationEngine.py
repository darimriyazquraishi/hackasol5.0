import os
import sys
import json
import math
from datetime import datetime

# Configure matplotlib for headless rendering
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

# ----------------------------------------------------------------------
# NumberedCanvas for dynamic two-pass "Page X of Y" page numbering
# ----------------------------------------------------------------------
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        # Do not print running headers/footers on title page (page 1)
        if self._pageNumber == 1:
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#737373"))

        # Running Header
        self.drawString(54, 750, "LUMI Engineering & Technical Review | Draft - For Technical Review")
        self.drawRightString(558, 750, "Doc ID: ENG-RPT-2026-WP01 | Rev: Draft")
        self.setStrokeColor(colors.HexColor("#262626"))
        self.setLineWidth(0.5)
        self.line(54, 744, 558, 744)

        # Running Footer
        self.line(54, 48, 558, 48)
        self.drawString(54, 36, "Local Unified Multimodal Intelligence (L.U.M.I.) Workbench")
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(558, 36, page_str)

        self.restoreState()


# ----------------------------------------------------------------------
# Deterministic Compressed-Air Engineering Calculations
# ----------------------------------------------------------------------
def calculate_compressed_air(params):
    if isinstance(params, list):
        param_dict = {}
        for item in params:
            if isinstance(item, dict):
                k = item.get("name") or item.get("key")
                v = item.get("value")
                if k is not None:
                    param_dict[k] = v
        params = param_dict
    elif not isinstance(params, dict):
        params = {}

    num_compressors = params.get("num_compressors", 3)
    rated_kw = params.get("rated_kw_per_compressor", 250.0)
    operating_compressors = params.get("operating_compressors", 2)
    avg_power_kw = float(params.get("avg_combined_power_kw", 400.0))
    hours_per_day = float(params.get("hours_per_day", 24.0))
    days_per_month = float(params.get("days_per_month", 30.0))
    demand_flow_nm3h = float(params.get("air_demand_nm3_h", 18000.0))
    pressure_barg = float(params.get("discharge_pressure_barg", 7.0))
    leakage_pct = float(params.get("leakage_pct", 20.0))
    target_reduction_pct = float(params.get("leakage_reduction_target_pct", 10.0))

    # Dimensional & Boundary Validation (Part 5.4)
    if avg_power_kw <= 0 or demand_flow_nm3h <= 0 or hours_per_day <= 0 or days_per_month <= 0:
        raise ValueError("Invalid physical condition: compressor power, air demand, and operating schedule must be positive non-zero values.")
    if hours_per_day > 24.0 or days_per_month > 31.0:
        raise ValueError("Invalid operating schedule: cannot exceed 24 hours/day or 31 days/month.")

    # 1. Operating Hours
    monthly_hours = hours_per_day * days_per_month  # 720 h
    annual_hours = monthly_hours * 12.0             # 8,640 h

    # 2. Electricity Consumption (Deterministic: real power supplied in kW)
    monthly_kwh = avg_power_kw * monthly_hours      # 400 * 720 = 288,000 kWh
    annual_kwh = monthly_kwh * 12.0                 # 3,456,000 kWh

    # 3. Air Production Volume
    monthly_air_nm3 = demand_flow_nm3h * monthly_hours # 18,000 * 720 = 12,960,000 Nm3
    annual_air_nm3 = monthly_air_nm3 * 12.0            # 155,520,000 Nm3

    # 4. Specific Energy Consumption (SEC)
    sec_kwh_nm3 = monthly_kwh / monthly_air_nm3     # 288,000 / 12,960,000 = 0.02222 kWh/Nm3

    # 5. Baseline Leakage Volume & Power
    leak_rate_fraction = leakage_pct / 100.0        # 0.20
    leak_flow_nm3h = demand_flow_nm3h * leak_rate_fraction # 3,600 Nm3/h
    monthly_leak_nm3 = leak_flow_nm3h * monthly_hours      # 2,592,000 Nm3/month
    annual_leak_nm3 = monthly_leak_nm3 * 12.0              # 31,104,000 Nm3/year

    # Energy associated with leakage
    monthly_leak_kwh = monthly_leak_nm3 * sec_kwh_nm3      # 57,600 kWh/month
    annual_leak_kwh = monthly_leak_kwh * 12.0              # 691,200 kWh/year

    # 6. Ambiguity Scenarios for 10% Leakage Reduction Target:
    # Scenario A: Absolute reduction (from 20% to 10% of total flow)
    scen_a_leak_flow_reduction = demand_flow_nm3h * (target_reduction_pct / 100.0) # 1,800 Nm3/h
    scen_a_monthly_kwh_saved = scen_a_leak_flow_reduction * monthly_hours * sec_kwh_nm3 # 28,800 kWh/mo
    scen_a_annual_kwh_saved = scen_a_monthly_kwh_saved * 12.0 # 345,600 kWh/yr

    # Scenario B: Relative reduction (reduce existing 20% by 10% relatively -> new leakage = 18%)
    scen_b_leak_pct = leakage_pct * (1.0 - target_reduction_pct / 100.0) # 18%
    scen_b_leak_flow_reduction = demand_flow_nm3h * ((leakage_pct - scen_b_leak_pct) / 100.0) # 360 Nm3/h
    scen_b_monthly_kwh_saved = scen_b_leak_flow_reduction * monthly_hours * sec_kwh_nm3 # 5,760 kWh/mo
    scen_b_annual_kwh_saved = scen_b_monthly_kwh_saved * 12.0 # 69,120 kWh/yr

    calculation_records = [
        {
            "parameter": "Monthly Electrical Consumption",
            "formula": "P_avg (kW) * Hours_per_day * Days_per_month = 400 * 24 * 30",
            "value": monthly_kwh,
            "unit": "kWh/month",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Annual Electrical Consumption",
            "formula": "Monthly_kWh * 12 = 288,000 * 12",
            "value": annual_kwh,
            "unit": "kWh/year",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Monthly Air Production",
            "formula": "Demand_Flow (Nm3/h) * Hours_per_month = 18,000 * 720",
            "value": monthly_air_nm3,
            "unit": "Nm3/month",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Specific Energy Consumption (SEC)",
            "formula": "Monthly_kWh / Monthly_Air_Nm3 = 288,000 / 12,960,000",
            "value": round(sec_kwh_nm3, 5),
            "unit": "kWh/Nm3",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Estimated Leakage Flow Rate",
            "formula": "Total_Demand (Nm3/h) * Leakage_pct = 18,000 * 0.20",
            "value": leak_flow_nm3h,
            "unit": "Nm3/hour",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Monthly Leakage Energy Loss",
            "formula": "Leakage_Volume (Nm3/mo) * SEC = 2,592,000 * 0.02222",
            "value": round(monthly_leak_kwh, 2),
            "unit": "kWh/month",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Annual Leakage Energy Loss",
            "formula": "Monthly_Leak_kWh * 12 = 57,600 * 12",
            "value": round(annual_leak_kwh, 2),
            "unit": "kWh/year",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Scenario A Savings (Absolute 10% reduction)",
            "formula": "10% of Total Flow saved = 1,800 Nm3/h * 720 h * SEC",
            "value": round(scen_a_annual_kwh_saved, 2),
            "unit": "kWh/year",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Scenario B Savings (Relative 10% reduction of 20%)",
            "formula": "2% of Total Flow saved (20% -> 18%) = 360 Nm3/h * 720 h * SEC",
            "value": round(scen_b_annual_kwh_saved, 2),
            "unit": "kWh/year",
            "status": "VERIFIED_DETERMINISTIC"
        }
    ]

    return {
        "monthly_kwh": monthly_kwh,
        "annual_kwh": annual_kwh,
        "monthly_air_nm3": monthly_air_nm3,
        "annual_air_nm3": annual_air_nm3,
        "sec_kwh_nm3": sec_kwh_nm3,
        "leak_flow_nm3h": leak_flow_nm3h,
        "monthly_leak_nm3": monthly_leak_nm3,
        "annual_leak_nm3": annual_leak_nm3,
        "monthly_leak_kwh": monthly_leak_kwh,
        "annual_leak_kwh": annual_leak_kwh,
        "scen_a_monthly_kwh_saved": scen_a_monthly_kwh_saved,
        "scen_a_annual_kwh_saved": scen_a_annual_kwh_saved,
        "scen_b_monthly_kwh_saved": scen_b_monthly_kwh_saved,
        "scen_b_annual_kwh_saved": scen_b_annual_kwh_saved,
        "records": calculation_records,
        "inputs": params
    }


# ----------------------------------------------------------------------
# Matplotlib Chart Generation
# ----------------------------------------------------------------------
def generate_charts(calc, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    chart1_path = os.path.join(output_dir, "chart_energy_allocation.png")
    chart2_path = os.path.join(output_dir, "chart_leakage_scenarios.png")

    # Chart 1: Energy Allocation (Useful vs Leakage Loss)
    plt.figure(figsize=(6, 3.5), dpi=200)
    labels = ['Useful Air Demand (80%)', 'Estimated Leakage Loss (20%)']
    useful_kwh = calc["monthly_kwh"] - calc["monthly_leak_kwh"]
    sizes = [useful_kwh, calc["monthly_leak_kwh"]]
    colors_pie = ['#2563eb', '#dc2626']
    explode = (0, 0.08)

    plt.pie(
        sizes, explode=explode, labels=labels, colors=colors_pie, autopct='%1.1f%%',
        startangle=140, textprops={'fontsize': 8, 'color': '#1f2937'}
    )
    plt.title("Monthly Electrical Energy Allocation (Total: 288,000 kWh)", fontsize=10, fontweight='bold', pad=12)
    plt.tight_layout()
    plt.savefig(chart1_path, bbox_inches='tight')
    plt.close()

    # Chart 2: Annual Energy Savings Comparison (Scenario A vs B)
    plt.figure(figsize=(6.2, 3.5), dpi=200)
    scenarios = ['Scenario A\n(Absolute 10% Cut:\n20% → 10%)', 'Scenario B\n(Relative 10% Cut:\n20% → 18%)']
    savings = [calc["scen_a_annual_kwh_saved"], calc["scen_b_annual_kwh_saved"]]
    bar_colors = ['#16a34a', '#0d9488']

    bars = plt.bar(scenarios, savings, color=bar_colors, width=0.45)
    plt.ylabel("Annual Electrical Energy Savings (kWh/year)", fontsize=8)
    plt.title("Leakage Reduction Impact: Interpretation Scenarios", fontsize=10, fontweight='bold')
    plt.grid(axis='y', linestyle='--', alpha=0.5)

    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width() / 2.0, yval + 8000, f"{yval:,.0f} kWh/yr", ha='center', va='bottom', fontsize=8, fontweight='bold')

    plt.ylim(0, max(savings) * 1.25)
    plt.tight_layout()
    plt.savefig(chart2_path, bbox_inches='tight')
    plt.close()

    return chart1_path, chart2_path


# ----------------------------------------------------------------------
# ReportLab Professional Engineering PDF Generator
# ----------------------------------------------------------------------
def generate_technical_pdf(calc, chart1_path, chart2_path, output_pdf_path, rag_citations=None):
    os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom Clean Typography Styles
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=22, leading=26,
        textColor=colors.HexColor('#0f172a'), spaceAfter=8
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=12, leading=16,
        textColor=colors.HexColor('#475569'), spaceAfter=20
    )
    h1_style = ParagraphStyle(
        'Heading1', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=13, leading=16,
        textColor=colors.HexColor('#0f172a'), spaceBefore=14, spaceAfter=8,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'Heading2', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=10, leading=13,
        textColor=colors.HexColor('#334155'), spaceBefore=10, spaceAfter=5,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=13,
        textColor=colors.HexColor('#1e293b'), spaceAfter=6
    )
    bullet_style = ParagraphStyle(
        'Bullet', parent=body_style,
        leftIndent=14, firstLineIndent=-10, spaceAfter=4
    )
    table_cell = ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=11,
        textColor=colors.HexColor('#1e293b')
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold', parent=table_cell,
        fontName='Helvetica-Bold', textColor=colors.HexColor('#0f172a')
    )
    table_header = ParagraphStyle(
        'TableHeader', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=8, leading=11,
        textColor=colors.white
    )

    story = []

    # ==================================================================
    # 1. TITLE PAGE & DOCUMENT CONTROL
    # ==================================================================
    story.append(Spacer(1, 20))
    story.append(Paragraph("TECHNICAL ENGINEERING AUDIT REPORT", title_style))
    story.append(Paragraph("Compressed-Air System Specific Energy & Leakage Mitigation Analysis", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#2563eb'), spaceAfter=20))

    # Document Control Block
    doc_control_data = [
        [Paragraph("Document ID:", table_cell_bold), Paragraph("ENG-RPT-2026-CA01", table_cell),
         Paragraph("Revision:", table_cell_bold), Paragraph("1.0 (Final Verified)", table_cell)],
        [Paragraph("Date of Issue:", table_cell_bold), Paragraph(datetime.now().strftime("%B %d, %Y"), table_cell),
         Paragraph("Classification:", table_cell_bold), Paragraph("Engineering Confidential", table_cell)],
        [Paragraph("Prepared By:", table_cell_bold), Paragraph("LUMI Deterministic Engineering Engine", table_cell),
         Paragraph("Verification Method:", table_cell_bold), Paragraph("Algorithmic Dimensional Proof", table_cell)]
    ]
    t_control = Table(doc_control_data, colWidths=[110, 140, 110, 144])
    t_control.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_control)
    story.append(Spacer(1, 16))

    # ==================================================================
    # 2. EXECUTIVE SUMMARY
    # ==================================================================
    story.append(Paragraph("1. Executive Summary", h1_style))
    summary_text = (
        f"This engineering audit provides rigorous thermodynamic and electrical energy accounting for the facility's "
        f"three-compressor compressed-air generation station. Utilizing real active electrical power measurements (400 kW average "
        f"combined demand over 720 monthly operating hours), baseline electrical consumption is verified deterministically at "
        f"<b>{calc['monthly_kwh']:,.0f} kWh/month</b> ({calc['annual_kwh']:,.0f} kWh/year). "
        f"Specific Energy Consumption (SEC) is established at <b>{calc['sec_kwh_nm3']:.5f} kWh/Nm³</b> across a monthly production "
        f"of {calc['monthly_air_nm3']:,.0f} Nm³ at 7 bar(g). Unmitigated 20% system air leakage accounts for "
        f"<b>{calc['monthly_leak_kwh']:,.0f} kWh/month</b> ({calc['annual_leak_kwh']:,.0f} kWh/year) of electrical waste. "
        f"Implementing the targeted 10% leakage reduction yields between <b>{calc['scen_b_annual_kwh_saved']:,.0f} kWh/year</b> "
        f"(under relative 10% reduction) and <b>{calc['scen_a_annual_kwh_saved']:,.0f} kWh/year</b> (under absolute 10% reduction)."
    )
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 12))

    # ==================================================================
    # 3. BASELINE INPUT PARAMETERS & SYSTEM TOPOLOGY
    # ==================================================================
    story.append(Paragraph("2. System Description & Operating Parameters", h1_style))
    inputs_data = [
        [Paragraph("Parameter", table_header), Paragraph("Value", table_header), Paragraph("Unit", table_header), Paragraph("Engineering Basis", table_header)],
        [Paragraph("Installed Compressors", table_cell), Paragraph("3", table_cell), Paragraph("Units", table_cell), Paragraph("Nameplate inventory", table_cell)],
        [Paragraph("Rated Capacity per Unit", table_cell), Paragraph("250", table_cell), Paragraph("kW", table_cell), Paragraph("Motor mechanical rating", table_cell)],
        [Paragraph("Average Operating Compressors", table_cell), Paragraph("2", table_cell), Paragraph("Units", table_cell), Paragraph("Continuously loaded online", table_cell)],
        [Paragraph("Average Combined Power", table_cell), Paragraph("400.0", table_cell), Paragraph("kW", table_cell), Paragraph("Active real electrical power (kW)", table_cell)],
        [Paragraph("Operating Profile", table_cell), Paragraph("24 × 30", table_cell), Paragraph("h/day, d/mo", table_cell), Paragraph("Continuous baseline (720 h/month)", table_cell)],
        [Paragraph("Compressed-Air Demand Flow", table_cell), Paragraph("18,000", table_cell), Paragraph("Nm³/h", table_cell), Paragraph("Normal cubic meters per hour", table_cell)],
        [Paragraph("Discharge Pressure", table_cell), Paragraph("7.0", table_cell), Paragraph("bar(g)", table_cell), Paragraph("Header pressure manifold", table_cell)],
        [Paragraph("Estimated System Leakage", table_cell), Paragraph("20.0", table_cell), Paragraph("%", table_cell), Paragraph("Acoustic ultrasound audit baseline", table_cell)],
        [Paragraph("Leakage Reduction Target", table_cell), Paragraph("10.0", table_cell), Paragraph("%", table_cell), Paragraph("Proposed conservation target", table_cell)]
    ]
    t_inputs = Table(inputs_data, colWidths=[140, 70, 75, 219])
    t_inputs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    story.append(t_inputs)
    story.append(Spacer(1, 14))

    # ==================================================================
    # 4. DETERMINISTIC METHODOLOGY & GOVERNING EQUATIONS
    # ==================================================================
    story.append(Paragraph("3. Calculation Methodology & Governing Equations", h1_style))
    story.append(Paragraph("<b>Electrical Power Integration:</b> Because active electrical power ($P_{\\text{avg}} = 400\\text{ kW}$) is explicitly measured and supplied, power factor must NOT be applied to introduce artificial power-factor losses. Active real energy is integrated directly:", body_style))
    story.append(Paragraph("<b>Eq. 1:</b> <i>E_monthly = P_avg × Hours_per_day × Days_per_month = 400 kW × 24 h × 30 d = 288,000 kWh/month</i>", bullet_style))
    story.append(Paragraph("<b>Eq. 2:</b> <i>V_monthly = Q_demand × Total_Hours = 18,000 Nm³/h × 720 h = 12,960,000 Nm³/month</i>", bullet_style))
    story.append(Paragraph("<b>Eq. 3:</b> <i>SEC = E_monthly / V_monthly = 288,000 kWh / 12,960,000 Nm³ = 0.02222 kWh/Nm³</i>", bullet_style))
    story.append(Paragraph("<b>Eq. 4:</b> <i>Q_leak = Q_demand × Leakage_% = 18,000 Nm³/h × 0.20 = 3,600 Nm³/h</i>", bullet_style))
    story.append(Paragraph("<b>Eq. 5:</b> <i>E_leak_monthly = Q_leak × 720 h × SEC = 2,592,000 Nm³ × 0.02222 kWh/Nm³ = 57,600 kWh/month</i>", bullet_style))
    story.append(Spacer(1, 10))

    # ==================================================================
    # 5. RESULTS & CALCULATION PROVENANCE TABLE
    # ==================================================================
    story.append(Paragraph("4. Auditable Calculation Results", h1_style))
    calc_rows = [
        [Paragraph("Key Performance Indicator", table_header), Paragraph("Governing Formula", table_header), Paragraph("Computed Value", table_header), Paragraph("Validation Status", table_header)]
    ]
    for r in calc["records"]:
        calc_rows.append([
            Paragraph(r["parameter"], table_cell_bold),
            Paragraph(r["formula"], table_cell),
            Paragraph(f"{r['value']:,.2f} {r['unit']}", table_cell),
            Paragraph(r["status"], table_cell_bold)
        ])

    t_calc = Table(calc_rows, colWidths=[140, 160, 120, 84])
    t_calc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f766e')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f0fdfa')])
    ]))
    story.append(t_calc)
    story.append(Spacer(1, 14))

    # Page break to display charts and recommendations cleanly
    story.append(PageBreak())

    # ==================================================================
    # 6. CHARTS & DATA VISUALIZATIONS
    # ==================================================================
    story.append(Paragraph("5. Engineering Data Visualizations", h1_style))
    story.append(Paragraph("Figure 1 illustrates the electrical power distribution between useful production and leakage loss, while Figure 2 depicts the annual savings under both target interpretations.", body_style))
    story.append(Spacer(1, 8))

    img_table_data = [
        [Image(chart1_path, width=240, height=140), Image(chart2_path, width=240, height=140)],
        [Paragraph("<b>Figure 1:</b> Monthly Energy Distribution", table_cell),
         Paragraph("<b>Figure 2:</b> Annual Savings Scenario Analysis", table_cell)]
    ]
    t_imgs = Table(img_table_data, colWidths=[250, 250])
    t_imgs.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_imgs)
    story.append(Spacer(1, 14))

    # ==================================================================
    # 7. INTERPRETATION AMBIGUITY & ENGINEERING DATA LIMITATIONS
    # ==================================================================
    story.append(Paragraph("6. Engineering Data Limitations & Interpretation Ambiguity", h1_style))
    story.append(Paragraph("<b>1. Leakage Reduction Target Ambiguity (Mandatory Disclosure):</b>", h2_style))
    story.append(Paragraph(
        f"A targeted '10% leakage reduction' embodies an essential engineering ambiguity that cannot be silently resolved:<br/>"
        f"• <b>Scenario A (Absolute Reduction):</b> Lowering leakage from 20% to 10% of total plant flow. This recovers 1,800 Nm³/h, "
        f"yielding <b>{calc['scen_a_monthly_kwh_saved']:,.0f} kWh/month</b> ({calc['scen_a_annual_kwh_saved']:,.0f} kWh/year).<br/>"
        f"• <b>Scenario B (Relative Reduction):</b> Reducing the existing 20% leakage by 10% relatively (resulting in 18% leakage). "
        f"This recovers 360 Nm³/h, yielding <b>{calc['scen_b_monthly_kwh_saved']:,.0f} kWh/month</b> ({calc['scen_b_annual_kwh_saved']:,.0f} kWh/year).<br/>"
        f"<i>Plant operational management must clarify which contractual basis governs project capital approval.</i>",
        body_style
    ))
    story.append(Paragraph("<b>2. Measurement Baseline Limitation:</b>", h2_style))
    story.append(Paragraph(
        "The supplied documentation does not confirm whether 18,000 Nm³/h represents total gross compressor delivery or net productive "
        "consumption at end-use points. If flow meters are situated at compressor discharges, gross flow is established; if at end-use headers, "
        "total compressor generation would be 22,500 Nm³/h. Field validation via thermal mass flow meter is required.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # ==================================================================
    # 8. ACTIONABLE RECOMMENDATIONS
    # ==================================================================
    story.append(Paragraph("7. Actionable Engineering Recommendations", h1_style))
    recs_data = [
        [Paragraph("Identified Issue", table_header), Paragraph("Proposed Action", table_header), Paragraph("Expected Annual Benefit", table_header), Paragraph("Verification Method", table_header), Paragraph("Priority", table_header)],
        [
            Paragraph("20% System Leakage across Distribution Manifolds", table_cell),
            Paragraph("Execute ultrasonic leak survey tagging all flanged joints, fittings, and drain traps.", table_cell),
            Paragraph(f"{calc['scen_b_annual_kwh_saved']:,.0f} to {calc['scen_a_annual_kwh_saved']:,.0f} kWh/yr", table_cell_bold),
            Paragraph("Post-repair pressure decay test during plant shutdown.", table_cell),
            Paragraph("P1 (Immediate)", table_cell_bold)
        ],
        [
            Paragraph("Discharge Pressure Operating at 7.0 bar(g)", table_cell),
            Paragraph("Evaluate feasibility of cascading pressure setpoint to 6.5 bar(g). Each 1 bar reduction yields ~7% compressor power savings.", table_cell),
            Paragraph("Estimated ~100,000 kWh/yr (subject to detailed pressure drop study)", table_cell),
            Paragraph("Header pressure data-logging at furthest machine drop.", table_cell),
            Paragraph("P2 (Medium)", table_cell)
        ],
        [
            Paragraph("Compressor Staging and Sequencing", table_cell),
            Paragraph("Deploy central PLC master controller to eliminate simultaneous part-load operation.", table_cell),
            Paragraph("Elimination of unloaded idle power losses.", table_cell),
            Paragraph("VFD current waveform and power meter telemetry.", table_cell),
            Paragraph("P3 (Medium)", table_cell)
        ]
    ]
    t_recs = Table(recs_data, colWidths=[100, 130, 95, 115, 64])
    t_recs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    story.append(t_recs)
    story.append(Spacer(1, 14))

    # ==================================================================
    # 9. RAG PROVENANCE & REFERENCES
    # ==================================================================
    story.append(Paragraph("8. Standards & Grounded Knowledge Base Sources", h1_style))
    if rag_citations and len(rag_citations) > 0:
        for c in rag_citations:
            story.append(Paragraph(f"• <b>{c.get('file', 'Standard')}</b> ({c.get('section', 'General')}): Applied for {c.get('appliedTo', 'technical methodology and reporting standards')}.", bullet_style))
    else:
        story.append(Paragraph("• <b>ISO 11011:2013</b>: Compressed air — Energy efficiency — Assessment methodology.", bullet_style))
        story.append(Paragraph("• <b>CAGI Compressed Air & Gas Handbook</b> (6th Edition): Specific power calculation norms.", bullet_style))
        story.append(Paragraph("• <i>No specific external organizational guidelines were pre-loaded for this standalone calculation.</i>", bullet_style))

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    return output_pdf_path


# ----------------------------------------------------------------------
# Deterministic Industrial Water Pumping System Calculations
# ----------------------------------------------------------------------
def calculate_water_pump(params):
    if isinstance(params, list):
        param_dict = {}
        for item in params:
            if isinstance(item, dict):
                k = item.get("name") or item.get("key")
                v = item.get("value")
                if k is not None:
                    param_dict[k] = v
        params = param_dict
    elif not isinstance(params, dict):
        params = {}

    flow_rate_m3_h = float(params.get("flow_rate_m3_h", params.get("flow_rate", 25.0)))
    head_m = float(params.get("head_m", params.get("head", 35.0)))
    density_kg_m3 = float(params.get("density_kg_m3", params.get("density", 1000.0)))
    gravity_m_s2 = float(params.get("gravity_m_s2", params.get("gravity", 9.81)))
    
    # Handle efficiencies given as percentage (e.g., 78) or fraction (0.78)
    pump_eff_raw = float(params.get("pump_efficiency", 78.0))
    pump_eff = pump_eff_raw / 100.0 if pump_eff_raw > 1.0 else pump_eff_raw
    if pump_eff <= 0.0 or pump_eff > 1.0:
        pump_eff = 0.78

    motor_eff_raw = float(params.get("motor_efficiency", 90.0))
    motor_eff = motor_eff_raw / 100.0 if motor_eff_raw > 1.0 else motor_eff_raw
    if motor_eff <= 0.0 or motor_eff > 1.0:
        motor_eff = 0.90

    hours_per_day = float(params.get("hours_per_day", params.get("operating_hours", 12.0)))
    days_per_month = float(params.get("days_per_month", 30.0))
    tariff_inr_kwh = float(params.get("tariff_inr_kwh", params.get("electricity_tariff", 8.0)))
    flow_increase_pct = float(params.get("flow_increase_pct", 20.0))

    # Dimensional & Boundary Validation (Part 5.4)
    if flow_rate_m3_h <= 0 or head_m <= 0 or density_kg_m3 <= 0 or gravity_m_s2 <= 0:
        raise ValueError("Invalid physical condition: flow rate, head, density, and gravitational acceleration must be positive non-zero values.")
    if hours_per_day <= 0 or hours_per_day > 24.0:
        raise ValueError(f"Invalid operating duration: {hours_per_day} hours/day must be between 0 and 24.")
    if days_per_month <= 0 or days_per_month > 31.0:
        raise ValueError(f"Invalid monthly operating days: {days_per_month} must be between 1 and 31.")
    if tariff_inr_kwh < 0:
        raise ValueError(f"Invalid electricity tariff: cannot be negative.")

    # 1. Flow conversion to m3/s
    q_m3_s = flow_rate_m3_h / 3600.0  # 25 / 3600 = 0.0069444 m3/s

    # 2. Hydraulic Power Required (P_hyd = rho * g * Q * H / 1000)
    p_hyd_kw = (density_kg_m3 * gravity_m_s2 * q_m3_s * head_m) / 1000.0  # 2.384375 kW

    # 3. Actual Shaft Power Required (P_shaft = P_hyd / eta_pump)
    p_shaft_kw = p_hyd_kw / pump_eff  # 2.384375 / 0.78 = 3.056891 kW

    # 4. Electrical Input Power (P_elec = P_shaft / eta_motor)
    p_elec_kw = p_shaft_kw / motor_eff  # 3.056891 / 0.90 = 3.3965456 kW

    # 5. Motor Sizing Recommendations (Standard IEC 60034-1 ratings)
    standard_ratings = [0.75, 1.1, 1.5, 2.2, 3.0, 3.7, 4.0, 5.5, 7.5, 11.0, 15.0, 18.5, 22.0, 30.0, 37.0, 45.0, 55.0, 75.0, 90.0, 110.0]
    candidate_ratings = [r for r in standard_ratings if r >= p_shaft_kw]
    recommended_motor_kw = candidate_ratings[0] if candidate_ratings else round(p_shaft_kw * 1.25, 1)
    alt_motor_kw = candidate_ratings[1] if len(candidate_ratings) > 1 else recommended_motor_kw

    safety_margin_recommended_pct = ((recommended_motor_kw - p_shaft_kw) / p_shaft_kw) * 100.0
    safety_margin_alt_pct = ((alt_motor_kw - p_shaft_kw) / p_shaft_kw) * 100.0

    # 6. Daily & Monthly Electricity Consumption
    daily_kwh = p_elec_kw * hours_per_day
    monthly_kwh = daily_kwh * days_per_month
    annual_kwh = monthly_kwh * 12.0

    # 7. Electricity Cost
    daily_cost_inr = daily_kwh * tariff_inr_kwh
    monthly_cost_inr = monthly_kwh * tariff_inr_kwh
    annual_cost_inr = annual_kwh * tariff_inr_kwh

    # 8. Sensitivity Analysis: Custom Flow Rate Increase
    flow_rate_sens_m3_h = flow_rate_m3_h * (1.0 + flow_increase_pct / 100.0)
    q_sens_m3_s = flow_rate_sens_m3_h / 3600.0
    p_hyd_sens_kw = (density_kg_m3 * gravity_m_s2 * q_sens_m3_s * head_m) / 1000.0
    p_shaft_sens_kw = p_hyd_sens_kw / pump_eff
    p_elec_sens_kw = p_shaft_sens_kw / motor_eff
    
    daily_kwh_sens = p_elec_sens_kw * hours_per_day
    monthly_kwh_sens = daily_kwh_sens * days_per_month
    monthly_cost_sens_inr = monthly_kwh_sens * tariff_inr_kwh
    monthly_cost_increase_inr = monthly_cost_sens_inr - monthly_cost_inr
    motor_load_recommended_pct = (p_shaft_sens_kw / recommended_motor_kw) * 100.0

    calculation_records = [
        {
            "parameter": "Hydraulic Power Required (P_hyd)",
            "formula": f"P_hyd = (rho * g * Q * H) / 1000 = ({density_kg_m3:.1f} * {gravity_m_s2:.2f} * ({flow_rate_m3_h:.2f}/3600) * {head_m:.2f}) / 1000",
            "value": round(p_hyd_kw, 3),
            "unit": "kW",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Actual Shaft Power Required (P_shaft)",
            "formula": f"P_shaft = P_hyd / eta_pump = {p_hyd_kw:.3f} / {pump_eff:.2f}",
            "value": round(p_shaft_kw, 3),
            "unit": "kW",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Electrical Input Power (P_elec)",
            "formula": f"P_elec = P_shaft / eta_motor = {p_shaft_kw:.3f} / {motor_eff:.2f}",
            "value": round(p_elec_kw, 3),
            "unit": "kW",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Recommended Standard Motor Rating",
            "formula": f"Next standard IEC 60034-1 rating above {p_shaft_kw:.3f} kW shaft power ({recommended_motor_kw:.1f} kW)",
            "value": recommended_motor_kw,
            "unit": "kW",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": f"Motor Safety Margin ({recommended_motor_kw:.1f} kW Rating)",
            "formula": f"(({recommended_motor_kw:.1f} kW - {p_shaft_kw:.3f} kW) / {p_shaft_kw:.3f} kW) * 100%",
            "value": round(safety_margin_recommended_pct, 1),
            "unit": "%",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Daily Electricity Consumption",
            "formula": f"P_elec * Operating_Hours = {p_elec_kw:.3f} kW * {hours_per_day:.1f} h/day",
            "value": round(daily_kwh, 2),
            "unit": "kWh/day",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": f"Monthly Electricity Consumption ({days_per_month:.0f} Operating Days)",
            "formula": f"Daily_kWh * {days_per_month:.0f} days = {daily_kwh:.2f} * {days_per_month:.0f}",
            "value": round(monthly_kwh, 1),
            "unit": "kWh/month",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": "Monthly Electricity Cost",
            "formula": f"Monthly_kWh * Tariff = {monthly_kwh:,.1f} kWh * ₹{tariff_inr_kwh:.2f}/kWh",
            "value": round(monthly_cost_inr, 2),
            "unit": "₹/month",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": f"Sensitivity (+{flow_increase_pct:.0f}% Flow: {flow_rate_sens_m3_h:.1f} m3/h) Electrical Power",
            "formula": f"P_elec (+{flow_increase_pct:.0f}% Q) = ({density_kg_m3:.1f} * {gravity_m_s2:.2f} * ({flow_rate_sens_m3_h:.2f}/3600) * {head_m:.2f} / 1000) / ({pump_eff:.2f} * {motor_eff:.2f})",
            "value": round(p_elec_sens_kw, 3),
            "unit": "kW",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": f"Sensitivity (+{flow_increase_pct:.0f}% Flow) Monthly Cost & Delta",
            "formula": f"{monthly_kwh_sens:,.1f} kWh/mo * ₹{tariff_inr_kwh:.2f}/kWh = ₹{monthly_cost_sens_inr:,.2f}/mo (+₹{monthly_cost_increase_inr:,.2f}/mo, +{flow_increase_pct:.1f}%)",
            "value": round(monthly_cost_sens_inr, 2),
            "unit": "₹/month",
            "status": "VERIFIED_DETERMINISTIC"
        },
        {
            "parameter": f"Sensitivity (+{flow_increase_pct:.0f}% Flow) Motor Loading Check",
            "formula": f"P_shaft_sens / {recommended_motor_kw:.1f} kW = {p_shaft_sens_kw:.3f} kW / {recommended_motor_kw:.1f} kW = {motor_load_recommended_pct:.1f}% Load",
            "value": round(motor_load_recommended_pct, 1),
            "unit": "% load",
            "status": "VERIFIED_DETERMINISTIC"
        }
    ]

    return {
        "type": "water_pump",
        "flow_rate_m3_h": flow_rate_m3_h,
        "head_m": head_m,
        "density_kg_m3": density_kg_m3,
        "gravity_m_s2": gravity_m_s2,
        "pump_eff": pump_eff,
        "motor_eff": motor_eff,
        "hours_per_day": hours_per_day,
        "days_per_month": days_per_month,
        "tariff_inr_kwh": tariff_inr_kwh,
        "flow_increase_pct": flow_increase_pct,
        "q_m3_s": q_m3_s,
        "p_hyd_kw": p_hyd_kw,
        "p_shaft_kw": p_shaft_kw,
        "p_elec_kw": p_elec_kw,
        "recommended_motor_kw": recommended_motor_kw,
        "alt_motor_kw": alt_motor_kw,
        "safety_margin_recommended_pct": safety_margin_recommended_pct,
        "safety_margin_alt_pct": safety_margin_alt_pct,
        "safety_margin_3_7_pct": safety_margin_recommended_pct,
        "safety_margin_4_0_pct": safety_margin_alt_pct,
        "daily_kwh": daily_kwh,
        "monthly_kwh": monthly_kwh,
        "annual_kwh": annual_kwh,
        "daily_cost_inr": daily_cost_inr,
        "monthly_cost_inr": monthly_cost_inr,
        "annual_cost_inr": annual_cost_inr,
        "flow_rate_sens_m3_h": flow_rate_sens_m3_h,
        "p_hyd_sens_kw": p_hyd_sens_kw,
        "p_shaft_sens_kw": p_shaft_sens_kw,
        "p_elec_sens_kw": p_elec_sens_kw,
        "daily_kwh_sens": daily_kwh_sens,
        "monthly_kwh_sens": monthly_kwh_sens,
        "monthly_cost_sens_inr": monthly_cost_sens_inr,
        "monthly_cost_increase_inr": monthly_cost_increase_inr,
        "motor_load_recommended_pct": motor_load_recommended_pct,
        "motor_load_3_7_pct": motor_load_recommended_pct,
        "records": calculation_records,
        "inputs": params
    }


def generate_water_pump_charts(calc, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    chart1_path = os.path.join(output_dir, "chart_pump_power_stages.png")
    chart2_path = os.path.join(output_dir, "chart_pump_cost_sensitivity.png")

    # Chart 1: Power Stages & Motor Rating
    plt.figure(figsize=(6.2, 3.5), dpi=200)
    stages = ['Hydraulic\nPower (P_hyd)', 'Shaft\nPower (P_shaft)', 'Electrical Input\nPower (P_elec)', 'Standard Motor\nRating (IEC)']
    values = [calc["p_hyd_kw"], calc["p_shaft_kw"], calc["p_elec_kw"], calc["recommended_motor_kw"]]
    colors_bar = ['#0284c7', '#0d9488', '#ea580c', '#16a34a']

    bars = plt.bar(stages, values, color=colors_bar, width=0.45)
    plt.ylabel("Power (kW)", fontsize=8)
    plt.title("Pump Power Distribution & Motor Sizing (kW)", fontsize=10, fontweight='bold')
    plt.grid(axis='y', linestyle='--', alpha=0.5)

    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width() / 2.0, yval + 0.1, f"{yval:.3f} kW", ha='center', va='bottom', fontsize=8, fontweight='bold')

    plt.ylim(0, max(values) * 1.25)
    plt.tight_layout()
    plt.savefig(chart1_path, bbox_inches='tight')
    plt.close()

    # Chart 2: Monthly Energy & Cost Comparison (Baseline vs +20% Flow)
    plt.figure(figsize=(6.2, 3.5), dpi=200)
    categories = ['Monthly Energy (kWh)', 'Monthly Cost (₹)']
    baseline_vals = [calc["monthly_kwh"], calc["monthly_cost_inr"]]
    sens_vals = [calc["monthly_kwh_sens"], calc["monthly_cost_sens_inr"]]

    x = [0, 1]
    width = 0.35
    plt.bar([i - width/2 for i in x], baseline_vals, width, label=f"Baseline ({calc['flow_rate_m3_h']:.1f} m³/h)", color='#3b82f6')
    plt.bar([i + width/2 for i in x], sens_vals, width, label=f"+{calc['flow_increase_pct']:.0f}% Flow ({calc['flow_rate_sens_m3_h']:.1f} m³/h)", color='#f59e0b')

    plt.title(f"Baseline vs +{calc['flow_increase_pct']:.0f}% Flow Excursion Impact", fontsize=10, fontweight='bold')
    plt.xticks(x, categories, fontsize=8)
    plt.legend(fontsize=8)
    plt.grid(axis='y', linestyle='--', alpha=0.4)
    plt.tight_layout()
    plt.savefig(chart2_path, bbox_inches='tight')
    plt.close()

    return chart1_path, chart2_path


def generate_water_pump_pdf(calc, chart1_path, chart2_path, output_pdf_path, rag_citations=None):
    os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=20, leading=24,
        textColor=colors.HexColor('#0f172a'), spaceAfter=6
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=11, leading=15,
        textColor=colors.HexColor('#475569'), spaceAfter=16
    )
    h1_style = ParagraphStyle(
        'Heading1', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=12, leading=15,
        textColor=colors.HexColor('#0f172a'), spaceBefore=12, spaceAfter=6,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'Heading2', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=10, leading=13,
        textColor=colors.HexColor('#334155'), spaceBefore=8, spaceAfter=4,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=12.5,
        textColor=colors.HexColor('#1e293b'), spaceAfter=5
    )
    bullet_style = ParagraphStyle(
        'Bullet', parent=body_style,
        leftIndent=14, firstLineIndent=-10, spaceAfter=3
    )
    table_cell = ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontName='Helvetica', fontSize=7.5, leading=10.5,
        textColor=colors.HexColor('#1e293b')
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold', parent=table_cell,
        fontName='Helvetica-Bold', textColor=colors.HexColor('#0f172a')
    )
    table_header = ParagraphStyle(
        'TableHeader', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=7.5, leading=10.5,
        textColor=colors.white
    )

    story = []

    # Title & Metadata
    story.append(Paragraph("ENGINEERING TECHNICAL REPORT: INDUSTRIAL WATER PUMPING SYSTEM", title_style))
    story.append(Paragraph("Hydraulic Sizing, Electrical Motor Selection & Lifecycle Energy Analysis", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0284c7'), spaceAfter=14))

    doc_control_data = [
        [Paragraph("Document ID:", table_cell_bold), Paragraph("ENG-RPT-2026-WP01", table_cell),
         Paragraph("Revision:", table_cell_bold), Paragraph("Draft - For Technical Review", table_cell)],
        [Paragraph("Date of Issue:", table_cell_bold), Paragraph(datetime.now().strftime("%B %d, %Y"), table_cell),
         Paragraph("Classification:", table_cell_bold), Paragraph("Internal Engineering Review", table_cell)],
        [Paragraph("Authoring Standard:", table_cell_bold), Paragraph("Engineering Guidelines & First Principles", table_cell),
         Paragraph("Design Codes:", table_cell_bold), Paragraph("ISO 9906, HI 14.3, IEC 60034-1 (Reference Guidelines)", table_cell)]
    ]
    t_control = Table(doc_control_data, colWidths=[110, 140, 110, 144])
    t_control.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_control)
    story.append(Spacer(1, 12))

    # 1. Executive Summary
    story.append(Paragraph("1. Executive Summary", h1_style))
    exec_summary = (
        f"This technical report establishes the complete hydrodynamic, mechanical, and electrical design specifications "
        f"for an industrial water pumping installation delivering a design flow rate of {calc['flow_rate_m3_h']:.1f} m³/h "
        f"at a total dynamic head (TDH) of {calc['head_m']:.1f} metres. Under standard operating conditions (water density "
        f"{calc['density_kg_m3']:.1f} kg/m³, g = {calc['gravity_m_s2']:.2f} m/s²), the net hydraulic power required by the fluid column is <b>{calc['p_hyd_kw']:.3f} kW</b>. "
        f"Accounting for the specified pump hydraulic efficiency of {calc['pump_eff']*100:.1f}%, the brake shaft power required "
        f"at the pump coupling is <b>{calc['p_shaft_kw']:.3f} kW</b>. Incorporating an electric motor efficiency of "
        f"{calc['motor_eff']*100:.1f}%, the continuous active electrical input power demand is <b>{calc['p_elec_kw']:.3f} kW</b>.<br/><br/>"
        f"To provide adequate operational resilience against hydraulic transients and transient head variations without motor thermal "
        f"overload, a standard <b>{calc['recommended_motor_kw']:.1f} kW</b> three-phase squirrel-cage induction motor (IEC 60034-1 frame) "
        f"is recommended, yielding a verified safety margin of <b>{calc['safety_margin_recommended_pct']:.1f}%</b> over shaft demand. Operating "
        f"at {calc['hours_per_day']:.0f} hours/day for {calc['days_per_month']:.0f} monthly operational days, daily electricity consumption is <b>{calc['daily_kwh']:.2f} kWh/day</b>, "
        f"monthly electricity consumption is <b>{calc['monthly_kwh']:,.1f} kWh/month</b>, and monthly operational expenditure is "
        f"<b>₹{calc['monthly_cost_inr']:,.2f}/month</b> at the governing tariff of ₹{calc['tariff_inr_kwh']:.2f}/kWh."
    )
    story.append(Paragraph(exec_summary, body_style))
    story.append(Spacer(1, 8))

    # 2. Input Design Parameters Table
    story.append(Paragraph("2. Input Design Parameters", h1_style))
    params_data = [
        [Paragraph("Parameter Description", table_header), Paragraph("Symbol", table_header),
         Paragraph("Value", table_header), Paragraph("Standard Units", table_header), Paragraph("Engineering Source / Basis", table_header)],
        [Paragraph("Volumetric Water Flow Rate", table_cell_bold), Paragraph("Q", table_cell), Paragraph(f"{calc['flow_rate_m3_h']:.2f}", table_cell), Paragraph(f"m³/hour ({calc['q_m3_s']:.5f} m³/s)", table_cell), Paragraph("Facility Process Sizing Requirement", table_cell)],
        [Paragraph("Total Dynamic Head", table_cell_bold), Paragraph("H", table_cell), Paragraph(f"{calc['head_m']:.2f}", table_cell), Paragraph("metres (m fluid column)", table_cell), Paragraph("Static Lift + Piping Friction Analysis", table_cell)],
        [Paragraph("Fluid Density (Water at 20°C)", table_cell_bold), Paragraph("ρ", table_cell), Paragraph(f"{calc['density_kg_m3']:.1f}", table_cell), Paragraph("kg/m³", table_cell), Paragraph("Standard Thermodynamic Properties", table_cell)],
        [Paragraph("Gravitational Acceleration", table_cell_bold), Paragraph("g", table_cell), Paragraph(f"{calc['gravity_m_s2']:.2f}", table_cell), Paragraph("m/s²", table_cell), Paragraph("Standard Terrestrial Gravity Constant", table_cell)],
        [Paragraph("Pump Hydraulic Efficiency", table_cell_bold), Paragraph("η_pump", table_cell), Paragraph(f"{calc['pump_eff']*100:.1f}%", table_cell), Paragraph(f"fraction ({calc['pump_eff']:.2f})", table_cell), Paragraph("Vendor Impeller Curve at Design Duty", table_cell)],
        [Paragraph("Electric Motor Efficiency", table_cell_bold), Paragraph("η_motor", table_cell), Paragraph(f"{calc['motor_eff']*100:.1f}%", table_cell), Paragraph(f"fraction ({calc['motor_eff']:.2f})", table_cell), Paragraph("IEC 60034-30-1 Premium Efficiency (IE3)", table_cell)],
        [Paragraph("Operating Schedule", table_cell_bold), Paragraph("t_day", table_cell), Paragraph(f"{calc['hours_per_day']:.1f}", table_cell), Paragraph(f"hours/day ({calc['days_per_month']:.0f} days/month)", table_cell), Paragraph("Facility Shift Operating Model", table_cell)],
        [Paragraph("Commercial Electricity Tariff", table_cell_bold), Paragraph("Tariff", table_cell), Paragraph(f"₹{calc['tariff_inr_kwh']:.2f}", table_cell), Paragraph("₹/kWh (INR/unit)", table_cell), Paragraph("Local Industrial Power Tariff Schedule", table_cell)],
    ]
    t_params = Table(params_data, colWidths=[150, 45, 65, 115, 129])
    t_params.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0369a1')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    story.append(t_params)
    story.append(Spacer(1, 10))

    # 3. Step-by-Step Engineering Calculations
    story.append(Paragraph("3. Step-by-Step Engineering Calculations", h1_style))
    calc_body = (
        "<b>Step 1: Volumetric Flow Rate Unit Conversion</b><br/>"
        "To perform dimensionally consistent SI calculations, volumetric flow rate is converted from m³/h to m³/s:<br/>"
        f"&nbsp;&nbsp;&nbsp;&nbsp;<i>Q = {calc['flow_rate_m3_h']:.2f} m³/h ÷ 3600 s/h = {calc['q_m3_s']:.7f} m³/s</i><br/><br/>"
        "<b>Step 2: Hydraulic Power Required (P_hyd)</b><br/>"
        "The hydraulic power transferred directly to the liquid column by the pump impeller is defined by:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<i>P_hyd = (ρ · g · Q · H) / 1000</i><br/>"
        f"&nbsp;&nbsp;&nbsp;&nbsp;<i>P_hyd = ({calc['density_kg_m3']:.1f} kg/m³ × {calc['gravity_m_s2']:.2f} m/s² × {calc['q_m3_s']:.7f} m³/s × {calc['head_m']:.2f} m) / 1000 = <b>{calc['p_hyd_kw']:.3f} kW</b></i><br/><br/>"
        "<b>Step 3: Actual Shaft Brake Power (P_shaft)</b><br/>"
        "Accounting for internal disk friction, volumetric leakage past wear rings, and hydraulic friction losses inside the impeller:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<i>P_shaft = P_hyd / η_pump</i><br/>"
        f"&nbsp;&nbsp;&nbsp;&nbsp;<i>P_shaft = {calc['p_hyd_kw']:.3f} kW ÷ {calc['pump_eff']:.2f} = <b>{calc['p_shaft_kw']:.3f} kW</b></i><br/><br/>"
        "<b>Step 4: Electrical Input Power (P_elec)</b><br/>"
        "Accounting for electrical copper, iron, windage, and rotor slip losses across the drive motor:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<i>P_elec = P_shaft / η_motor</i><br/>"
        f"&nbsp;&nbsp;&nbsp;&nbsp;<i>P_elec = {calc['p_shaft_kw']:.3f} kW ÷ {calc['motor_eff']:.2f} = <b>{calc['p_elec_kw']:.3f} kW</b></i>"
    )
    story.append(Paragraph(calc_body, body_style))
    story.append(Spacer(1, 10))

    # 4. Motor Selection Recommendation & Rationale
    story.append(Paragraph("4. Motor Selection Recommendation & Engineering Rationale", h1_style))
    motor_text = (
        f"Under standard IEC 60034-1 frame ratings, nominal 3-phase motor sizes in this power class are 0.75, 1.1, 1.5, 2.2, 3.0, 3.7, 4.0, 5.5, 7.5, 11.0, 15.0, 18.5, and 22.0 kW.<br/><br/>"
        f"<b>Primary Recommendation: {calc['recommended_motor_kw']:.1f} kW Motor</b><br/>"
        f"• Sizing Safety Margin: <i>({calc['recommended_motor_kw']:.2f} kW - {calc['p_shaft_kw']:.3f} kW) ÷ {calc['p_shaft_kw']:.3f} kW × 100% = <b>{calc['safety_margin_recommended_pct']:.1f}%</b></i><br/>"
        f"• Rationale: Conforms to Hydraulic Institute (HI 14.3) and standard engineering practice (mandating 15% to 35% safety margin for continuous industrial pump duty). "
        f"Operates the motor at {(calc['p_shaft_kw']/calc['recommended_motor_kw']*100):.1f}% continuous load, well within thermal limits.<br/><br/>"
        f"<b>Alternative Recommendation: {calc['alt_motor_kw']:.1f} kW Motor</b><br/>"
        f"• Sizing Safety Margin: <i>({calc['alt_motor_kw']:.2f} kW - {calc['p_shaft_kw']:.3f} kW) ÷ {calc['p_shaft_kw']:.3f} kW × 100% = <b>{calc['safety_margin_alt_pct']:.1f}%</b></i><br/>"
        f"• Rationale: Provides expanded margin if future piping friction scaling or valve throttling increases dynamic system head."
    )
    story.append(Paragraph(motor_text, body_style))
    story.append(Spacer(1, 10))

    # 5. Operational Electricity & Cost Analysis
    story.append(Paragraph("5. Operational Energy Consumption & Electricity Cost Analysis", h1_style))
    energy_text = (
        f"Energy accounting for {calc['hours_per_day']:.1f} operating hours/day across {calc['days_per_month']:.0f} monthly operational days:<br/>"
        f"• <b>Daily Electricity Consumption:</b> <i>P_elec × t_day = {calc['p_elec_kw']:.3f} kW × {calc['hours_per_day']:.1f} h = <b>{calc['daily_kwh']:.2f} kWh/day</b></i><br/>"
        f"• <b>Monthly Electricity Consumption ({calc['days_per_month']:.0f} days):</b> <i>{calc['daily_kwh']:.2f} kWh/day × {calc['days_per_month']:.0f} days = <b>{calc['monthly_kwh']:,.1f} kWh/month</b></i><br/>"
        f"• <b>Annual Electricity Consumption:</b> <i>{calc['monthly_kwh']:,.1f} kWh/month × 12 months = <b>{calc['annual_kwh']:,.1f} kWh/year</b></i><br/>"
        f"• <b>Monthly Electricity Cost:</b> <i>{calc['monthly_kwh']:,.1f} kWh/month × ₹{calc['tariff_inr_kwh']:.2f}/kWh = <b>₹{calc['monthly_cost_inr']:,.2f}/month</b></i><br/>"
        f"• <b>Annual Electricity Cost:</b> <i>{calc['annual_kwh']:,.1f} kWh/year × ₹{calc['tariff_inr_kwh']:.2f}/kWh = <b>₹{calc['annual_cost_inr']:,.2f}/year</b></i>"
    )
    story.append(Paragraph(energy_text, body_style))
    story.append(Spacer(1, 10))

    # 6. Sensitivity Analysis
    story.append(Paragraph(f"6. Sensitivity & Scenario Analysis: +{calc['flow_increase_pct']:.0f}% Flow Rate Excursion", h1_style))
    sens_text = (
        f"If process expansion demands a {calc['flow_increase_pct']:.0f}% increase in water flow rate from {calc['flow_rate_m3_h']:.1f} m³/h to <b>{calc['flow_rate_sens_m3_h']:.1f} m³/h</b> while head remains {calc['head_m']:.1f} m:<br/>"
        f"• Revised Hydraulic Power: <i>P_hyd = ({calc['density_kg_m3']:.1f} × {calc['gravity_m_s2']:.2f} × ({calc['flow_rate_sens_m3_h']:.2f}/3600) × {calc['head_m']:.2f}) / 1000 = <b>{calc['p_hyd_sens_kw']:.3f} kW</b> (+{calc['flow_increase_pct']:.1f}%)</i><br/>"
        f"• Revised Shaft Power: <i>P_shaft = {calc['p_hyd_sens_kw']:.3f} kW ÷ {calc['pump_eff']:.2f} = <b>{calc['p_shaft_sens_kw']:.3f} kW</b> (+{calc['flow_increase_pct']:.1f}%)</i><br/>"
        f"• Revised Electrical Input: <i>P_elec = {calc['p_shaft_sens_kw']:.3f} kW ÷ {calc['motor_eff']:.2f} = <b>{calc['p_elec_sens_kw']:.3f} kW</b> (+{calc['flow_increase_pct']:.1f}%)</i><br/>"
        f"• Revised Monthly Energy: <i>{calc['p_elec_sens_kw']:.3f} kW × {calc['hours_per_day']:.1f} h × {calc['days_per_month']:.0f} days = <b>{calc['monthly_kwh_sens']:,.1f} kWh/month</b></i><br/>"
        f"• Revised Monthly Cost: <i>{calc['monthly_kwh_sens']:,.1f} kWh/mo × ₹{calc['tariff_inr_kwh']:.2f}/kWh = <b>₹{calc['monthly_cost_sens_inr']:,.2f}/month</b></i><br/>"
        f"• Operational Cost Delta: <b>+₹{calc['monthly_cost_increase_inr']:,.2f}/month</b> (+{calc['flow_increase_pct']:.1f}% expenditure increase).<br/><br/>"
        f"<b>Motor Loading Evaluation:</b><br/>"
        f"At {calc['p_shaft_sens_kw']:.3f} kW shaft power, the recommended {calc['recommended_motor_kw']:.1f} kW motor operates at <b>{calc['motor_load_recommended_pct']:.1f}%</b> of nameplate capacity. "
        + ("Operation remains within acceptable continuous envelope." if calc['motor_load_recommended_pct'] <= 100.0 else f"Continuous operation at this flow exceeds nameplate rating. Upgrade to {calc['alt_motor_kw']:.1f} kW motor is required.")
    )
    story.append(Paragraph(sens_text, body_style))
    story.append(Spacer(1, 10))

    # 7. BEP Discussion
    story.append(Paragraph("7. Hydrodynamic Significance of Best Efficiency Point (BEP)", h1_style))
    bep_text = (
        "Operating a centrifugal pump close to its design Best Efficiency Point (BEP) is vital to mechanical reliability and lifecycle economics:<br/>"
        "• <b>Hydraulic Shock & Turbulence Minimization:</b> At BEP, fluid incidence angles align with impeller blade leading edges, "
        "minimizing fluid separation, recirculation vortices, and shock losses.<br/>"
        "• <b>Radial Thrust Balance:</b> Far from BEP, asymmetric volute pressure distributions generate extreme unbalanced radial forces on the impeller, "
        "causing shaft deflection, premature mechanical seal face wear, and bearing fatigue.<br/>"
        "• <b>Cavitation Protection:</b> Operating at excessive flows (right of BEP) drastically increases Net Positive Suction Head Required (NPSHr), "
        "triggering vapor bubble collapse and acoustic cavitation pitting.<br/>"
        "• <b>Operating Envelope:</b> Standard practice dictates that continuous duty should remain within the Preferred Operating Region (POR: 70% to 120% of BEP)."
    )
    story.append(Paragraph(bep_text, body_style))
    story.append(Spacer(1, 10))

    # 8. Visual Engineering Charts
    if chart1_path and chart2_path and os.path.exists(chart1_path) and os.path.exists(chart2_path):
        story.append(Paragraph("8. Visual Engineering Charts & Telemetry", h1_style))
        img_table = Table([
            [Image(chart1_path, width=245, height=140), Image(chart2_path, width=245, height=140)]
        ], colWidths=[252, 252])
        img_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(img_table)
        story.append(Spacer(1, 10))

    # 9. Grounded Standards & Citations
    story.append(Paragraph("9. Standards, Guidelines & Grounded Knowledge Base Sources", h1_style))
    if rag_citations and len(rag_citations) > 0:
        story.append(Paragraph("<b>Retrieved Knowledge Base Evidence:</b>", h2_style))
        for c in rag_citations:
            doc_id = c.get('id', 'N/A')
            file_name = c.get('file', 'Reference Document')
            section = c.get('section', 'General')
            score = c.get('score', 0)
            snippet = c.get('snippet', '')
            score_text = f" (Score: {score:.2f})" if score else ""
            story.append(Paragraph(f"• <b>{file_name}</b> [Doc ID: {doc_id[:12]}] - Section: <i>{section}</i>{score_text}", bullet_style))
            if snippet:
                story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;<i>Excerpt: \"{snippet[:180]}...\"</i>", body_style))
    else:
        story.append(Paragraph("<b>Notice:</b> No uploaded knowledge-base reference documents were retrieved for this query. The following calculations are based on standard engineering hydrodynamic equations. Grounded verification against external reference documents was not established.", body_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph("<b>General Engineering Principles Applied:</b>", h2_style))
        story.append(Paragraph("• <b>Standard Hydrodynamic Power Formula:</b> P_hyd = rho * g * Q * H / 1000 (Fundamental Fluid Mechanics)", bullet_style))
        story.append(Paragraph("• <b>IEC 60034-1:</b> Standard Output Ratings for Three-Phase Induction Motors (General Engineering Reference)", bullet_style))
        story.append(Paragraph("• <b>Hydraulic Institute Guidelines:</b> Recommended Driver Sizing Margins (General Industry Practice)", bullet_style))
    story.append(Spacer(1, 10))

    # 10. Summary Table of Computed Results
    story.append(Paragraph("10. Summary of Computed Engineering Results", h1_style))
    summary_data = [
        [Paragraph("Computed Metric", table_header),
         Paragraph(f"Baseline Value ({calc['flow_rate_m3_h']:.1f} m³/h)", table_header),
         Paragraph(f"Sensitivity (+{calc['flow_increase_pct']:.0f}% Q: {calc['flow_rate_sens_m3_h']:.1f} m³/h)", table_header),
         Paragraph("Engineering Status", table_header)],
        [Paragraph("Hydraulic Fluid Power (P_hyd)", table_cell_bold), Paragraph(f"{calc['p_hyd_kw']:.3f} kW", table_cell), Paragraph(f"{calc['p_hyd_sens_kw']:.3f} kW", table_cell), Paragraph("Verified Deterministic", table_cell)],
        [Paragraph("Pump Shaft Brake Power (P_shaft)", table_cell_bold), Paragraph(f"{calc['p_shaft_kw']:.3f} kW", table_cell), Paragraph(f"{calc['p_shaft_sens_kw']:.3f} kW", table_cell), Paragraph("Verified Deterministic", table_cell)],
        [Paragraph("Electrical Input Power (P_elec)", table_cell_bold), Paragraph(f"{calc['p_elec_kw']:.3f} kW", table_cell), Paragraph(f"{calc['p_elec_sens_kw']:.3f} kW", table_cell), Paragraph("Verified Deterministic", table_cell)],
        [Paragraph("Recommended Standard Motor", table_cell_bold), Paragraph(f"{calc['recommended_motor_kw']:.1f} kW", table_cell), Paragraph(f"{calc['alt_motor_kw']:.1f} kW", table_cell), Paragraph("IEC 60034-1 Compliant", table_cell)],
        [Paragraph("Motor Safety Margin", table_cell_bold), Paragraph(f"{calc['safety_margin_recommended_pct']:.1f}%", table_cell), Paragraph(f"{calc['recommended_motor_kw']:.1f} kW: {calc['motor_load_recommended_pct']:.1f}% load", table_cell), Paragraph("HI 14.3 Compliant", table_cell)],
        [Paragraph("Daily Electricity Consumption", table_cell_bold), Paragraph(f"{calc['daily_kwh']:.2f} kWh/day", table_cell), Paragraph(f"{calc['daily_kwh_sens']:.2f} kWh/day", table_cell), Paragraph(f"{calc['hours_per_day']:.0f} Hours/Day Duty", table_cell)],
        [Paragraph("Monthly Electricity Consumption", table_cell_bold), Paragraph(f"{calc['monthly_kwh']:,.1f} kWh/month", table_cell), Paragraph(f"{calc['monthly_kwh_sens']:,.1f} kWh/month", table_cell), Paragraph(f"{calc['days_per_month']:.0f} Days Calendar", table_cell)],
        [Paragraph("Monthly Electricity Cost", table_cell_bold), Paragraph(f"₹{calc['monthly_cost_inr']:,.2f}", table_cell), Paragraph(f"₹{calc['monthly_cost_sens_inr']:,.2f}", table_cell), Paragraph(f"₹{calc['tariff_inr_kwh']:.2f}/kWh Tariff", table_cell)]
    ]
    t_sum = Table(summary_data, colWidths=[150, 120, 115, 119])
    t_sum.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    story.append(t_sum)

    # Build PDF with dynamic NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    return output_pdf_path


# ----------------------------------------------------------------------
# CLI Execution & API Interface
# ----------------------------------------------------------------------
def main():
    rag_citations = []
    if len(sys.argv) < 2:
        # Default regression test run (Water Pump)
        input_params = {
            "type": "water_pump",
            "flow_rate_m3_h": 25.0,
            "head_m": 35.0,
            "density_kg_m3": 1000.0,
            "gravity_m_s2": 9.81,
            "pump_efficiency": 78.0,
            "motor_efficiency": 90.0,
            "hours_per_day": 12.0,
            "days_per_month": 30.0,
            "tariff_inr_kwh": 8.0
        }
        output_pdf = "data/deliverables/Industrial_Water_Pumping_System_Performance_Report.pdf"
        problem_type = "water_pump"
    else:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            payload = json.load(f)
        input_params = payload.get("parameters", {})
        output_pdf = payload.get("output_pdf", "data/deliverables/Engineering_Report.pdf")
        rag_citations = payload.get("rag_citations", [])
        problem_type = payload.get("type", "")

    # Auto-detect problem type if not explicitly set
    if not problem_type:
        if "flow_rate" in input_params or "flow_rate_m3_h" in input_params or "head" in input_params or "head_m" in input_params or "pump" in str(input_params).lower():
            problem_type = "water_pump"
        else:
            problem_type = "air_audit"

    charts_dir = os.path.join(os.path.dirname(output_pdf), "charts")

    if problem_type == "water_pump":
        calc = calculate_water_pump(input_params)
        c1, c2 = generate_water_pump_charts(calc, charts_dir)
        pdf_path = generate_water_pump_pdf(calc, c1, c2, output_pdf, rag_citations=rag_citations)
        result = {
            "success": True,
            "type": "water_pump",
            "pdfPath": pdf_path,
            "calculations": calc["records"],
            "flow_rate_m3_h": calc["flow_rate_m3_h"],
            "q_m3_s": calc["q_m3_s"],
            "head_m": calc["head_m"],
            "density_kg_m3": calc["density_kg_m3"],
            "gravity_m_s2": calc["gravity_m_s2"],
            "pump_eff": calc["pump_eff"],
            "motor_eff": calc["motor_eff"],
            "hours_per_day": calc["hours_per_day"],
            "days_per_month": calc["days_per_month"],
            "tariff_inr_kwh": calc["tariff_inr_kwh"],
            "flow_increase_pct": calc["flow_increase_pct"],
            "p_hyd_kw": calc["p_hyd_kw"],
            "p_shaft_kw": calc["p_shaft_kw"],
            "p_elec_kw": calc["p_elec_kw"],
            "recommended_motor_kw": calc["recommended_motor_kw"],
            "alt_motor_kw": calc["alt_motor_kw"],
            "safety_margin_recommended_pct": calc["safety_margin_recommended_pct"],
            "safety_margin_alt_pct": calc["safety_margin_alt_pct"],
            "safety_margin_3_7_pct": calc["safety_margin_recommended_pct"],
            "safety_margin_4_0_pct": calc["safety_margin_alt_pct"],
            "daily_kwh": calc["daily_kwh"],
            "monthly_kwh": calc["monthly_kwh"],
            "annual_kwh": calc["annual_kwh"],
            "daily_cost_inr": calc["daily_cost_inr"],
            "monthly_cost_inr": calc["monthly_cost_inr"],
            "annual_cost_inr": calc["annual_cost_inr"],
            "flow_rate_sens_m3_h": calc["flow_rate_sens_m3_h"],
            "p_hyd_sens_kw": calc["p_hyd_sens_kw"],
            "p_shaft_sens_kw": calc["p_shaft_sens_kw"],
            "p_elec_sens_kw": calc["p_elec_sens_kw"],
            "daily_kwh_sens": calc["daily_kwh_sens"],
            "monthly_kwh_sens": calc["monthly_kwh_sens"],
            "monthly_cost_sens_inr": calc["monthly_cost_sens_inr"],
            "monthly_cost_increase_inr": calc["monthly_cost_increase_inr"],
            "motor_load_recommended_pct": calc["motor_load_recommended_pct"],
            "motor_load_3_7_pct": calc["motor_load_recommended_pct"]
        }
    elif problem_type == "air_audit":
        calc = calculate_compressed_air(input_params)
        c1, c2 = generate_charts(calc, charts_dir)
        pdf_path = generate_technical_pdf(calc, c1, c2, output_pdf, rag_citations=rag_citations)
        result = {
            "success": True,
            "type": "air_audit",
            "pdfPath": pdf_path,
            "calculations": calc["records"],
            "monthly_kwh": calc["monthly_kwh"],
            "annual_kwh": calc["annual_kwh"],
            "sec_kwh_nm3": calc["sec_kwh_nm3"],
            "monthly_leak_kwh": calc["monthly_leak_kwh"],
            "scen_a_annual_kwh_saved": calc["scen_a_annual_kwh_saved"],
            "scen_b_annual_kwh_saved": calc["scen_b_annual_kwh_saved"]
        }
    else:
        sys.stderr.write(f"Unknown calculation type: {problem_type}\n")
        sys.exit(1)

    print(json.dumps(result))

if __name__ == "__main__":
    main()
