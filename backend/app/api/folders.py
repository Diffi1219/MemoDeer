"""文件夹 CRUD API"""
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.models import User, Notebook, Folder, Document
from app.core.schemas import FolderCreate, FolderUpdate, FolderOut
from app.api.auth import get_current_user

router = APIRouter(prefix="/api", tags=["文件夹"])


async def _get_user_folder(db: AsyncSession, folder_id: str, user_id: str) -> Folder:
    """获取属于当前用户的文件夹，否则404"""
    result = await db.execute(
        select(Folder).join(Notebook).where(
            Folder.id == folder_id,
            Notebook.user_id == user_id,
        )
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    return folder


@router.post("/notebooks/{notebook_id}/folders", response_model=FolderOut, status_code=201)
async def create_folder(
    notebook_id: str,
    data: FolderCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """在笔记本中创建文件夹"""
    # 验证笔记本所有权
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    # 验证父文件夹（如果指定）
    if data.parent_id:
        parent = await db.execute(
            select(Folder).where(
                Folder.id == data.parent_id,
                Folder.notebook_id == notebook_id,
            )
        )
        if not parent.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="父文件夹不存在")

    folder = Folder(
        id=uuid.uuid4().hex,
        notebook_id=notebook_id,
        parent_id=data.parent_id,
        name=data.name.strip(),
    )
    db.add(folder)
    await db.flush()

    return FolderOut(
        id=folder.id,
        notebook_id=folder.notebook_id,
        parent_id=folder.parent_id,
        name=folder.name,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
    )


@router.put("/folders/{folder_id}", response_model=FolderOut)
async def update_folder(
    folder_id: str,
    data: FolderUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """重命名或移动文件夹"""
    folder = await _get_user_folder(db, folder_id, user.id)

    if data.name is not None:
        folder.name = data.name.strip()
    if data.parent_id is not None:
        # 防止循环引用：不能把自己或子文件夹设为父级
        if data.parent_id == folder_id:
            raise HTTPException(status_code=400, detail="不能将文件夹设为自身的子文件夹")
        if data.parent_id:
            parent = await _get_user_folder(db, data.parent_id, user.id)
            if parent.notebook_id != folder.notebook_id:
                raise HTTPException(status_code=400, detail="不能移动到其他笔记本的文件夹下")
        folder.parent_id = data.parent_id

    await db.flush()

    return FolderOut(
        id=folder.id,
        notebook_id=folder.notebook_id,
        parent_id=folder.parent_id,
        name=folder.name,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
    )


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除文件夹（级联：子文件夹的文档 folder_id 置空，子文件夹递归删除）"""
    folder = await _get_user_folder(db, folder_id, user.id)

    # 将文件夹内的文档 folder_id 置空
    docs_result = await db.execute(
        select(Document).where(Document.folder_id == folder_id)
    )
    for doc in docs_result.scalars().all():
        doc.folder_id = None

    # 递归删除子文件夹（ORM relationship cascade 处理）
    await db.delete(folder)
    await db.flush()
