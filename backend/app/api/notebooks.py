"""笔记本 CRUD API"""
import uuid
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.models import User, Notebook, Document
from app.core.schemas import (
    NotebookCreate, NotebookUpdate, NotebookOut, NotebookDetail,
    AddNoteRequest, AddNoteResponse,
    FileCreate, DocumentOut,
    BatchExtractRequest, BatchExtractItem,
)
from app.api.auth import get_current_user, check_premium_status, require_premium
from app.services.vector_store import vector_store
from app.services.rag_service import create_note_from_text
from app.config import settings

router = APIRouter(prefix="/api/notebooks", tags=["笔记本"])


@router.get("", response_model=list[NotebookOut])
async def list_notebooks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的所有笔记本"""
    result = await db.execute(
        select(Notebook).where(Notebook.user_id == user.id).order_by(Notebook.updated_at.desc())
    )
    notebooks = result.scalars().all()

    out = []
    for nb in notebooks:
        # 统计文档数
        doc_count_result = await db.execute(
            select(func.count(Document.id)).where(Document.notebook_id == nb.id)
        )
        doc_count = doc_count_result.scalar() or 0

        out.append(NotebookOut(
            id=nb.id,
            title=nb.title,
            description=nb.description,
            document_count=doc_count,
            created_at=nb.created_at,
            updated_at=nb.updated_at,
        ))
    return out


@router.post("", response_model=NotebookOut, status_code=201)
async def create_notebook(
    data: NotebookCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新笔记本（免费用户有数量限制）"""
    # 免费用户笔记本数量限制
    check_premium_status(user)
    if not user.is_premium:
        count_result = await db.execute(
            select(func.count(Notebook.id)).where(Notebook.user_id == user.id)
        )
        current_count = count_result.scalar() or 0
        if current_count >= settings.FREE_MAX_NOTEBOOKS:
            raise HTTPException(
                status_code=403,
                detail=f"免费用户最多创建 {settings.FREE_MAX_NOTEBOOKS} 个笔记本，升级会员可无限创建",
            )

    notebook = Notebook(
        id=uuid.uuid4().hex,
        user_id=user.id,
        title=data.title,
        description=data.description,
    )
    db.add(notebook)
    await db.flush()

    return NotebookOut(
        id=notebook.id,
        title=notebook.title,
        description=notebook.description,
        document_count=0,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
    )


