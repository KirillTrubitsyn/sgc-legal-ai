"""
DOCX generator service for exporting AI responses
Стиль: Аналитическая справка (корпоративный юридический документ)
"""
import io
import re
from datetime import datetime
from typing import Optional
from docx import Document
from docx.shared import Pt, Cm, Twips
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


def create_response_docx(
    question: str,
    answer: str,
    model: Optional[str] = None,
    created_at: Optional[datetime] = None
) -> bytes:
    """
    Create a DOCX document in analytical brief style

    Args:
        question: User's question (used as subject)
        answer: AI response
        model: Model name used
        created_at: Response creation time

    Returns:
        DOCX file as bytes
    """
    doc = Document()

    # Set up page margins (left 3cm, others 2cm)
    for section in doc.sections:
        section.left_margin = Cm(3)
        section.right_margin = Cm(2)
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)

    # Set up styles
    _setup_styles(doc)

    # Main title - "АНАЛИТИЧЕСКАЯ СПРАВКА"
    title = doc.add_paragraph()
    title_run = title.add_run("АНАЛИТИЧЕСКАЯ СПРАВКА")
    title_run.bold = True
    title_run.font.size = Pt(16)
    title_run.font.name = 'Times New Roman'
    title._element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(6)

    # Subtitle - topic from question (truncated if too long)
    subject = _extract_subject(question)
    subtitle = doc.add_paragraph()
    subtitle_run = subtitle.add_run(f"О {subject}")
    subtitle_run.font.size = Pt(12)
    subtitle_run.font.name = 'Times New Roman'
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(12)

    # Model info (optional, small text)
    if model:
        meta = doc.add_paragraph()
        meta_run = meta.add_run(f"(подготовлено с использованием {_format_model_name(model)})")
        meta_run.font.size = Pt(9)
        meta_run.font.name = 'Times New Roman'
        meta_run.italic = True
        meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
        meta.paragraph_format.space_after = Pt(18)

    # Separator line
    doc.add_paragraph()

    # Main content - parsed answer
    _add_formatted_text(doc, answer)

    # Footer with date
    doc.add_paragraph()  # Spacer

    # Separator
    separator = doc.add_paragraph()
    sep_run = separator.add_run("─" * 40)
    sep_run.font.size = Pt(10)
    separator.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Date
    if created_at:
        date_str = created_at.strftime("%d.%m.%Y")
    else:
        date_str = datetime.now().strftime("%d.%m.%Y")

    date_para = doc.add_paragraph()
    date_run = date_para.add_run(f"Дата подготовки: {date_str}")
    date_run.font.size = Pt(11)
    date_run.font.name = 'Times New Roman'
    date_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    # Disclaimer
    disclaimer = doc.add_paragraph()
    disclaimer_run = disclaimer.add_run(
        "Настоящий документ подготовлен с использованием SGC Legal AI и носит "
        "информационно-справочный характер. Не является официальной юридической консультацией."
    )
    disclaimer_run.font.size = Pt(9)
    disclaimer_run.font.name = 'Times New Roman'
    disclaimer_run.italic = True
    disclaimer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    disclaimer.paragraph_format.space_before = Pt(12)

    # Save to bytes
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    return buffer.getvalue()


def _extract_subject(question: str) -> str:
    """Extract subject from question for subtitle"""
    # Clean up and truncate question for use as subject
    subject = question.strip()

    # Remove question marks and common prefixes
    subject = re.sub(r'^(как|что|какие|каковы|почему|зачем|где|когда|кто)\s+', '', subject, flags=re.IGNORECASE)
    subject = subject.rstrip('?').strip()

    # Truncate if too long (max 100 chars)
    if len(subject) > 100:
        subject = subject[:97] + "..."

    # Lowercase first letter for "О [subject]" format
    if subject:
        subject = subject[0].lower() + subject[1:]

    return subject


def _format_model_name(model: str) -> str:
    """Format model ID to readable name"""
    model_names = {
        "anthropic/claude-opus-4.5": "Claude Opus 4.5",
        "anthropic/claude-sonnet-4": "Claude Sonnet 4",
        "openai/gpt-5.2": "ChatGPT 5.2",
        "openai/gpt-4o": "ChatGPT 4o",
        "google/gemini-3-pro-preview": "Gemini 3.0 Pro",
        "perplexity/sonar-pro-search": "Perplexity Sonar Pro"
    }
    return model_names.get(model, model.split("/")[-1])


