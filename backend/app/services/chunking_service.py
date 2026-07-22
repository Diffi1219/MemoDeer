"""文本分块服务 — 语义感知的文本切分"""
import re
from typing import List
from app.config import settings


def split_text(text: str, chunk_size: int = None, overlap: int = None) -> List[str]:
    """将长文本切分为有重叠的语义块

    策略：
    1. 先按段落（双换行）切分
    2. 短段落合并到 ~chunk_size 字符
    3. 长段落按句子边界切分
    4. 块与块之间有 overlap 重叠
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP

    # Step 1: 按段落切分
    paragraphs = _split_paragraphs(text)
    if not paragraphs:
        return []

    # Step 2: 合并短段落，切分长段落
    chunks = []
    current = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # 如果一段本身就超过 chunk_size，需要再切分
        if len(para) > chunk_size * 1.5:
            # 先把 current 积累的存入
            if current:
                chunks.append(current.strip())
                current = ""
            # 按句子切分长段落
            sub_chunks = _split_long_paragraph(para, chunk_size)
            chunks.extend(sub_chunks)
        elif len(current) + len(para) + 1 > chunk_size:
            # current 加上新段落会超出限制，先存 current
            chunks.append(current.strip())
            current = para
        else:
            # 合并到 current
            if current:
                current += "\n\n" + para
            else:
                current = para

    if current.strip():
        chunks.append(current.strip())

    # Step 3: 去除空块和太短的块
    chunks = [c for c in chunks if len(c) > 10]

    # Step 4: 添加重叠（在前一块末尾加 overlap 到下一块开头）
    if overlap > 0 and len(chunks) > 1:
        overlapped = []
        for i, chunk in enumerate(chunks):
            if i > 0:
                # 前一块的末尾 overlap 字符加到当前块开头
                prev = chunks[i - 1]
                overlap_text = prev[-overlap:] if len(prev) > overlap else prev
                chunk = overlap_text + "\n...\n" + chunk
            overlapped.append(chunk)
        chunks = overlapped

    return chunks


def _split_paragraphs(text: str) -> List[str]:
    """按段落切分，保留有意义的段落边界"""
    # 统一换行符
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # 按双换行切分段落
    paragraphs = re.split(r"\n\s*\n", text)
    return [p for p in paragraphs if p.strip()]


def _split_long_paragraph(text: str, chunk_size: int) -> List[str]:
    """将超长段落按句子边界切分"""
    # 按句号、问号、感叹号等切分
    sentences = re.split(r"(?<=[。！？.!?\n])\s*", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) + 1 > chunk_size and current:
            chunks.append(current.strip())
            current = sent
        else:
            current = (current + " " + sent).strip() if current else sent

    if current.strip():
        chunks.append(current.strip())

    return chunks


def estimate_tokens(text: str) -> int:
    """粗略估算 token 数（中文按字符数，英文按 4 字符/token）"""
    chinese_chars = len(re.findall(r"[一-鿿]", text))
    other_chars = len(text) - chinese_chars
    return chinese_chars + other_chars // 4
