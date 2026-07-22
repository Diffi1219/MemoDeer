"""知识库检索 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.core.database import get_db
from app.core.models import User, Notebook, Document, KnowledgePoint
from app.core.schemas import SearchRequest, SearchResponse, SearchResult
from app.core.schemas import GlobalSearchRequest, GlobalSearchResponse, NotebookSearchResult
from app.api.auth import get_current_user
from app.services.rag_service import search_notebook, search_all_notebooks

router = APIRouter(tags=["检索"])


@router.post("/api/notebooks/{notebook_id}/search", response_model=SearchResponse)
async def search(
    notebook_id: str,
    data: SearchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """在笔记本中语义搜索"""
    # 验证笔记本所有权
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    # 检索
    try:
        results = await search_notebook(db, notebook_id, data.query, data.top_k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"检索失败: {str(e)}")

    # 格式化结果
    search_results = []
    for r in results:
        meta = r.get("metadata", {})
        doc_name = meta.get("document_name", "未知文档")
        doc_id = meta.get("document_id", "")
        search_results.append(SearchResult(
            chunk_id=r.get("id", ""),
            document_id=doc_id,
            document_name=doc_name,
            content=r.get("content", "")[:500],
            score=round(1 - r.get("distance", 0), 4),
        ))

    # 同时搜索知识点/知识卡片
    try:
        kp_keywords = data.query.strip().split()
        kp_conditions = []
        for kw in kp_keywords:
            kp_conditions.append(KnowledgePoint.title.ilike(f"%{kw}%"))
            kp_conditions.append(KnowledgePoint.content.ilike(f"%{kw}%"))
        if kp_conditions:
            kp_result = await db.execute(
                select(KnowledgePoint)
                .where(
                    KnowledgePoint.notebook_id == notebook_id,
                    or_(*kp_conditions),
                )
                .limit(data.top_k)
            )
            for kp in kp_result.scalars().all():
                search_results.append(SearchResult(
                    chunk_id=f"kp_{kp.id}",
                    document_name=f"📚 {kp.title}（知识点）",
                    content=kp.content[:500],
                    score=0.8,
                ))
    except Exception as e:
        print(f"[Search] 知识点搜索失败: {e}")

    return SearchResponse(query=data.query, results=search_results)


@router.post("/api/search", response_model=GlobalSearchResponse)
async def global_search(
    data: GlobalSearchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """跨所有笔记本全局搜索，结果按笔记本分组"""
    try:
        notebook_results = await search_all_notebooks(db, user.id, data.query, data.top_k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"全局检索失败: {str(e)}")

    notebooks_out = []
    for nr in notebook_results:
        notebooks_out.append(NotebookSearchResult(
            notebook_id=nr["notebook_id"],
            notebook_title=nr["notebook_title"],
            match_count=nr["match_count"],
            chunks=[SearchResult(**c) for c in nr["chunks"]],
        ))

    # 全局搜索知识点
    try:
        kp_keywords = data.query.strip().split()
        kp_conditions = []
        for kw in kp_keywords:
            kp_conditions.append(KnowledgePoint.title.ilike(f"%{kw}%"))
            kp_conditions.append(KnowledgePoint.content.ilike(f"%{kw}%"))
        if kp_conditions:
            user_notebooks = await db.execute(
                select(Notebook.id, Notebook.title).where(Notebook.user_id == user.id)
            )
            user_nb_ids = {row[0]: row[1] for row in user_notebooks.fetchall()}
            if user_nb_ids:
                kp_result = await db.execute(
                    select(KnowledgePoint)
                    .where(
                        KnowledgePoint.notebook_id.in_(user_nb_ids.keys()),
                        or_(*kp_conditions),
                    )
                    .limit(data.top_k)
                )
                for kp in kp_result.scalars().all():
                    nb_title = user_nb_ids.get(kp.notebook_id, "未知笔记本")
                    # 查找是否已有该笔记本的分组
                    existing = next((n for n in notebooks_out if n.notebook_id == kp.notebook_id), None)
                    chunk_result = SearchResult(
                        chunk_id=f"kp_{kp.id}",
                        document_name=f"📚 {kp.title}（知识点）",
                        content=kp.content[:500],
                        score=0.85,
                    )
                    if existing:
                        existing.chunks.append(chunk_result)
                        existing.match_count += 1
                    else:
                        notebooks_out.append(NotebookSearchResult(
                            notebook_id=kp.notebook_id,
                            notebook_title=nb_title,
                            match_count=1,
                            chunks=[chunk_result],
                        ))
    except Exception as e:
        print(f"[GlobalSearch] 知识点搜索失败: {e}")

    return GlobalSearchResponse(query=data.query, notebooks=notebooks_out)
