"""RAG 管线服务 — 编排文档处理、检索、生成完整流程"""
import json
import uuid
from typing import List, Optional, AsyncIterator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.core.models import Document, Chunk, ChatSession, ChatMessage, KnowledgePoint
from app.services.parser_service import extract_text
from app.services.chunking_service import split_text, estimate_tokens
from app.services.embedding_service import embedding_service
from app.services.vector_store import vector_store
from app.services.llm_service import llm_service

# RAG 距离阈值：BGE 余弦距离 ∈ [0, 2]，越小越相关
# 0.5 以下 = 高相关，0.5~0.8 = 中等相关，> 0.8 = 弱相关
RAG_DISTANCE_THRESHOLD = 0.85


async def process_document(db: AsyncSession, document: Document):
    """处理上传的文档：解析 → AI格式化 → 分块 → 向量化 → 存储"""
    try:
        # 更新状态为处理中
        document.status = "processing"
        await db.flush()

        # Step 1: 提取文本
        text = extract_text(document.filepath, document.file_type)
        if not text.strip():
            raise ValueError("文档内容为空")

        # Step 1.5: AI 格式化 — 将原始文本转为规范 Markdown
        print(f"[DocFormat] 开始 AI 格式化 {document.filename} ({len(text)} 字符)...")
        text = await _reformat_text_to_markdown(text)
        print(f"[DocFormat] 格式化完成 {document.filename} ({len(text)} 字符)")

        # Step 2: 文本分块（短内容直接作为单个 chunk）
        chunks_text = split_text(text)
        if not chunks_text and len(text.strip()) >= 2:
            chunks_text = [text.strip()]

        # Step 3: 向量化
        chunk_ids = []
        chunk_metadatas = []
        for i, ct in enumerate(chunks_text):
            cid = uuid.uuid4().hex
            chunk_ids.append(cid)
            chunk_metadatas.append({
                "document_id": document.id,
                "document_name": document.filename,
                "chunk_index": i,
                "notebook_id": document.notebook_id,
            })

        embeddings = embedding_service.embed(chunks_text)

        # Step 4: 存入 ChromaDB
        vector_store.add_chunks(
            notebook_id=document.notebook_id,
            chunk_ids=chunk_ids,
            texts=chunks_text,
            embeddings=embeddings,
            metadatas=chunk_metadatas,
        )

        # Step 5: 存入 SQLite chunks 表
        for i, (cid, ct) in enumerate(zip(chunk_ids, chunks_text)):
            chunk = Chunk(
                id=cid,
                document_id=document.id,
                content=ct,
                chunk_index=i,
                token_count=estimate_tokens(ct),
            )
            db.add(chunk)

        document.chunk_count = len(chunks_text)
        document.status = "completed"
        await db.flush()

    except Exception as e:
        document.status = "error"
        document.error_msg = str(e)
        await db.flush()


async def _reformat_text_to_markdown(text: str) -> str:
    """使用 Flash LLM 将原始提取文本转换为结构良好的 Markdown

    处理策略：
    - 太短的文本（<50字符）跳过格式化
    - 中等文本（≤8000字符）单次 LLM 调用
    - 长文本分批处理，每批 ~8000 字符
    - 总上限 50000 字符，超出部分截断
    - LLM 调用失败时降级为原始文本
    """
    if not text or len(text.strip()) < 50:
        return text

    MAX_CHARS = 50000
    BATCH_SIZE = 8000

    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS] + "\n\n*(内容过长，后续部分已截断)*"

    if len(text) <= BATCH_SIZE:
        return await _reformat_batch(text)

    # 分批处理
    batches = []
    start = 0
    batch_num = 0
    while start < len(text):
        batch_num += 1
        end = min(start + BATCH_SIZE, len(text))
        batch_text = text[start:end]
        print(f"[DocFormat]   处理第 {batch_num} 批 ({len(batch_text)} 字符)...")
        reformatted = await _reformat_batch(batch_text)
        batches.append(reformatted)
        start = end

    return "\n\n---\n\n".join(batches)