def _setup_styles(doc: Document):
    """Set up document styles for analytical brief"""
    styles = doc.styles

    # Normal style - Times New Roman 12pt
    style = styles['Normal']
    style.font.name = 'Times New Roman'
    style.font.size = Pt(12)
    style._element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')

    # Paragraph formatting
    style.paragraph_format.line_spacing = 1.15
    style.paragraph_format.space_after = Pt(8)


def _add_formatted_text(doc: Document, text: str):
    """
    Add text with formatting for analytical brief style
    Handles: **bold**, *italic*, headers, numbered lists
    """
    lines = text.split('\n')
    current_para = None
    in_list = False
    list_counter = 0

    for line in lines:
        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            if current_para:
                current_para = None
            doc.add_paragraph()
            in_list = False
            list_counter = 0
            continue

        # Section headers (1. 2. 3. at start of line followed by title-like text)
        section_match = re.match(r'^(\d+)\.\s+([А-ЯA-Z][^.]*?)(?:\s*[-—:]\s*|$)', stripped)
        if section_match and len(stripped) < 80:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(stripped)
            run.bold = True
            run.font.size = Pt(14)
            run.font.name = 'Times New Roman'
            current_para = None
            in_list = False
            continue

        # Markdown-style headers (# ## ###)
        if stripped.startswith('### '):
            p = doc.add_paragraph()
            run = p.add_run(stripped[4:])
            run.bold = True
            run.font.size = Pt(12)
            run.font.name = 'Times New Roman'
            current_para = None
            in_list = False
            continue
        elif stripped.startswith('## '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            run = p.add_run(stripped[3:])
            run.bold = True
            run.font.size = Pt(13)
            run.font.name = 'Times New Roman'
            current_para = None
            in_list = False
            continue
        elif stripped.startswith('# '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            run = p.add_run(stripped[2:])
            run.bold = True
            run.font.size = Pt(14)
            run.font.name = 'Times New Roman'
            current_para = None
            in_list = False
            continue

        # Bullet lists
        if stripped.startswith('- ') or stripped.startswith('• ') or stripped.startswith('* '):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(1)
            p.paragraph_format.first_line_indent = Cm(-0.5)
            # Add bullet manually
            bullet_run = p.add_run("• ")
            bullet_run.font.name = 'Times New Roman'
            bullet_run.font.size = Pt(12)
            _add_inline_formatting(p, stripped[2:])
            current_para = None
            in_list = True
            continue

        # Numbered lists (continuation)
        num_match = re.match(r'^(\d+)\.\s+(.+)$', stripped)
        if num_match and len(stripped) < 200:
            num, content = num_match.groups()
            # Check if this looks like a list item (not a section header)
            if not re.match(r'^[А-ЯA-Z][^.]*[-—:]', content):
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Cm(1)
                p.paragraph_format.first_line_indent = Cm(-0.5)
                num_run = p.add_run(f"{num}. ")
                num_run.font.name = 'Times New Roman'
                num_run.font.size = Pt(12)
                _add_inline_formatting(p, content)
                current_para = None
                in_list = True
                continue

        # Regular paragraph
        if current_para is None or in_list:
            current_para = doc.add_paragraph()
            current_para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            current_para.paragraph_format.first_line_indent = Cm(1.25)
            in_list = False
        else:
            current_para.add_run(' ')

        _add_inline_formatting(current_para, stripped)


def _add_inline_formatting(paragraph, text: str):
    """Add text with inline markdown formatting (**bold**, *italic*)"""
    # Pattern to match **bold** and *italic*
    pattern = r'(\*\*.*?\*\*|\*[^*]+?\*)'
    parts = re.split(pattern, text)

    for part in parts:
        if not part:
            continue

        if part.startswith('**') and part.endswith('**'):
            # Bold - key conclusions
            run = paragraph.add_run(part[2:-2])
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)
        elif part.startswith('*') and part.endswith('*') and len(part) > 2:
            # Italic - citations
            run = paragraph.add_run(part[1:-1])
            run.italic = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)
        else:
            run = paragraph.add_run(part)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)