@router.get("/{notebook_id}", response_model=NotebookDetail)
async def get_notebook(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取笔记本详情"""
    notebook = await _get_user_notebook(db, notebook_id, user.id)

    # 统计
    doc_count_result = await db.execute(
        select(func.count(Document.id)).where(Document.notebook_id == notebook.id)
    )
    doc_count = doc_count_result.scalar() or 0

    # 文档列表
    docs_result = await db.execute(
        select(Document).where(Document.notebook_id == notebook.id).order_by(Document.created_at.desc())
    )
    docs = docs_result.scalars().all()

    from app.core.schemas import DocumentOut

    doc_outs = []
    for d in docs:
        doc_outs.append(DocumentOut(
            id=d.id,
            notebook_id=d.notebook_id,
            filename=d.filename,
            file_type=d.file_type,
            file_size=d.file_size,
            status=d.status,
            error_msg=d.error_msg,
            chunk_count=d.chunk_count,
            folder_id=d.folder_id,
            needs_revectorize=d.needs_revectorize,
            content_updated_at=d.content_updated_at,
            created_at=d.created_at,
        ))

    return NotebookDetail(
        id=notebook.id,
        title=notebook.title,
        description=notebook.description,
        document_count=doc_count,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
        documents=doc_outs,
    )


@router.put("/{notebook_id}", response_model=NotebookOut)
async def update_notebook(
    notebook_id: str,
    data: NotebookUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新笔记本"""
    notebook = await _get_user_notebook(db, notebook_id, user.id)

    if data.title is not None:
        notebook.title = data.title
    if data.description is not None:
        notebook.description = data.description
    notebook.updated_at = datetime.utcnow()
    await db.flush()

    return NotebookOut(
        id=notebook.id,
        title=notebook.title,
        description=notebook.description,
        document_count=0,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
    )


@router.delete("/{notebook_id}", status_code=204)
async def delete_notebook(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除笔记本（级联删除文档、对话、向量）"""
    notebook = await _get_user_notebook(db, notebook_id, user.id)

    # 删除向量库
    vector_store.delete_collection(notebook_id)

    # 删除数据库记录（级联）
    await db.delete(notebook)
    await db.flush()


@router.post("/{notebook_id}/notes", response_model=AddNoteResponse, status_code=201)
async def add_note(
    notebook_id: str,
    data: AddNoteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """保存聊天回答为笔记（用户可编辑后保存）"""
    await _get_user_notebook(db, notebook_id, user.id)
    result = await create_note_from_text(db, notebook_id, data.content, data.title)
    return AddNoteResponse(**result)


async def _get_user_notebook(db: AsyncSession, notebook_id: str, user_id: str) -> Notebook:
    """获取属于当前用户的笔记本，否则404"""
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user_id)
    )
    notebook = result.scalar_one_or_none()
    if not notebook:
        raise HTTPException(status_code=404, detail="笔记本不存在")
    return notebook


# ─── 文件树 ───────────────────────────────────────────

@router.get("/{notebook_id}/tree")
async def get_notebook_tree(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取笔记本完整文件树（文件夹+文档嵌套结构）"""
    await _get_user_notebook(db, notebook_id, user.id)

    from app.core.models import Folder
    from app.core.schemas import TreeNode, NotebookTreeResponse

    # 查询所有文件夹
    folders_result = await db.execute(
        select(Folder).where(Folder.notebook_id == notebook_id)
    )
    folders = folders_result.scalars().all()

    # 查询所有文档
    docs_result = await db.execute(
        select(Document).where(Document.notebook_id == notebook_id).order_by(Document.created_at.desc())
    )
    docs = docs_result.scalars().all()

    # 构建文件夹映射
    folder_map: dict[str, list] = {}  # parent_id → children folders
    for f in folders:
        key = f.parent_id or "__root__"
        if key not in folder_map:
            folder_map[key] = []
        folder_map[key].append(f)

    # 构建文档映射
    doc_map: dict[str, list] = {}  # folder_id → documents
    for d in docs:
        key = d.folder_id or "__root__"
        if key not in doc_map:
            doc_map[key] = []
        doc_map[key].append(d)

    def build_tree(parent_key: str) -> list:
        nodes = []
        # 文件夹
        for f in sorted(folder_map.get(parent_key, []), key=lambda x: x.name):
            children = build_tree(f.id)
            nodes.append(TreeNode(
                type="folder",
                id=f.id,
                name=f.name,
                parent_id=f.parent_id,
                children=children,
            ))
        # 文档
        for d in doc_map.get(parent_key, []):
            nodes.append(TreeNode(
                type="document",
                id=d.id,
                name=d.filename,
                folder_id=d.folder_id,
                file_type=d.file_type,
                status=d.status,
                needs_revectorize=d.needs_revectorize,
            ))
        return nodes

    tree = build_tree("__root__")
    return {"notebook_id": notebook_id, "tree": tree}


@router.post("/{notebook_id}/files", status_code=201)
async def create_file(
    notebook_id: str,
    data: FileCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新 Markdown 文件（免费用户有数量限制）"""
    await _get_user_notebook(db, notebook_id, user.id)

    # 免费用户文档数量限制
    check_premium_status(user)
    if not user.is_premium:
        doc_count_result = await db.execute(
            select(func.count(Document.id)).where(Document.notebook_id == notebook_id)
        )
        current_doc_count = doc_count_result.scalar() or 0
        if current_doc_count >= settings.FREE_MAX_DOCUMENTS_PER_NOTEBOOK:
            raise HTTPException(
                status_code=403,
                detail=f"免费用户每个笔记本最多创建 {settings.FREE_MAX_DOCUMENTS_PER_NOTEBOOK} 个文件，升级会员可无限创建",
            )

    from app.core.schemas import DocumentOut

    # 确保文件名以 .md 结尾
    name = data.name.strip()
    if not name.endswith(".md"):
        name += ".md"

    # 检查重名
    existing = await db.execute(
        select(Document).where(
            Document.notebook_id == notebook_id,
            Document.filename == name,
            Document.folder_id == data.folder_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="同名文件已存在")

    import os
    doc_id = uuid.uuid4().hex
    upload_dir = os.path.join(settings.UPLOAD_DIR, notebook_id, doc_id)
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, name)

    content = data.content or ""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    document = Document(
        id=doc_id,
        notebook_id=notebook_id,
        folder_id=data.folder_id,
        filename=name,
        filepath=filepath,
        file_type="md",
        file_size=len(content.encode("utf-8")),
        status="completed",
        chunk_count=0,
        needs_revectorize=1 if content.strip() else 0,
    )
    db.add(document)
    await db.flush()

    # 如果有内容，立即分块和向量化
    if content.strip():
        try:
            from app.services.rag_service import process_document
            await process_document(db, document)
        except Exception as e:
            document.status = "error"
            document.error_msg = str(e)
            await db.flush()

    return DocumentOut(
        id=document.id,
        notebook_id=document.notebook_id,
        filename=document.filename,
        file_type=document.file_type,
        file_size=document.file_size,
        status=document.status,
        error_msg=document.error_msg,
        chunk_count=document.chunk_count,
        folder_id=document.folder_id,
        needs_revectorize=document.needs_revectorize,
        content_updated_at=document.content_updated_at,
        created_at=document.created_at,
    )


# ─── 向量化队列 ───────────────────────────────────────

@router.get("/{notebook_id}/pending-vectorization")
async def get_pending_vectorization(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取笔记本中待向量化的文档列表"""
    await _get_user_notebook(db, notebook_id, user.id)

    from app.core.schemas import PendingVectorizationItem, PendingVectorizationResponse

    result = await db.execute(
        select(Document).where(
            Document.notebook_id == notebook_id,
            Document.needs_revectorize == 1,
        )
    )
    docs = result.scalars().all()

    items = [
        PendingVectorizationItem(
            document_id=d.id,
            filename=d.filename,
            content_updated_at=d.content_updated_at,
        )
        for d in docs
    ]
    return PendingVectorizationResponse(notebook_id=notebook_id, items=items)


@router.post("/{notebook_id}/vectorize-all")
async def vectorize_all(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """一键向量化笔记本中所有待处理的文档"""
    await _get_user_notebook(db, notebook_id, user.id)

    result = await db.execute(
        select(Document).where(
            Document.notebook_id == notebook_id,
            Document.needs_revectorize == 1,
        )
    )
    docs = result.scalars().all()

    if not docs:
        return {"vectorized": 0, "message": "没有待向量化的文档"}

    from app.services.rag_service import re_vectorize_document

    success = 0
    failed = 0
    for doc in docs:
        try:
            await re_vectorize_document(db, doc)
            doc.needs_revectorize = 0
            success += 1
        except Exception as e:
            failed += 1
            print(f"[VectorizeAll] 向量化失败 {doc.filename}: {e}")

    await db.flush()
    return {"vectorized": success, "failed": failed, "message": f"成功向量化 {success} 个文档" + (f"，{failed} 个失败" if failed else "")}


# ─── 知识点 ───────────────────────────────────────────

@router.get("/{notebook_id}/knowledge-points")
async def get_knowledge_points(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取笔记本的知识点列表"""
    await _get_user_notebook(db, notebook_id, user.id)

    from app.core.models import KnowledgePoint
    from app.core.schemas import KnowledgePointOut

    result = await db.execute(
        select(KnowledgePoint)
        .where(KnowledgePoint.notebook_id == notebook_id)
        .order_by(KnowledgePoint.created_at.desc())
    )
    points = result.scalars().all()

    return [
        KnowledgePointOut(
            id=p.id,
            notebook_id=p.notebook_id,
            document_id=p.document_id,
            title=p.title,
            content=p.content,
            tags=p.tags,
            created_at=p.created_at,
        )
        for p in points
    ]


@router.post("/{notebook_id}/knowledge-points/extract")
async def extract_knowledge_points(
    notebook_id: str,
    user: User = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    """AI 提取知识点（会员功能）— 生成知识卡片并存入知识库"""
    await _get_user_notebook(db, notebook_id, user.id)

    from app.services.rag_service import generate_knowledge_cards
    from app.core.schemas import KnowledgePointExtractResponse, KnowledgePointOut

    await generate_knowledge_cards(db, notebook_id)

    # 查回刚存入的知识点
    from app.core.models import KnowledgePoint
    points_result = await db.execute(
        select(KnowledgePoint)
        .where(KnowledgePoint.notebook_id == notebook_id)
        .order_by(KnowledgePoint.created_at.desc())
    )
    points = points_result.scalars().all()

    return KnowledgePointExtractResponse(
        notebook_id=notebook_id,
        points_count=len(points),
        points=[
            KnowledgePointOut(
                id=p.id,
                notebook_id=p.notebook_id,
                document_id=p.document_id,
                title=p.title,
                content=p.content,
                tags=p.tags,
                created_at=p.created_at,
            )
            for p in points
        ],
    )


# ─── 批量知识点提取 ─────────────────────────────────

@router.post("/batch/extract-knowledge")
async def batch_extract_knowledge(
    data: BatchExtractRequest,
    user: User = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    """手动批量提取知识点 — 用户勾选多个笔记本后触发（会员功能）"""
    from app.services.rag_service import generate_knowledge_cards

    results = []
    total = 0

    for notebook_id in data.notebook_ids:
        try:
            nb_check = await db.execute(
                select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
            )
            if not nb_check.scalar_one_or_none():
                results.append(BatchExtractItem(
                    notebook_id=notebook_id,
                    success=False,
                    error="笔记本不存在或无权访问",
                ).model_dump())
                continue

            await generate_knowledge_cards(db, notebook_id)
            # 统计生成的知识点数量
            from app.core.models import KnowledgePoint
            kp_result = await db.execute(
                select(func.count(KnowledgePoint.id)).where(KnowledgePoint.notebook_id == notebook_id)
            )
            kp_count = kp_result.scalar() or 0
            results.append(BatchExtractItem(
                notebook_id=notebook_id,
                success=True,
                points_count=kp_count,
            ).model_dump())
            total += kp_count

        except Exception as e:
            results.append(BatchExtractItem(
                notebook_id=notebook_id,
                success=False,
                error=str(e),
            ).model_dump())

    return {
        "results": results,
        "total_points": total,
    }