async def _reformat_batch(text: str) -> str:
    """格式化单批文本为 Obsidian Flavored Markdown"""
    system_prompt = """你是一个 Obsidian 知识库格式化专家。请将以下原始文本转换为 Obsidian Flavored Markdown 格式。

要求：
1. 添加 YAML frontmatter（至少包含 title 和 tags）：
   ---
   title: 文档标题
   tags:
     - 相关标签1
     - 相关标签2
   ---
2. 根据内容结构添加标题层级（# ## ###），层次分明
3. 使用 [[wikilink]] 链接文档中提到的核心概念、术语（如[[光合作用]]、[[牛顿定律]]）
4. 使用 > [!note] / > [!warning] / > [!tip] / > [!important] 等 callout 突出重要内容
5. 用 ==高亮== 标记关键术语和定义
6. 将列表格式化为 Markdown 列表（- 或 1.）
7. 表格数据使用 Markdown 表格
8. 保持原文信息不丢失、不篡改
9. 代码或命令用 `行内代码` 或 ```代码块```
10. 修正 OCR/提取错误
11. 段落间保持适当空行
12. 只输出格式化后的 Markdown，不要添加额外说明"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请将以下文本格式化为 Obsidian Markdown：\n\n{text}"},
    ]

    try:
        result = await llm_service.flash.chat(
            messages, stream=False, temperature=0.3, max_tokens=4096
        )
        return result.strip() if result else text
    except Exception as e:
        print(f"[DocFormat] LLM 格式化失败: {e}，使用原始文本")
        return text


async def _keyword_search_chunks(
    db: AsyncSession, notebook_id: str, query: str, top_k: int = 8
) -> List[dict]:
    """关键词匹配搜索：在 chunks 表中用 LIKE 匹配查询中的关键词"""
    from app.core.models import Chunk, Document
    # 提取关键词（长度 >= 2 的中文/英文词）
    # 对于中文：拆分为每 2-4 个字的子串用于模糊匹配
    import re
    clean = re.sub(r'[\s,，。！？、]+', '', query)  # 去空格标点
    keywords = []
    # 原查询整体作为一个关键词
    if len(clean) >= 2:
        keywords.append(clean)
    # 中文子串（2-4字滑动窗口）
    if len(clean) >= 2:
        for win in (2, 3, 4):
            for i in range(len(clean) - win + 1):
                sub = clean[i:i + win]
                if sub not in keywords:
                    keywords.append(sub)
    # 限制关键词数量
    keywords = keywords[:15]
    if not keywords:
        return []

    # 为每个关键词构建 LIKE 条件
    conditions = []
    for kw in keywords[:10]:  # 最多 10 个条件
        conditions.append(Chunk.content.contains(kw))

    if not conditions:
        return []

    from sqlalchemy import or_
    result = await db.execute(
        select(Chunk, Document.filename)
        .join(Document, Chunk.document_id == Document.id)
        .where(
            Document.notebook_id == notebook_id,
            Document.status == "completed",
            or_(*conditions),
        )
        .limit(top_k * 3)
    )
    rows = result.all()

    # 计算关键词命中得分
    keyword_results = []
    for chunk, doc_name in rows:
        score = 0.0
        content_lower = chunk.content.lower()
        for kw in keywords:
            count = content_lower.count(kw.lower())
            if count > 0:
                # 长关键词命中权重更高
                weight = min(len(kw) / 2, 3)
                score += 0.1 * weight * min(count, 5)
        score = min(score, 0.85)  # 最大分 0.85 → distance = 0.15
        if score > 0.05:
            keyword_results.append({
                "id": chunk.id,
                "content": chunk.content,
                "distance": round(1.0 - score, 4),  # 分数转距离：高命中=低距离
                "score": score,
                "metadata": {
                    "document_id": chunk.document_id,
                    "document_name": doc_name,
                    "chunk_index": chunk.chunk_index,
                    "notebook_id": notebook_id,
                    "source": "keyword",
                },
            })
    return sorted(keyword_results, key=lambda x: -x["score"])


def _merge_hybrid_results(
    vector_results: List[dict],
    keyword_results: List[dict],
    top_k: int,
) -> List[dict]:
    """合并向量和关键词搜索结果，去重并重排序"""
    seen_ids = set()
    merged = []

    # 向量结果：score = 1 - distance
    for r in vector_results:
        r["score"] = 1.0 - r.get("distance", 0.0)
        if r.get("metadata") is None:
            r["metadata"] = {}
        r["metadata"]["source"] = "vector"
        seen_ids.add(r.get("id", ""))
        merged.append(r)

    # 关键词结果（去重）
    for r in keyword_results:
        if r.get("id", "") not in seen_ids:
            if r.get("metadata") is None:
                r["metadata"] = {}
            r["metadata"]["source"] = "keyword"
            seen_ids.add(r.get("id", ""))
            merged.append(r)

    # 按 score 降序排列，取 top_k
    merged.sort(key=lambda x: -x["score"])
    return merged[:top_k]


async def search_notebook(db: AsyncSession, notebook_id: str, query: str, top_k: int = 5) -> List[dict]:
    """混合搜索：向量匹配 + 关键词匹配"""
    query_embedding = embedding_service.embed_query(query)
    vector_results = vector_store.search(notebook_id, query_embedding, top_k=top_k * 2)
    keyword_results = await _keyword_search_chunks(db, notebook_id, query, top_k)
    merged = _merge_hybrid_results(vector_results, keyword_results, top_k)
    # 按距离阈值过滤，只保留真正相关的结果
    merged = [c for c in merged if c.get("distance", 1.0) < RAG_DISTANCE_THRESHOLD]
    return merged[:top_k]


async def search_all_notebooks(
    db: AsyncSession,
    user_id: str,
    query: str,
    top_k: int = 5,
) -> List[dict]:
    """跨所有笔记本全局搜索（语义向量 + 关键词混合），结果按最佳匹配排序"""
    from app.core.models import Notebook

    notebook_result = await db.execute(
        select(Notebook).where(Notebook.user_id == user_id)
    )
    notebooks = notebook_result.scalars().all()

    if not notebooks:
        return []

    query_embedding = embedding_service.embed_query(query)

    all_results = []
    for nb in notebooks:
        # 混合检索：向量搜索 + 关键词搜索
        try:
            vector_chunks = vector_store.search(nb.id, query_embedding, top_k=top_k * 2)
        except Exception:
            vector_chunks = []

        keyword_chunks = await _keyword_search_chunks(db, nb.id, query, top_k)
        chunks = _merge_hybrid_results(vector_chunks, keyword_chunks, top_k)

        # 按距离阈值过滤（只保留确实相关的结果）
        chunks = [c for c in chunks if c.get("distance", 1.0) < RAG_DISTANCE_THRESHOLD]

        if not chunks:
            continue

        formatted = []
        for c in chunks:
            meta = c.get("metadata", {})
            doc_name = meta.get("document_name", "未知文档")
            doc_id = meta.get("document_id", "")
            formatted.append({
                "chunk_id": c.get("id", ""),
                "document_id": doc_id,
                "document_name": doc_name,
                "content": c.get("content", "")[:500],
                "score": round(1 - c.get("distance", 0), 4),
            })

        all_results.append({
            "notebook_id": nb.id,
            "notebook_title": nb.title,
            "match_count": len(formatted),
            "chunks": formatted,
        })

    # 按最佳匹配分降序排列
    all_results.sort(
        key=lambda x: max(c["score"] for c in x["chunks"]) if x["chunks"] else 0,
        reverse=True,
    )
    return all_results


async def retrieve_context(notebook_id: str, query: str, top_k: int = None) -> List[dict]:
    """混合检索上下文：向量匹配 + 关键词匹配（用于问答）"""
    if top_k is None:
        top_k = settings.RETRIEVAL_TOP_K
    query_embedding = embedding_service.embed_query(query)
    vector_results = vector_store.search(notebook_id, query_embedding, top_k=top_k * 2)

    # 需要 db session 来做关键词搜索
    from app.core.database import async_session
    async with async_session() as db:
        keyword_results = await _keyword_search_chunks(db, notebook_id, query, top_k)

    return _merge_hybrid_results(vector_results, keyword_results, top_k)


def build_qa_prompt(question: str, context_chunks: List[dict]) -> List[dict]:
    """构建带上下文的问答 prompt — 优先基于上下文，上下文不足时结合通用知识"""
    # 构建上下文文本
    context_parts = []
    for i, chunk in enumerate(context_chunks):
        doc_name = chunk.get("metadata", {}).get("document_name", "未知文档")
        context_parts.append(f"[{i + 1}] (来源: {doc_name})\n{chunk['content']}")

    context_text = "\n\n---\n\n".join(context_parts)

    system_prompt = """你是一个 AI 学习助手 MemoDeer。请优先基于提供的上下文回答用户的问题，当上下文不足时结合你的通用知识给出完整回答。

