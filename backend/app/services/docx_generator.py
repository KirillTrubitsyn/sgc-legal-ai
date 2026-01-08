"""
DOCX generator service for exporting AI responses
"""
import io
import re
from datetime import datetime
from typing import Optional
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE


def create_response_docx(
    question: str,
    answer: str,
    model: Optional[str] = None,
    created_at: Optional[datetime] = None
) -> bytes:
    """
    Create a DOCX document from AI response

    Args:
        question: User's question
        answer: AI response
        model: Model name used
        created_at: Response creation time

    Returns:
        DOCX file as bytes
    """
    doc = Document()

    # Set up styles
    _setup_styles(doc)

    # Title
    title = doc.add_paragraph()
    title_run = title.add_run("SGC Legal AI")
    title_run.bold = True
    title_run.font.size = Pt(18)
    title_run.font.color.rgb = RGBColor(0xF7, 0x93, 0x1E)  # SGC Orange
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Metadata
    meta = doc.add_paragraph()
    if model:
        meta.add_run(f"Модель: {model}\n").italic = True
    if created_at:
        date_str = created_at.strftime("%d.%m.%Y %H:%M")
    else:
        date_str = datetime.now().strftime("%d.%m.%Y %H:%M")
    meta.add_run(f"Дата: {date_str}").italic = True
    meta.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    doc.add_paragraph()  # Spacer

    # Question section
    q_heading = doc.add_paragraph()
    q_heading_run = q_heading.add_run("Вопрос")
    q_heading_run.bold = True
    q_heading_run.font.size = Pt(14)
    q_heading_run.font.color.rgb = RGBColor(0xF7, 0x93, 0x1E)

    q_para = doc.add_paragraph(question)
    q_para.paragraph_format.left_indent = Inches(0.25)

    doc.add_paragraph()  # Spacer

    # Answer section
    a_heading = doc.add_paragraph()
    a_heading_run = a_heading.add_run("Ответ")
    a_heading_run.bold = True
    a_heading_run.font.size = Pt(14)
    a_heading_run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)  # SGC Blue

    # Parse markdown-like formatting in answer
    _add_formatted_text(doc, answer)

    # Footer
    doc.add_paragraph()
    footer = doc.add_paragraph()
    footer_run = footer.add_run("─" * 50)
    footer_run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER

    disclaimer = doc.add_paragraph()
    disclaimer_run = disclaimer.add_run(
        "Документ создан с помощью SGC Legal AI. "
        "Данный ответ носит информационный характер и не является юридической консультацией."
    )
    disclaimer_run.font.size = Pt(9)
    disclaimer_run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
    disclaimer_run.italic = True
    disclaimer.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Save to bytes
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    return buffer.getvalue()


def _setup_styles(doc: Document):
    """Set up document styles"""
    styles = doc.styles

    # Normal style
    style = styles['Normal']
    style.font.name = 'Arial'
    style.font.size = Pt(11)


def _add_formatted_text(doc: Document, text: str):
    """
    Add text with basic markdown formatting support
    Handles: **bold**, *italic*, headers (#, ##, ###), bullet lists
    """
    lines = text.split('\n')
    current_para = None
    in_list = False

    for line in lines:
        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            if current_para:
                current_para = None
            doc.add_paragraph()
            in_list = False
            continue

        # Headers
        if stripped.startswith('### '):
            p = doc.add_paragraph()
            run = p.add_run(stripped[4:])
            run.bold = True
            run.font.size = Pt(12)
            current_para = None
            in_list = False
            continue
        elif stripped.startswith('## '):
            p = doc.add_paragraph()
            run = p.add_run(stripped[3:])
            run.bold = True
            run.font.size = Pt(13)
            current_para = None
            in_list = False
            continue
        elif stripped.startswith('# '):
            p = doc.add_paragraph()
            run = p.add_run(stripped[2:])
            run.bold = True
            run.font.size = Pt(14)
            current_para = None
            in_list = False
            continue

        # Bullet lists
        if stripped.startswith('- ') or stripped.startswith('* '):
            p = doc.add_paragraph(style='List Bullet')
            _add_inline_formatting(p, stripped[2:])
            current_para = None
            in_list = True
            continue

        # Numbered lists
        if re.match(r'^\d+\.\s', stripped):
            p = doc.add_paragraph(style='List Number')
            text_content = re.sub(r'^\d+\.\s', '', stripped)
            _add_inline_formatting(p, text_content)
            current_para = None
            in_list = True
            continue

        # Regular paragraph
        if current_para is None or in_list:
            current_para = doc.add_paragraph()
            current_para.paragraph_format.left_indent = Inches(0.25)
            in_list = False
        else:
            current_para.add_run(' ')

        _add_inline_formatting(current_para, stripped)


def _add_inline_formatting(paragraph, text: str):
    """Add text with inline markdown formatting (**bold**, *italic*)"""
    # Pattern to match **bold** and *italic*
    pattern = r'(\*\*.*?\*\*|\*.*?\*)'
    parts = re.split(pattern, text)

    for part in parts:
        if not part:
            continue

        if part.startswith('**') and part.endswith('**'):
            # Bold
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        elif part.startswith('*') and part.endswith('*'):
            # Italic
            run = paragraph.add_run(part[1:-1])
            run.italic = True
        else:
            paragraph.add_run(part)
