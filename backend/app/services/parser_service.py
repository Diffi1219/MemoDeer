"""文档解析服务 — 从各种格式文件中提取文本"""
import os
from typing import Optional
from app.utils.exceptions import ProcessingError


# 支持的文件类型
SUPPORTED_TYPES = {
    ".pdf": "pdf",
    ".txt": "txt",
    ".md": "md",
    ".docx": "docx",
    ".doc": "docx",
}

# 文件大小上限 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024


def get_file_type(filename: str) -> Optional[str]:
    """根据扩展名判断文件类型"""
    ext = os.path.splitext(filename)[1].lower()
    return SUPPORTED_TYPES.get(ext)


def extract_text(filepath: str, file_type: str) -> str:
    """根据文件类型提取文本"""
    if file_type == "txt" or file_type == "md":
        return _extract_txt(filepath)
    elif file_type == "pdf":
        return _extract_pdf(filepath)
    elif file_type == "docx":
        return _extract_docx(filepath)
    else:
        raise ProcessingError(f"不支持的文件类型: {file_type}")


def _extract_txt(filepath: str) -> str:
    """提取TXT/Markdown文本"""
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _extract_pdf(filepath: str) -> str:
    """提取文字型PDF文本（使用 PyMuPDF）"""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise ProcessingError("PDF解析依赖未安装，请运行: pip install PyMuPDF")

    doc = fitz.open(filepath)
    texts = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            texts.append(text)
    doc.close()

    result = "\n\n".join(texts)
    if not result.strip():
        raise ProcessingError(
            "PDF中未检测到文本内容。可能为扫描版PDF（图片型），当前版本暂不支持OCR识别。"
        )
    return result


def _extract_docx(filepath: str) -> str:
    """提取Word文档文本"""
    try:
        from docx import Document
    except ImportError:
        raise ProcessingError("DOCX解析依赖未安装，请运行: pip install python-docx")

    doc = Document(filepath)
    texts = []
    for para in doc.paragraphs:
        if para.text.strip():
            texts.append(para.text)
    return "\n\n".join(texts)