⚠️═══════════════════════════════════════════════════════════⚠️
【算法可视化】当用户想了解某个具体算法的运行流程/执行过程/演示/动画/可视化（例如问「冒泡排序的代码和流程」）时，
在回答末尾附上一个 ```algo-viz 代码块。仅列举算法、只解释概念、只对比优劣时不要输出。
⚠️═══════════════════════════════════════════════════════════⚠️
""" + ALGO_VIS_PROMPT + """

规则：
1. 优先使用上下文内容回答，如果上下文里有用户要的信息，尽量详细引用
2. **基于上下文的部分，每个观点/事实后面紧跟引用标注 [1]、[2] 等**，表示该信息来自哪个文档
3. **在回答的末尾，必须添加"📚 参考文档"段落**，列出实际引用到的文档名称：
   📚 参考文档：
   - [1] 文档名称
   - [2] 文档名称
4. 如果上下文只涵盖了概念原理但缺少用户需要的具体细节（如代码示例、例题等），先基于上下文解释概念原理，再结合你的通用知识补充用户需要的具体细节，并在补充前加一句说明（如"📌 以下代码/示例基于通用知识补充"）
5. 如果上下文完全无法回答问题，明确说明"你的笔记中没有相关内容，以下基于通用知识回答"，然后给出完整回答
6. 用清晰易懂的中文回答，适合学生理解

【重要】你可以使用交互式 HTML 来呈现复杂的知识点。当需要展示图表、
表格、对比、步骤或可视化概念时，使用 ```html 代码块输出 HTML。

例如 — 概念卡片：
```html
<div class="card">
  <h3>概念名称</h3>
  <p>核心定义和解释...</p>
  <span class="tag">标签1</span><span class="tag">标签2</span>
</div>
```

例如 — 对比表格：
```html
<table>
<tr><th>对比维度</th><th>选项A</th><th>选项B</th></tr>
<tr><td>特点1</td><td>xxx</td><td>yyy</td></tr>
</table>
```

HTML 规则：
1. 每个回答使用 1-3 个 HTML 组件增强可读性
2. 可用 class：card（卡片）、tag（标签）、highlight（高亮）、step/step-num（步骤）
3. 可用 elements：table、details/summary（折叠）、列表等
4. 直接输出 ```html 代码块，不要加额外说明
5. **算法执行过程/排序动态演示不要用 HTML**，必须用 ```algo-viz JSON 输出（见顶部规则）"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"上下文资料：\n{context_text}\n\n用户问题：{question}\n\n请基于以上上下文回答，基于上下文的部分标注引用来源 [1][2] 等，上下文不足时用通用知识补充并在回答末尾列出参考文档名称。"},
    ]
    return messages


async def stream_answer(
    db: AsyncSession,
    notebook_id: str,
    session_id: str,
    question: str,
    context_chunks: List[dict],
    source: str = "rag",
) -> AsyncIterator[str]:
    """流式生成 RAG 回答（用户消息已由 chat.py 保存）"""
    messages = build_qa_prompt(question, context_chunks)

    # 发送来源事件
    yield _sse_source(source)

    # 收集完整回答
    full_answer = ""

    # 流式调用 DeepSeek V4（问答模型见 .env LLM_PRO_MODEL）
    async for token in llm_service.pro.chat_stream(messages, temperature=0.7, max_tokens=8192):
        full_answer += token
        yield _sse_token(token)

    # 提取引用信息
    citations = _extract_citations(context_chunks)

    # 保存 AI 回答
    ai_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=full_answer,
        citations=json.dumps(citations, ensure_ascii=False),
        source=source,
    )
    db.add(ai_msg)
    await db.flush()

    # 发送引用和结束信号
    yield _sse_citations(citations)
    yield _sse_done()


async def stream_answer_open(
    db: AsyncSession,
    session_id: str,
    question: str,
) -> AsyncIterator[str]:
    """开放自由问答 — 不使用 RAG 检索，Pro 模型直接回答"""
    system_prompt = (
        "你是一个 AI 学习助手 MemoDeer，由 DeepSeek 驱动。"
        "请用清晰易懂的中文回答用户的问题，适合学生理解。"
        "你可以自由运用你的知识来回答问题，包括但不限于："
        "解答学科疑问、提供学习方法建议、进行逻辑推理分析、帮助理解复杂概念。"
        "如果问题超出你的知识范围，诚实地告知用户。\n\n"
        "⚠️═══════════════════════════════════════════════════════════⚠️\n"
        "【算法可视化】当用户想了解某个具体算法的运行流程/执行过程/演示/动画/可视化（例如问「冒泡排序的代码和流程」）时，\n"
        "在回答末尾附上一个 ```algo-viz 代码块。仅列举算法、只解释概念、只对比优劣时不要输出。\n"
        "⚠️═══════════════════════════════════════════════════════════⚠️"
    ) + ALGO_VIS_PROMPT + "\n\n" + (
        "【重要】你可以使用交互式 HTML 来呈现复杂的知识点。当需要展示图表、"
        "表格、对比、步骤时，使用 ```html 代码块输出 HTML。"
        "可用样式：card（卡片）、tag（标签）、highlight（高亮）、step（步骤）、table（表格）。"
        "每次回答使用 1-3 个 HTML 组件增强可读性。"
        "算法执行过程/排序动态演示不要用 HTML，必须用 ```algo-viz JSON 输出（见顶部规则）。"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question},
    ]

    # 保存用户消息
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=question,
    )
    db.add(user_msg)
    await db.flush()

    # 用 Pro 模型流式生成
    full_answer = ""
    async for token in llm_service.pro.chat_stream(messages, temperature=0.7, max_tokens=8192):
        full_answer += token
        yield _sse_token(token)

    # 保存 AI 回答（开放模式无引用）
    ai_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=full_answer,
        citations="[]",
    )
    db.add(ai_msg)
    await db.flush()

    yield _sse_done()


