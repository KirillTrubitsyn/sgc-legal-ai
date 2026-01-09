"""
DOCX generator service for exporting AI responses
Стиль: Аналитическая справка (корпоративный юридический документ)
"""
import io
import re
import os
from datetime import datetime
from typing import Optional, List, Tuple
from docx import Document
from docx.shared import Pt, Cm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH


# Путь к логотипу
LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'static', 'logo.png')


def create_response_docx(
    question: str,
    answer: str,
    model: Optional[str] = None,
    created_at: Optional[datetime] = None
) -> bytes:
    """
    Create a DOCX document in analytical brief style
    """
    doc = Document()

    # Set up page margins (left 3cm, others 2cm)
    for section in doc.sections:
        section.left_margin = Cm(3)
        section.right_margin = Cm(2)
        section.top_margin = Cm(1.5)
        section.bottom_margin = Cm(1.5)

    # Set up styles
    _setup_styles(doc)

    # Header with logo
    if os.path.exists(LOGO_PATH):
        header_para = doc.add_paragraph()
        header_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = header_para.add_run()
        run.add_picture(LOGO_PATH, width=Inches(0.6))
        header_para.paragraph_format.space_after = Pt(4)

    # Main title - "АНАЛИТИЧЕСКАЯ СПРАВКА"
    title = doc.add_paragraph()
    title_run = title.add_run("АНАЛИТИЧЕСКАЯ СПРАВКА")
    title_run.bold = True
    title_run.font.size = Pt(14)
    title_run.font.name = 'Times New Roman'
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(2)
    title.paragraph_format.space_before = Pt(0)

    # Subtitle - topic from question
    subject = _extract_subject(question)
    subtitle = doc.add_paragraph()
    subtitle_run = subtitle.add_run(f"О {subject}")
    subtitle_run.font.size = Pt(11)
    subtitle_run.font.name = 'Times New Roman'
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(6)
    subtitle.paragraph_format.space_before = Pt(0)

    # Extract sources from text and clean answer
    clean_answer, sources = _extract_sources(answer)

    # Main content - parsed answer
    _add_formatted_text(doc, clean_answer)

    # Sources section if any
    if sources:
        _add_sources_section(doc, sources)

    # Footer
    _add_footer(doc, model, created_at)

    # Save to bytes
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    return buffer.getvalue()


def _extract_sources(text: str) -> Tuple[str, List[str]]:
    """
    Extract [N] references from text and return clean text + list of sources.
    """
    sources = []

    # Find all [N] or [N][M] patterns and surrounding context
    # Pattern to find source indicators like [1], [2][3], etc.
    source_pattern = r'\[(\d+)\]'

    # Find unique source numbers
    found_numbers = set(re.findall(source_pattern, text))

    # Remove [N] patterns from text
    clean_text = re.sub(r'\s*\[\d+\](?:\[\d+\])*', '', text)

    # Clean up multiple spaces
    clean_text = re.sub(r'  +', ' ', clean_text)

    # Generate placeholder sources (since actual URLs aren't in the text)
    for num in sorted(found_numbers, key=int):
        sources.append(f"[{num}] Источник из результатов поиска Perplexity")

    return clean_text, sources


def _add_sources_section(doc: Document, sources: List[str]):
    """Add sources section at the end"""
    # Section header
    doc.add_paragraph()
    header = doc.add_paragraph()
    header_run = header.add_run("Источники")
    header_run.bold = True
    header_run.font.size = Pt(11)
    header_run.font.name = 'Times New Roman'
    header.paragraph_format.space_before = Pt(8)
    header.paragraph_format.space_after = Pt(4)

    # List sources
    for source in sources:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.left_indent = Cm(0.5)
        run = p.add_run(source)
        run.font.size = Pt(9)
        run.font.name = 'Times New Roman'
        run.italic = True


def _add_footer(doc: Document, model: Optional[str], created_at: Optional[datetime]):
    """Add footer with date and disclaimer"""
    doc.add_paragraph()

    # Separator
    separator = doc.add_paragraph()
    sep_run = separator.add_run("─" * 50)
    sep_run.font.size = Pt(8)
    separator.alignment = WD_ALIGN_PARAGRAPH.CENTER
    separator.paragraph_format.space_after = Pt(4)
    separator.paragraph_format.space_before = Pt(4)

    # Date and model
    if created_at:
        date_str = created_at.strftime("%d.%m.%Y")
    else:
        date_str = datetime.now().strftime("%d.%m.%Y")

    meta_para = doc.add_paragraph()
    meta_text = f"Дата: {date_str}"
    if model:
        meta_text += f" | {_format_model_name(model)}"
    meta_run = meta_para.add_run(meta_text)
    meta_run.font.size = Pt(9)
    meta_run.font.name = 'Times New Roman'
    meta_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    meta_para.paragraph_format.space_after = Pt(2)

    # Disclaimer
    disclaimer = doc.add_paragraph()
    disclaimer_run = disclaimer.add_run(
        "Документ подготовлен SGC Legal AI. Носит информационно-справочный характер."
    )
    disclaimer_run.font.size = Pt(8)
    disclaimer_run.font.name = 'Times New Roman'
    disclaimer_run.italic = True
    disclaimer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    disclaimer.paragraph_format.space_before = Pt(0)


