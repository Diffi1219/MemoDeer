"""文档上传 & 管理 API"""
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.core.database import get_db
from app.core.models import User, Notebook, Document, Chunk, Folder
from app.core.schemas import (
    DocumentOut, DocumentStatus,
    UpdateDocumentRequest, UpdateDocumentResponse,
    UpdateDocumentMetaRequest, UpdateDocumentMetaResponse,
)
from app.api.auth import get_current_user, check_premium_status
from app.services.parser_service import get_file_type, MAX_FILE_SIZE
from app.services.rag_service import process_document, update_document_content, re_vectorize_document
from app.config import settings

router = APIRouter(tags=["文档"])


@router.post("/api/notebooks/{notebook_id}/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    notebook_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传文档到笔记本（免费用户有数量限制）"""
    # 验证笔记本所有权
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    notebook = result.scalar_one_or_none()
    if not notebook:
        raise HTTPException(status_code=404, detail="笔记本不存在")

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
                detail=f"免费用户每个笔记本最多上传 {settings.FREE_MAX_DOCUMENTS_PER_NOTEBOOK} 个文档，升级会员可无限上传",
            )

    # 验证文件类型
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    file_type = get_file_type(file.filename)
    if not file_type:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式。支持: PDF, DOCX, TXT, MD")

    # 读取文件内容
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"文件大小超过上限 {MAX_FILE_SIZE // 1024 // 1024}MB")

    # 保存文件
    doc_id = uuid.uuid4().hex
    upload_dir = os.path.join(settings.UPLOAD_DIR, notebook_id, doc_id)
    os.makedirs(upload_dir, exist_ok=True)

    # 保留原始文件名但防止路径遍历
    safe_filename = os.path.basename(file.filename)
    filepath = os.path.join(upload_dir, safe_filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # 创建数据库记录
    document = Document(
        id=doc_id,
        notebook_id=notebook_id,
        filename=safe_filename,
        filepath=filepath,
        file_type=file_type,
        file_size=len(content),
        status="pending",
    )
    db.add(document)
    await db.flush()

    # 异步处理文档（后台任务）
    # 注：FastAPI BackgroundTasks 在同请求中无法使用 AsyncSession
    # 这里先用同步方式处理，后续可改为 Celery/ARQ
    try:
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


@router.get("/api/notebooks/{notebook_id}/documents", response_model=list[DocumentOut])
async def list_documents(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取笔记本下的所有文档"""
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    docs_result = await db.execute(
        select(Document).where(Document.notebook_id == notebook_id).order_by(Document.created_at.desc())
    )
    docs = docs_result.scalars().all()

    outs = []
    for d in docs:
        outs.append(DocumentOut(
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
    return outs


@router.get("/api/documents/{document_id}/status", response_model=DocumentStatus)
async def get_document_status(
    document_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """查询文档处理状态"""
    result = await db.execute(
        select(Document).join(Notebook).where(
            Document.id == document_id,
            Notebook.user_id == user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    return DocumentStatus(
        id=doc.id,
        status=doc.status,
        error_msg=doc.error_msg,
    )


@router.get("/api/documents/{document_id}/content")
async def get_document_content(
    document_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取文档的完整内容（所有 chunks 按顺序拼接），支持高亮定位"""
    # 鉴权：验证文档所属笔记本归当前用户所有
    result = await db.execute(
        select(Document).join(Notebook).where(
            Document.id == document_id,
            Notebook.user_id == user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 查询所有 chunks，按 chunk_index 升序
    chunks_result = await db.execute(
        select(Chunk)
        .where(Chunk.document_id == document_id)
        .order_by(Chunk.chunk_index.asc())
    )
    chunks = chunks_result.scalars().all()

    return {
        "document_id": doc.id,
        "document_name": doc.filename,
        "file_type": doc.file_type,
        "chunks": [
            {
                "id": c.id,
                "content": c.content,
                "chunk_index": c.chunk_index,
            }
            for c in chunks
        ],
    }


@router.delete("/api/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除文档及其关联数据"""
    result = await db.execute(
        select(Document).join(Notebook).where(
            Document.id == document_id,
            Notebook.user_id == user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 获取 chunk_ids 用于删除向量
    from app.core.models import Chunk
    chunks_result = await db.execute(select(Chunk.id).where(Chunk.document_id == doc.id))
    chunk_ids = [row[0] for row in chunks_result.fetchall()]

    # 删除向量
    from app.services.vector_store import vector_store
    if chunk_ids:
        vector_store.delete_chunks(doc.notebook_id, chunk_ids)

    # 删除文件
    if os.path.exists(doc.filepath):
        os.remove(doc.filepath)

    # 删除数据库记录（级联删除 chunks）
    await db.delete(doc)
    await db.flush()


@router.put("/api/documents/{document_id}/content", response_model=UpdateDocumentResponse)
async def update_document(
    document_id: str,
    data: UpdateDocumentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """编辑文档内容：保存内容并标记为待向量化（不自动向量化）"""
    result = await db.execute(
        select(Document).join(Notebook).where(
            Document.id == document_id,
            Notebook.user_id == user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    try:
        # 保存新内容到文件
        new_content = data.content
        filepath = doc.filepath
        if not filepath or not os.path.exists(os.path.dirname(filepath)):
            # 笔记等没有文件路径的，创建新文件
            filepath = os.path.join(settings.UPLOAD_DIR, doc.notebook_id, doc.id, doc.filename)
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            doc.filepath = filepath
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)

        # 删除旧向量（ChromaDB）
        old_chunks_result = await db.execute(
            select(Chunk).where(Chunk.document_id == doc.id)
        )
        old_chunks = old_chunks_result.scalars().all()
        old_chunk_ids = [c.id for c in old_chunks]
        if old_chunk_ids:
            try:
                from app.services.vector_store import vector_store
                vector_store.delete_chunks(doc.notebook_id, old_chunk_ids)
            except Exception:
                pass

        # 删除旧 DB chunks
        for c in old_chunks:
            await db.delete(c)

        # 创建新 chunk（存完整内容，待向量化时再重新分块）
        from app.services.chunking_service import estimate_tokens
        new_chunk = Chunk(
            id=uuid.uuid4().hex,
            document_id=doc.id,
            content=new_content,
            chunk_index=0,
            token_count=estimate_tokens(new_content),
        )
        db.add(new_chunk)

        # 更新文档记录
        doc.file_size = len(new_content.encode("utf-8"))
        doc.chunk_count = 1
        doc.content_updated_at = datetime.now(timezone.utc)
        doc.needs_revectorize = 1
        doc.status = "completed"
        await db.flush()

        return UpdateDocumentResponse(
            document_id=doc.id,
            filename=doc.filename,
            chunk_count=doc.chunk_count,
            file_size=doc.file_size,
            status=doc.status,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新文档失败: {str(e)}")


@router.post("/api/documents/{document_id}/re-vectorize")
async def re_vectorize(
    document_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """重新向量化文档（用户编辑后主动触发）"""
    result = await db.execute(
        select(Document).join(Notebook).where(
            Document.id == document_id,
            Notebook.user_id == user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    try:
        result = await re_vectorize_document(db, doc)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"向量化失败: {str(e)}")


@router.put("/api/documents/{document_id}/move")
async def move_document(
    document_id: str,
    data: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """移动文档到指定文件夹（folder_id 为 null 表示移到根目录）"""
    result = await db.execute(
        select(Document).join(Notebook).where(
            Document.id == document_id,
            Notebook.user_id == user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    folder_id = data.get("folder_id")
    if folder_id:
        # 验证目标文件夹属于同一笔记本
        folder_result = await db.execute(
            select(Folder).where(
                Folder.id == folder_id,
                Folder.notebook_id == doc.notebook_id,
            )
        )
        if not folder_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="目标文件夹不存在")

    doc.folder_id = folder_id
    await db.flush()
    return {"document_id": doc.id, "folder_id": doc.folder_id}


@router.put("/api/documents/{document_id}", response_model=UpdateDocumentMetaResponse)
async def update_document_meta(
    document_id: str,
    data: UpdateDocumentMetaRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新文档元数据（文件名、所属文件夹）"""
    result = await db.execute(
        select(Document).join(Notebook).where(
            Document.id == document_id,
            Notebook.user_id == user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    if data.filename is not None:
        # 更新磁盘上的文件名
        old_path = doc.filepath
        new_path = os.path.join(os.path.dirname(old_path), data.filename)
        if os.path.exists(old_path):
            os.rename(old_path, new_path)
        doc.filepath = new_path
        doc.filename = data.filename

    if data.folder_id is not None:
        if data.folder_id:
            folder_result = await db.execute(
                select(Folder).where(
                    Folder.id == data.folder_id,
                    Folder.notebook_id == doc.notebook_id,
                )
            )
            if not folder_result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="目标文件夹不存在")
        doc.folder_id = data.folder_id

    await db.flush()
    return UpdateDocumentMetaResponse(
        id=doc.id,
        filename=doc.filename,
        folder_id=doc.folder_id,
    )