async def stream_notebook_summary(
    db: AsyncSession,
    notebook_id: str,
) -> AsyncIterator[str]:
    """生成笔记本内容摘要（Flash 模型），SSE 流式输出，同时创建会话"""
    # Step 1: 查询所有已完成的文档
    docs_result = await db.execute(
        select(Document).where(
            Document.notebook_id == notebook_id,
            Document.status == "completed",
        ).order_by(Document.created_at)
    )
    documents = docs_result.scalars().all()

    if not documents:
        yield _sse_status("请先上传文档，AI 才能为你生成摘要")
        yield _sse_done()
        return

    # Step 2: 收集所有 chunk 文本
    all_chunks = []
    for doc in documents:
        chunks_result = await db.execute(
            select(Chunk).where(Chunk.document_id == doc.id).order_by(Chunk.chunk_index)
        )
        for chunk in chunks_result.scalars().all():
            all_chunks.append(f"[{doc.filename}]\n{chunk.content}")

    # Step 3: 拼接并截断
    combined = "\n\n---\n\n".join(all_chunks)
    max_chars = 40000
    if len(combined) > max_chars:
        combined = combined[:max_chars] + "\n...(内容截断)"

    # Step 4: 构建 Flash 摘要提示词
    prompt = f"""你是一个学习助手。请根据以下笔记本中的所有学习资料，生成一份约300字的中文摘要。

要求：
1. 概括笔记本涵盖的主要主题和知识点
2. 突出最重要的概念和关键内容
3. 使用清晰易懂的中文，适合学生快速了解内容
4. 严格控制在300字左右
5. 如果笔记本包含多个文档，请综合所有文档的内容
6. 直接输出摘要，不要加"摘要："等前缀

笔记本内容：
{combined}

请输出摘要："""

    messages = [{"role": "user", "content": prompt}]

    # Step 5: 创建会话并保存用户消息
    session = ChatSession(
        notebook_id=notebook_id,
        title="笔记本总结",
    )
    db.add(session)
    await db.flush()

    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content="请总结笔记本内容",
    )
    db.add(user_msg)
    await db.flush()

    # Step 6: 用 Flash 模型流式生成摘要
    full_summary = ""
    async for token in llm_service.flash.chat_stream(messages, temperature=0.5, max_tokens=1024):
        full_summary += token
        yield _sse_token(token)

    # Step 7: 保存 AI 回答
    ai_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=full_summary,
        citations="[]",
    )
    db.add(ai_msg)
    await db.flush()

    # Step 8: 发送 session_id 给前端，便于继续对话
    yield f"data: {json.dumps({'type': 'session', 'session_id': session.id})}\n\n"
    yield _sse_done()


def _extract_citations(context_chunks: List[dict]) -> List[dict]:
    """从上下文块中提取引用元数据"""
    citations = []
    for i, chunk in enumerate(context_chunks):
        citations.append({
            "index": i + 1,
            "chunk_id": chunk.get("id", ""),
            "document_id": chunk.get("metadata", {}).get("document_id", ""),
            "document_name": chunk.get("metadata", {}).get("document_name", "未知"),
            "snippet": chunk.get("content", "")[:200] + "...",
            "score": round(1 - chunk.get("distance", 0), 4),
        })
    return citations


def _sse_token(text: str) -> str:
    return f"data: {json.dumps({'type': 'token', 'data': text}, ensure_ascii=False)}\n\n"


def _sse_status(text: str) -> str:
    return f"data: {json.dumps({'type': 'status', 'text': text}, ensure_ascii=False)}\n\n"


def _sse_citations(citations: List[dict]) -> str:
    return f"data: {json.dumps({'type': 'citations', 'data': citations}, ensure_ascii=False)}\n\n"


def _sse_done() -> str:
    return f"data: {json.dumps({'type': 'done'})}\n\n"


def _sse_source(source_type: str) -> str:
    """发送回答来源事件：'rag' 或 'open'"""
    return f"data: {json.dumps({'type': 'source', 'data': source_type}, ensure_ascii=False)}\n\n"


async def stream_answer_fallback(
    db: AsyncSession,
    session_id: str,
    question: str,
) -> AsyncIterator[str]:
    """降级自由问答：RAG 无结果时使用 Pro 模型直接回答，附带声明提示"""
    system_prompt = (
        "你是一个 AI 学习助手 MemoDeer。"
        "你正在用通用知识回答用户的问题——用户的笔记中没有找到相关内容。\n"
        "请在回答开头加上一句声明（如'📌 以下回答来自通用知识，非你的个人笔记，请注意核实'），"
        "然后直接回答用户的问题，用清晰易懂的中文，适合学生理解。\n\n"
        "⚠️═══════════════════════════════════════════════════════════⚠️\n"
        "【算法可视化】当用户想了解某个具体算法的运行流程/执行过程/演示/动画/可视化（例如问「冒泡排序的代码和流程」）时，\n"
        "在回答末尾附上一个 ```algo-viz 代码块。仅列举算法、只解释概念、只对比优劣时不要输出。\n"
        "⚠️═══════════════════════════════════════════════════════════⚠️"
    ) + ALGO_VIS_PROMPT + "\n\n" + (
        "【重要】你可以使用交互式 HTML 来呈现复杂的知识点。当需要展示图表、"
        "表格、对比、步骤时，使用 ```html 代码块输出 HTML。"
        "可用样式：card（卡片）、tag（标签）、highlight（高亮）、step（步骤）、table（表格）。"
        "每次回答使用 1-3 个 HTML 组件增强可读性。"
        "算法执行过程/排序动态演示不要用 HTML，必须用 ```algo-viz JSON 输出（见顶部规则）。"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question},
    ]

    # 发送来源事件
    yield _sse_source("open")

    full_answer = ""
    async for token in llm_service.pro.chat_stream(messages, temperature=0.7, max_tokens=8192):
        full_answer += token
        yield _sse_token(token)

    ai_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=full_answer,
        citations="[]",
        source="open",
    )
    db.add(ai_msg)
    await db.flush()

    yield _sse_done()