def _extract_subject(question: str) -> str:
    """Extract subject from question for subtitle"""
    subject = question.strip()
    subject = re.sub(r'^(как|что|какие|каковы|почему|зачем|где|когда|кто)\s+', '', subject, flags=re.IGNORECASE)
    subject = subject.rstrip('?').strip()

    if len(subject) > 80:
        subject = subject[:77] + "..."

    if subject:
        subject = subject[0].lower() + subject[1:]

    return subject


def _format_model_name(model: str) -> str:
    """Format model ID to readable name"""
    model_names = {
        "anthropic/claude-opus-4.5": "Claude Opus 4.5",
        "anthropic/claude-sonnet-4": "Claude Sonnet 4",
        "openai/gpt-5.2": "GPT 5.2",
        "openai/gpt-4o": "GPT 4o",
        "google/gemini-3-pro-preview": "Gemini 3 Pro",
        "perplexity/sonar-pro-search": "Perplexity Sonar"
    }
    return model_names.get(model, model.split("/")[-1])


def _setup_styles(doc: Document):
    """Set up document styles"""
    style = doc.styles['Normal']
    style.font.name = 'Times New Roman'
    style.font.size = Pt(11)
    style.paragraph_format.line_spacing = 1.15
    style.paragraph_format.space_after = Pt(4)


def _add_formatted_text(doc: Document, text: str):
    """Add text with formatting"""
    lines = text.split('\n')
    current_para = None
    in_list = False

    for line in lines:
        stripped = line.strip()

        if not stripped:
            current_para = None
            in_list = False
            continue

        # Section headers (N. Title or N.N. Title)
        section_match = re.match(r'^(\d+(?:\.\d+)?)\.\s+([А-ЯA-Z].*)$', stripped)
        if section_match and len(stripped) < 100:
            num, title = section_match.groups()
            p = doc.add_paragraph()
            # Меньше отступы для подразделов
            if '.' in num:
                p.paragraph_format.space_before = Pt(6)
                p.paragraph_format.space_after = Pt(2)
                run = p.add_run(stripped)
                run.bold = True
                run.font.size = Pt(11)
            else:
                p.paragraph_format.space_before = Pt(8)
                p.paragraph_format.space_after = Pt(3)
                run = p.add_run(stripped)
                run.bold = True
                run.font.size = Pt(12)
            run.font.name = 'Times New Roman'
            current_para = None
            in_list = False
            continue

        # Markdown headers
        if stripped.startswith('### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(stripped[4:])
            run.bold = True
            run.font.size = Pt(11)
            run.font.name = 'Times New Roman'
            current_para = None
            continue
        elif stripped.startswith('## '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(stripped[3:])
            run.bold = True
            run.font.size = Pt(11)
            run.font.name = 'Times New Roman'
            current_para = None
            continue
        elif stripped.startswith('# '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            run = p.add_run(stripped[2:])
            run.bold = True
            run.font.size = Pt(12)
            run.font.name = 'Times New Roman'
            current_para = None
            continue

        # Bullet lists
        if stripped.startswith(('- ', '• ', '* ')):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.7)
            p.paragraph_format.first_line_indent = Cm(-0.4)
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.space_before = Pt(1)
            bullet_run = p.add_run("• ")
            bullet_run.font.name = 'Times New Roman'
            bullet_run.font.size = Pt(11)
            _add_inline_formatting(p, stripped[2:])
            current_para = None
            in_list = True
            continue

        # Regular paragraph
        if current_para is None or in_list:
            current_para = doc.add_paragraph()
            current_para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            current_para.paragraph_format.first_line_indent = Cm(1)
            current_para.paragraph_format.space_after = Pt(3)
            current_para.paragraph_format.space_before = Pt(0)
            in_list = False
        else:
            current_para.add_run(' ')

        _add_inline_formatting(current_para, stripped)


def _add_inline_formatting(paragraph, text: str):
    """Add text with inline markdown formatting"""
    pattern = r'(\*\*.*?\*\*|\*[^*]+?\*)'
    parts = re.split(pattern, text)

    for part in parts:
        if not part:
            continue

        if part.startswith('**') and part.endswith('**'):
            run = paragraph.add_run(part[2:-2])
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)
        elif part.startswith('*') and part.endswith('*') and len(part) > 2:
            run = paragraph.add_run(part[1:-1])
            run.italic = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)
        else:
            run = paragraph.add_run(part)
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)
