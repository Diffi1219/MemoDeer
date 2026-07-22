"""高级功能 API — 知识卡片 & 记忆口诀生成（高级会员功能）"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.models import User, Notebook, KnowledgePoint, Document
from app.core.schemas import (
    PremiumGenerateRequest, PremiumGenerateResponse,
    KnowledgeCardItem, MnemonicItem,
    KnowledgeCardUpdateRequest, KnowledgeCardsResponse,
)
from app.api.auth import get_current_user, require_premium
from app.services.rag_service import generate_knowledge_cards, generate_mnemonics

router = APIRouter(prefix="/api", tags=["高级功能"])


@router.post("/notebooks/{notebook_id}/premium/generate", response_model=PremiumGenerateResponse)
async def generate_premium_content(
    notebook_id: str,
    body: PremiumGenerateRequest | None = None,
    user: User = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    """生成知识卡片和记忆口诀（需高级会员）— 使用 Flash LLM 基于知识库真实生成

    body.document_ids: 指定要使用的文档 ID 列表；空列表或 None = 使用全部已完成文档
    """
    # 验证笔记本所有权
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    from datetime import datetime

    doc_ids = body.document_ids if body and body.document_ids else None

    # 调用 LLM 生成知识卡片和记忆口诀
    cards_data = await generate_knowledge_cards(db, notebook_id, document_ids=doc_ids)
    mnemonics_data = await generate_mnemonics(db, notebook_id, document_ids=doc_ids)

    return PremiumGenerateResponse(
        notebook_id=notebook_id,
        cards=[
            KnowledgeCardItem(
                id=c.get("knowledge_point_id", f"c{i+1}"),
                title=c.get("title", ""),
                front=c.get("front", ""),
                back=c.get("back", ""),
                tags=c.get("tags", []),
                knowledge_point_id=c.get("knowledge_point_id", ""),
                document_id=c.get("document_id", ""),
                document_name=c.get("document_name", ""),
                chunk_id=c.get("chunk_id", ""),
            )
            for i, c in enumerate(cards_data)
        ],
        mnemonics=[
            MnemonicItem(
                id=f"m{i+1}",
                title=m.get("title", ""),
                content=m.get("content", ""),
                source_doc=m.get("source_doc", ""),
                tip=m.get("tip", ""),
            )
            for i, m in enumerate(mnemonics_data)
        ],
        generated_at=datetime.utcnow().isoformat(),
    )


@router.get("/notebooks/{notebook_id}/premium/cards", response_model=KnowledgeCardsResponse)
async def get_knowledge_cards(
    notebook_id: str,
    user: User = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    """获取笔记本已有的知识卡片（从 knowledge_points 表读取）"""
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    kp_result = await db.execute(
        select(KnowledgePoint)
        .where(KnowledgePoint.notebook_id == notebook_id)
        .order_by(KnowledgePoint.created_at)
    )
    points = kp_result.scalars().all()

    # 预加载文档名映射
    doc_ids = {kp.document_id for kp in points if kp.document_id}
    doc_names = {}
    if doc_ids:
        docs_result = await db.execute(
            select(Document).where(Document.id.in_(doc_ids))
        )
        for d in docs_result.scalars().all():
            doc_names[d.id] = d.filename

    cards = []
    for i, kp in enumerate(points):
        # 从 content 中还原 front/back：content 格式为 "**front**\n\nback"
        content = kp.content or ""
        front = ""
        back = content
        if content.startswith("**"):
            first_bold_end = content.find("**", 2)
            if first_bold_end != -1:
                front = content[2:first_bold_end]
                rest = content[first_bold_end + 2:]
                if rest.startswith("\n\n"):
                    back = rest[2:]
                else:
                    back = rest

        tags = []
        try:
            tags = json.loads(kp.tags) if kp.tags and kp.tags != "[]" else []
        except (json.JSONDecodeError, TypeError):
            tags = []

        cards.append(KnowledgeCardItem(
            id=kp.id,
            title=kp.title,
            front=front,
            back=back,
            tags=tags if isinstance(tags, list) else [],
            knowledge_point_id=kp.id,
            document_id=kp.document_id or "",
            document_name=doc_names.get(kp.document_id, ""),
            chunk_id=kp.chunk_id or "",
        ))

    return KnowledgeCardsResponse(notebook_id=notebook_id, cards=cards)


@router.put("/notebooks/{notebook_id}/premium/cards/{kp_id}")
async def update_knowledge_card(
    notebook_id: str,
    kp_id: str,
    data: KnowledgeCardUpdateRequest,
    user: User = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    """更新一张知识卡片"""
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    kp_result = await db.execute(
        select(KnowledgePoint).where(
            KnowledgePoint.id == kp_id,
            KnowledgePoint.notebook_id == notebook_id,
        )
    )
    kp = kp_result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="知识点不存在")

    if data.title is not None:
        kp.title = data.title[:100]
    if data.front is not None or data.back is not None:
        old_front = ""
        old_back = kp.content or ""
        if kp.content and kp.content.startswith("**"):
            first_bold_end = kp.content.find("**", 2)
            if first_bold_end != -1:
                old_front = kp.content[2:first_bold_end]
                rest = kp.content[first_bold_end + 2:]
                if rest.startswith("\n\n"):
                    old_back = rest[2:]
                else:
                    old_back = rest
        new_front = data.front if data.front is not None else old_front
        new_back = data.back if data.back is not None else old_back
        kp.content = f"**{new_front}**\n\n{new_back}"[:2000]
    if data.tags is not None:
        kp.tags = data.tags

    await db.flush()
    return {"ok": True}


@router.delete("/notebooks/{notebook_id}/premium/cards/{kp_id}")
async def delete_knowledge_card(
    notebook_id: str,
    kp_id: str,
    user: User = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    """删除一张知识卡片"""
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    kp_result = await db.execute(
        select(KnowledgePoint).where(
            KnowledgePoint.id == kp_id,
            KnowledgePoint.notebook_id == notebook_id,
        )
    )
    kp = kp_result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="知识点不存在")

    await db.delete(kp)
    await db.flush()
    return {"ok": True}