async def create_note_from_text(
    db: AsyncSession,
    notebook_id: str,
    content: str,
    title: str = None,
) -> dict:
    """将用户编辑后的聊天回答保存为笔记文档"""
    import re, os
    doc_id = uuid.uuid4().hex
    raw_title = (title or content[:30]).strip()
    # 清理文件名中的非法字符：去除 Markdown 标题标记、换行符和文件系统非法字符
    raw_title = re.sub(r'^#+\s*', '', raw_title)  # 去除 Markdown 标题标记
    raw_title = raw_title.replace('\n', ' ').replace('\r', ' ')
    raw_title = re.sub(r'[\\/:*?"<>|]', '-', raw_title)  # 替换 Windows 非法文件名字符
    raw_title = re.sub(r'\s+', ' ', raw_title).strip()
    if not raw_title:
        raw_title = "笔记"
    safe_title = raw_title[:50] + " (来自对话)"

    document = Document(
        id=doc_id,
        notebook_id=notebook_id,
        filename=safe_title + ".md",
        filepath="",
        file_type="md",
        file_size=len(content.encode("utf-8")),
        status="completed",
        chunk_count=1,
    )
    db.add(document)
    await db.flush()

    # 保存文件到磁盘
    import os
    from app.config import settings
    upload_dir = os.path.join(settings.UPLOAD_DIR, notebook_id, doc_id)
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, safe_title + ".md")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    document.filepath = filepath
    await db.flush()

    chunk_id = uuid.uuid4().hex
    chunk = Chunk(
        id=chunk_id,
        document_id=doc_id,
        content=content,
        chunk_index=0,
        token_count=estimate_tokens(content),
    )
    db.add(chunk)
    await db.flush()

    try:
        embeddings = embedding_service.embed([content])
        vector_store.add_chunks(
            notebook_id=notebook_id,
            chunk_ids=[chunk_id],
            texts=[content],
            embeddings=embeddings,
            metadatas=[{
                "document_id": doc_id,
                "document_name": safe_title,
                "chunk_index": 0,
                "notebook_id": notebook_id,
            }],
        )
    except Exception as e:
        print(f"[Note] 笔记嵌入失败 {doc_id}: {e}")

    return {
        "document_id": doc_id,
        "notebook_id": notebook_id,
        "filename": safe_title,
        "status": "completed",
    }


# ── 算法可视化提示词（三处问答 prompt 共用）──
ALGO_VIS_PROMPT = """

**触发条件**：只有冒泡排序（bubble-sort）和选择排序（selection-sort）这两种算法需要输出 algo-viz 可视化。当用户想了解这两种算法的「运行流程 / 执行过程 / 演示 / 动画 / 可视化 / 一步步」时，在回答末尾输出 algo-viz 代码块。
**其他任何算法**（快速排序、归并排序、堆排序、插入排序、希尔排序、二分查找、线性查找、BFS/DFS、图算法、动态规划等）**一律不要**输出 algo-viz，只输出文字说明和代码。

**输出格式**：在回答末尾追加 ```algo-viz 代码块，**只包含 algorithm 和 array 两个字段**，**绝对不要**自己写 steps（完整步骤由前端自动计算）：
```json
{
  "algorithm": "bubble-sort",
  "array": [64, 34, 25, 12, 22, 11]
}
```

**algorithm 取值**（仅限这两种）：bubble-sort | selection-sort

**规则**：
1. array 长度 8-10，值 5-99，不重复
2. 只需要 algorithm 和 array 两个字段，绝不写 steps 字段
3. 必须用 ```algo-viz 代码块包裹，严禁输出裸露 JSON
4. 正文永远优先：先完整写完文字解释和代码，最后才附 algo-viz
5. 直接给出答案，不要输出冗长的思考过程"""


# 导出状态消息函数供 API 层使用
sse_status = _sse_status
sse_source = _sse_source


async def update_document_content(
    db: AsyncSession,
    document: Document,
    new_content: str,
) -> dict:
    """更新文档内容：删除旧向量和chunks → AI格式化 → 重新分块 → 重新向量化

    返回更新后的文档状态信息
    """
    # Step 1: 删除旧的 ChromaDB 向量
    from app.core.models import Chunk as ChunkModel
    old_chunks_result = await db.execute(
        select(ChunkModel).where(ChunkModel.document_id == document.id)
    )
    old_chunks = old_chunks_result.scalars().all()
    old_chunk_ids = [c.id for c in old_chunks]

    if old_chunk_ids:
        vector_store.delete_chunks(document.notebook_id, old_chunk_ids)

    # Step 2: 删除旧的 SQLite chunk 记录
    for c in old_chunks:
        await db.delete(c)
    await db.flush()

    # Step 3: AI 格式化新内容
    print(f"[DocUpdate] 开始 AI 格式化 {document.filename} ({len(new_content)} 字符)...")
    try:
        formatted_text = await _reformat_text_to_markdown(new_content)
    except Exception as e:
        print(f"[DocUpdate] 格式化失败，使用原始文本: {e}")
        formatted_text = new_content
    print(f"[DocUpdate] 格式化完成 ({len(formatted_text)} 字符)")

    # Step 4: 重新分块
    chunks_text = split_text(formatted_text)
    if not chunks_text:
        raise ValueError("更新后文档分块无有效内容")

    # Step 5: 重新向量化
    chunk_ids = []
    chunk_metadatas = []
    for i, ct in enumerate(chunks_text):
        cid = uuid.uuid4().hex
        chunk_ids.append(cid)
        chunk_metadatas.append({
            "document_id": document.id,
            "document_name": document.filename,
            "chunk_index": i,
            "notebook_id": document.notebook_id,
        })

    embeddings = embedding_service.embed(chunks_text)

    # Step 6: 存入 ChromaDB
    vector_store.add_chunks(
        notebook_id=document.notebook_id,
        chunk_ids=chunk_ids,
        texts=chunks_text,
        embeddings=embeddings,
        metadatas=chunk_metadatas,
    )

    # Step 7: 存入新的 SQLite chunk 记录
    for i, (cid, ct) in enumerate(zip(chunk_ids, chunks_text)):
        chunk = ChunkModel(
            id=cid,
            document_id=document.id,
            content=ct,
            chunk_index=i,
            token_count=estimate_tokens(ct),
        )
        db.add(chunk)

    # Step 8: 更新文档记录
    document.chunk_count = len(chunks_text)
    document.file_size = len(new_content.encode("utf-8"))
    document.status = "completed"
    document.error_msg = None
    await db.flush()

    return {
        "document_id": document.id,
        "filename": document.filename,
        "chunk_count": len(chunks_text),
        "file_size": document.file_size,
        "status": "completed",
    }


async def re_vectorize_document(
    db: AsyncSession,
    document: Document,
) -> dict:
    """重新向量化文档：读取文件内容 → 重新分块 → embedding → 写入 ChromaDB

    用于用户编辑文档后主动触发向量化。
    """
    from app.core.models import Chunk as ChunkModel

    # Step 0: 如果有待处理的编辑，读取新内容并重新处理
    if document.needs_revectorize and document.filepath:
        try:
            with open(document.filepath, "r", encoding="utf-8") as f:
                new_content = f.read()
        except Exception:
            new_content = None

        if new_content and new_content.strip():
            # AI 格式化 + 重新分块（在删除旧数据之前先准备好新数据）
            formatted = await _reformat_text_to_markdown(new_content)
            chunks_text = split_text(formatted)

            # 短内容（分块后无有效内容）直接作为单个 chunk 处理
            if not chunks_text and len(new_content.strip()) >= 2:
                chunks_text = [new_content.strip()]

            if chunks_text:
                # 生成新 chunks 和 embedding
                new_chunk_ids = []
                new_chunk_metadatas = []
                new_chunk_objects = []
                for i, ct in enumerate(chunks_text):
                    cid = uuid.uuid4().hex
                    new_chunk_ids.append(cid)
                    new_chunk_metadatas.append({
                        "document_id": document.id,
                        "document_name": document.filename,
                        "chunk_index": i,
                        "notebook_id": document.notebook_id,
                    })
                    new_chunk_objects.append(ChunkModel(
                        id=cid,
                        document_id=document.id,
                        content=ct,
                        chunk_index=i,
                        token_count=estimate_tokens(ct),
                    ))

                # 向量化新内容
                embeddings = embedding_service.embed(chunks_text)

                # 新内容准备好后，安全删除旧数据
                old_chunks_result = await db.execute(
                    select(ChunkModel).where(ChunkModel.document_id == document.id)
                )
                old_chunks = old_chunks_result.scalars().all()
                old_chunk_ids = [c.id for c in old_chunks]

                # 删除旧向量（ChromaDB）
                if old_chunk_ids:
                    try:
                        vector_store.delete_chunks(document.notebook_id, old_chunk_ids)
                    except Exception:
                        pass

                # 删除旧 SQLite chunks
                for c in old_chunks:
                    await db.delete(c)

                # 写入新 chunks 到 SQLite
                for nc in new_chunk_objects:
                    db.add(nc)

                # 写入新向量到 ChromaDB
                vector_store.add_chunks(
                    notebook_id=document.notebook_id,
                    chunk_ids=new_chunk_ids,
                    texts=chunks_text,
                    embeddings=embeddings,
                    metadatas=new_chunk_metadatas,
                )

                document.chunk_count = len(chunks_text)
                document.file_size = len(new_content.encode("utf-8"))
                document.status = "completed"
                document.needs_revectorize = 0
                await db.flush()

                return {
                    "document_id": document.id,
                    "chunk_count": len(chunks_text),
                    "status": "re_vectorized",
                }

            # chunks_text 为空 — 内容太短，保留旧数据
            raise ValueError("分块后无有效内容（内容可能太短）")

    # Step 1: 回退 — 对已有 chunks 重新向量化（内容未变或不需要重新分块）
    chunks_result = await db.execute(
        select(ChunkModel)
        .where(ChunkModel.document_id == document.id)
        .order_by(ChunkModel.chunk_index.asc())
    )
    chunks = chunks_result.scalars().all()

    if not chunks:
        raise ValueError("文档无有效内容")

    # Step 2: 删除旧向量
    old_chunk_ids = [c.id for c in chunks]
    try:
        vector_store.delete_chunks(document.notebook_id, old_chunk_ids)
    except Exception:
        pass  # collection 可能不存在

    # Step 3: 重新向量化
    texts = [c.content for c in chunks]
    embeddings = embedding_service.embed(texts)

    # Step 4: 写入 ChromaDB
    metadatas = []
    for c in chunks:
        metadatas.append({
            "document_id": document.id,
            "document_name": document.filename,
            "chunk_index": c.chunk_index,
            "notebook_id": document.notebook_id,
        })

    vector_store.add_chunks(
        notebook_id=document.notebook_id,
        chunk_ids=old_chunk_ids,
        texts=texts,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return {
        "document_id": document.id,
        "chunk_count": len(chunks),
        "status": "re_vectorized",
    }


async def extract_knowledge_points(
    db: AsyncSession,
    notebook_id: str,
) -> List[KnowledgePoint]:
    """使用 Flash LLM 从笔记本中提取知识点（会员功能）

    收集所有已完成文档的 chunk 内容，发送给 Flash LLM 进行知识点提取，
    返回结构化的 KnowledgePoint 列表并存入数据库。
    """
    # 收集所有文档内容
    docs_result = await db.execute(
        select(Document).where(
            Document.notebook_id == notebook_id,
            Document.status == "completed",
        )
    )
    documents = docs_result.scalars().all()

    if not documents:
        return []

    all_chunks = []
    for doc in documents:
        chunks_result = await db.execute(
            select(Chunk).where(Chunk.document_id == doc.id).order_by(Chunk.chunk_index)
        )
        for chunk in chunks_result.scalars().all():
            all_chunks.append(f"[来源: {doc.filename}]\n{chunk.content}")

    # 拼接内容（最多 30000 字符）
    combined = "\n\n---\n\n".join(all_chunks)
    if len(combined) > 30000:
        combined = combined[:30000] + "\n...(内容截断)"

    system_prompt = """你是一个教育领域的知识提取专家。请从以下学习资料中提取关键知识点。

要求：
1. 提取 5-15 个核心知识点（根据内容量决定）
2. 每个知识点包含：
   - title: 简洁的知识点名称（10字以内）
   - content: 知识点的详细解释（50-200字）
   - tags: 2-4个标签，如 ["生物", "光合作用", "植物生理"]
3. 知识点应该覆盖资料中的主要概念、重要公式、关键定义
4. 按重要程度排序，最重要的在前面
5. 直接输出 JSON 数组格式，不要添加额外说明

输出格式示例：
[
  {
    "title": "光合作用定义",
    "content": "光合作用是绿色植物利用光能将二氧化碳和水转化为有机物并释放氧气的过程...",
    "tags": ["生物学", "光合作用", "植物生理"]
  }
]"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请从以下学习资料中提取知识点：\n\n{combined}"},
    ]

    # 调用 Flash LLM
    try:
        response = await llm_service.flash.chat(
            messages, stream=False, temperature=0.5, max_tokens=4096
        )
    except Exception as e:
        print(f"[KP Extract] LLM 调用失败: {e}")
        return []

    # 解析 JSON
    try:
        # 尝试提取 JSON 数组
        json_str = response.strip()
        if "```" in json_str:
            # 移除 markdown 代码块标记
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
        points_data = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"[KP Extract] JSON 解析失败: {e}")
        print(f"[KP Extract] 原始响应: {response[:500]}")
        return []

    if not isinstance(points_data, list):
        print(f"[KP Extract] 期望 JSON 数组，实际得到: {type(points_data)}")
        return []

    # 删除旧知识点
    old_points = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.notebook_id == notebook_id)
    )
    for p in old_points.scalars().all():
        await db.delete(p)

    # 存入新知识点
    new_points = []
    for item in points_data:
        kp = KnowledgePoint(
            id=uuid.uuid4().hex,
            notebook_id=notebook_id,
            title=item.get("title", "未命名")[:100],
            content=item.get("content", "")[:2000],
            tags=json.dumps(item.get("tags", []), ensure_ascii=False),
        )
        db.add(kp)
        new_points.append(kp)

    await db.flush()
    return new_points


# ═══════════════════════════════════════════════════════════════
# 知识卡片 & 记忆口诀生成（Pro LLM）
# ═══════════════════════════════════════════════════════════════

async def generate_knowledge_cards(
    db: AsyncSession,
    notebook_id: str,
    document_ids: list[str] | None = None,
) -> list[dict]:
    """使用 Flash LLM 基于笔记本内容生成知识卡片，并自动存入 knowledge_points 表

    Args:
        document_ids: 指定要使用的文档 ID 列表；为空或 None 则使用全部已完成文档
    """
    # 收集文档内容 + 构建 chunk 元数据映射（用于后续来源定位）
    query = select(Document).where(
        Document.notebook_id == notebook_id,
        Document.status == "completed",
    )
    if document_ids:
        query = query.where(Document.id.in_(document_ids))
    docs_result = await db.execute(query)
    documents = docs_result.scalars().all()
    if not documents:
        return []

    all_chunks = []
    chunk_meta = {}  # chunk_id → {document_id, document_name}
    for doc in documents:
        chunks_result = await db.execute(
            select(Chunk).where(Chunk.document_id == doc.id).order_by(Chunk.chunk_index)
        )
        for chunk in chunks_result.scalars().all():
            all_chunks.append(f"[来源: {doc.filename}]\n{chunk.content}")
            chunk_meta[chunk.id] = {
                "document_id": doc.id,
                "document_name": doc.filename,
            }

    combined = "\n\n---\n\n".join(all_chunks)
    if len(combined) > 25000:
        combined = combined[:25000] + "\n...(内容截断)"

    system_prompt = """你是一个教育领域的知识卡片设计专家。请基于提供的学习资料生成高质量的知识卡片。

要求：
1. 生成 5-10 张知识卡片
2. 每张卡片包含：
   - title: 卡片主题（15字以内）
   - front: 正面 — 一个引导性问题或需要回忆的关键概念（如"什么是光合作用？"或"解释牛顿第三定律"）
   - back: 背面 — 详细解答（50-200字），包含关键公式、步骤、要点
   - tags: 2-4个相关标签
3. 覆盖资料中的核心概念、定义、公式、重要原理
4. front 用问题形式更好，方便自测
5. 直接输出 JSON 数组，不要添加额外说明

输出格式：
[
  {
    "title": "光合作用",
    "front": "光合作用的过程和反应式是什么？",
    "back": "光合作用是绿色植物利用光能...\\n总反应式：6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂...",
    "tags": ["生物", "光合作用"]
  }
]"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请基于以下学习资料生成知识卡片：\n\n{combined}"},
    ]

    try:
        response = await llm_service.flash.chat(
            messages, stream=False, temperature=0.6, max_tokens=4096
        )
    except Exception as e:
        print(f"[Cards] LLM 调用失败: {e}")
        return []

    try:
        json_str = response.strip()
        if "```" in json_str:
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
        cards = json.loads(json_str)
        if not isinstance(cards, list):
            return []
    except json.JSONDecodeError as e:
        print(f"[Cards] JSON 解析失败: {e}")
        return []

    # 先收集旧知识点的 ID，用于新数据写入成功后再清理
    # 构建有效文档 ID 集合
    valid_doc_ids = {doc.id for doc in documents}
    valid_doc_names = {doc.id: doc.filename for doc in documents}

    # 收集需要清理的旧知识点 ID
    if document_ids:
        # 清理指定文档关联的旧知识点
        old_points_result = await db.execute(
            select(KnowledgePoint).where(
                KnowledgePoint.notebook_id == notebook_id,
                KnowledgePoint.document_id.in_(document_ids)
            )
        )
        old_point_ids = [p.id for p in old_points_result.scalars().all()]
        # 同时清理引用无效文档（已被删除）的孤立知识点
        all_result = await db.execute(
            select(KnowledgePoint).where(
                KnowledgePoint.notebook_id == notebook_id
            )
        )
        for p in all_result.scalars().all():
            if p.document_id and p.document_id not in valid_doc_ids:
                old_point_ids.append(p.id)
    else:
        old_points_result = await db.execute(
            select(KnowledgePoint).where(KnowledgePoint.notebook_id == notebook_id)
        )
        old_point_ids = [p.id for p in old_points_result.scalars().all()]

    new_point_ids = []

    for item in cards:
        kp_id = uuid.uuid4().hex
        new_point_ids.append(kp_id)

        # 通过语义搜索为卡片定位来源文档/chunk
        doc_id = ""
        doc_name = ""
        chunk_id = ""
        try:
            query_text = f"{item.get('title', '')} {item.get('front', '')} {item.get('back', '')}"
            query_embedding = embedding_service.embed_query(query_text)
            search_results = vector_store.search(notebook_id, query_embedding, top_k=1)
            if search_results:
                best = search_results[0]
                found_chunk_id = best.get("id", "")
                best_meta = best.get("metadata") or {}
                found_doc_id = best_meta.get("document_id", "")
                found_doc_name = best_meta.get("document_name", "")
                # 回退到 chunk_meta 映射
                if not found_doc_id:
                    found_doc_id = chunk_meta.get(found_chunk_id, {}).get("document_id", "")
                if not found_doc_name:
                    found_doc_name = chunk_meta.get(found_chunk_id, {}).get("document_name", "")
                # 验证 document_id 是否属于当前笔记本的有效文档
                if found_doc_id and found_doc_id in valid_doc_ids:
                    doc_id = found_doc_id
                    chunk_id = found_chunk_id
                    doc_name = found_doc_name
                else:
                    # 向量搜索返回的文档不在当前笔记本中（可能已删除），
                    # 尝试匹配到当前笔记本中有相同 chunk 内容的文档
                    if found_chunk_id and found_chunk_id in chunk_meta:
                        meta = chunk_meta[found_chunk_id]
                        if meta.get("document_id") in valid_doc_ids:
                            doc_id = meta["document_id"]
                            chunk_id = found_chunk_id
                            doc_name = meta.get("document_name", "")
        except Exception as e:
            print(f"[Cards] 来源定位失败 for '{item.get('title', '')}': {e}")

        kp = KnowledgePoint(
            id=kp_id,
            notebook_id=notebook_id,
            document_id=doc_id or None,
            chunk_id=chunk_id or None,
            title=item.get("title", "")[:100],
            content=f"**{item.get('front', '')}**\n\n{item.get('back', '')}"[:2000],
            tags=json.dumps(item.get("tags", []), ensure_ascii=False),
        )
        db.add(kp)
        item["knowledge_point_id"] = kp_id
        item["document_id"] = doc_id
        item["document_name"] = doc_name
        item["chunk_id"] = chunk_id

    await db.flush()

    # 新数据写入成功后才删除旧记录，避免先删旧再写新导致数据丢失
    if old_point_ids:
        for pid in old_point_ids:
            if pid not in new_point_ids:
                old_kp = await db.get(KnowledgePoint, pid)
                if old_kp:
                    await db.delete(old_kp)
        await db.flush()

    return cards


async def generate_mnemonics(
    db: AsyncSession,
    notebook_id: str,
    document_ids: list[str] | None = None,
) -> list[dict]:
    """使用 Flash LLM 基于笔记本内容生成记忆口诀"""
    query = select(Document).where(
        Document.notebook_id == notebook_id,
        Document.status == "completed",
    )
    if document_ids:
        query = query.where(Document.id.in_(document_ids))
    docs_result = await db.execute(query)
    documents = docs_result.scalars().all()
    if not documents:
        return []

    all_chunks = []
    for doc in documents:
        chunks_result = await db.execute(
            select(Chunk).where(Chunk.document_id == doc.id).order_by(Chunk.chunk_index)
        )
        for chunk in chunks_result.scalars().all():
            all_chunks.append(f"[来源: {doc.filename}]\n{chunk.content}")

    combined = "\n\n---\n\n".join(all_chunks)
    if len(combined) > 25000:
        combined = combined[:25000] + "\n...(内容截断)"

    system_prompt = """你是一个创意教育内容设计师，擅长创作押韵、有趣的记忆口诀帮助学生记住知识点。

要求：
1. 生成 3-8 条记忆口诀
2. 每条包含：
   - title: 口诀名称（10字以内）
   - content: 口诀正文（押韵、朗朗上口、便于记忆）
   - source_doc: 对应知识点来源
   - tip: 记忆提示（一句话解释如何用这个口诀）
3. 口诀应覆盖资料中的核心概念、公式、流程、分类等
4. 中文口诀要押韵，英文口诀要有节奏感
5. 直接输出 JSON 数组，不要添加额外说明

输出格式：
[
  {
    "title": "牛顿三定律口诀",
    "content": "一定律讲惯性，不受外力状态恒；\\n二定律说加速度，F等ma记清楚；\\n三定律谈相互作用，大小相等方向反。",
    "source_doc": "牛顿运动定律",
    "tip": "一定惯、二定加、三定互 — 三个字概括三定律"
  }
]"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请基于以下学习资料生成记忆口诀：\n\n{combined}"},
    ]

    try:
        response = await llm_service.flash.chat(
            messages, stream=False, temperature=0.8, max_tokens=4096
        )
    except Exception as e:
        print(f"[Mnemonics] LLM 调用失败: {e}")
        return []

    try:
        json_str = response.strip()
        if "```" in json_str:
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
        mnemonics = json.loads(json_str)
        return mnemonics if isinstance(mnemonics, list) else []
    except json.JSONDecodeError as e:
        print(f"[Mnemonics] JSON 解析失败: {e}")
        return []
