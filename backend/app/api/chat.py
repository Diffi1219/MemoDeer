"""对话 API — SSE 流式问答"""
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.models import User, Notebook, ChatSession, ChatMessage
from app.core.schemas import ChatRequest, ChatSessionCreate, ChatSessionOut, ChatMessageOut
from app.api.auth import get_current_user, check_premium_status
from app.services.rag_service import (
    retrieve_context, stream_answer, stream_answer_open, stream_answer_fallback,
    stream_notebook_summary, sse_status, sse_source, RAG_DISTANCE_THRESHOLD,
)
from app.config import settings

router = APIRouter(tags=["对话"])


@router.post("/api/notebooks/{notebook_id}/chat")
async def chat(
    notebook_id: str,
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发送消息，返回 SSE 流式回答"""
    # 验证笔记本所有权
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    # 免费用户每日对话限制
    check_premium_status(user)
    if not user.is_premium:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        daily_count_result = await db.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.role == "user",
                ChatMessage.created_at >= today_start,
                ChatMessage.session_id.in_(
                    select(ChatSession.id).where(
                        ChatSession.notebook_id.in_(
                            select(Notebook.id).where(Notebook.user_id == user.id)
                        )
                    )
                ),
            )
        )
        daily_count = daily_count_result.scalar() or 0
        if daily_count >= settings.FREE_DAILY_CHAT_MESSAGES:
            raise HTTPException(
                status_code=403,
                detail=f"免费用户每日对话上限为 {settings.FREE_DAILY_CHAT_MESSAGES} 条，升级会员可无限对话",
            )

    # 获取或创建会话
    session_id = data.session_id
    if session_id:
        # 验证会话属于此笔记本
        sess_result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.notebook_id == notebook_id,
            )
        )
        session = sess_result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
    else:
        # 创建新会话
        session = ChatSession(
            id=uuid.uuid4().hex,
            notebook_id=notebook_id,
            title=data.message[:30] + ("..." if len(data.message) > 30 else ""),
        )
        db.add(session)
        await db.flush()
        session_id = session.id

    # 更新会话时间
    session.updated_at = datetime.utcnow()
    await db.flush()

    async def event_generator():
        # 向后兼容：如果前端仍传了 mode="open"，直接走自由问答
        if data.mode == "open":
            yield sse_status("正在思考...")
            try:
                async for sse_event in stream_answer_open(db, session_id, data.message):
                    yield sse_event
            except Exception as e:
                err_msg = str(e)
                if "Connection" in err_msg or "ConnectError" in err_msg:
                    err_msg = "无法连接 DeepSeek API，请检查网络或 API Key 是否有效"
                yield f"data: {json.dumps({'type': 'error', 'text': f'生成回答失败: {err_msg}'}, ensure_ascii=False)}\n\n"
            return

        # 默认：自动模式 — 先 RAG 检索，无结果则降级为自由问答
        # Step 1: 检索
        yield sse_status("正在搜索你的笔记...")
        try:
            all_chunks = await retrieve_context(notebook_id, data.message)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'text': f'检索失败: {str(e)}'}, ensure_ascii=False)}\n\n"
            return

        # Step 2: 按距离阈值过滤（BGE 余弦距离 ∈ [0, 2]，越小越相关）
        relevant_chunks = [c for c in all_chunks if c.get("distance", 1.0) < RAG_DISTANCE_THRESHOLD]

        # Step 3: 保存用户消息（只保存一次）
        user_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=data.message,
        )
        db.add(user_msg)
        await db.flush()

        # Step 4: 根据有无相关结果走不同分支
        if relevant_chunks:
            yield sse_status("正在基于你的笔记生成回答...")
            try:
                async for sse_event in stream_answer(
                    db, notebook_id, session_id, data.message, relevant_chunks, source="rag"
                ):
                    yield sse_event
            except Exception as e:
                err_msg = str(e)
                if "Connection" in err_msg or "ConnectError" in err_msg:
                    err_msg = "无法连接 DeepSeek API，请检查网络或 API Key 是否有效"
                yield f"data: {json.dumps({'type': 'error', 'text': f'生成回答失败: {err_msg}'}, ensure_ascii=False)}\n\n"
        else:
            yield sse_status("笔记中未找到相关内容，将基于通用知识回答")
            try:
                async for sse_event in stream_answer_fallback(db, session_id, data.message):
                    yield sse_event
            except Exception as e:
                err_msg = str(e)
                if "Connection" in err_msg or "ConnectError" in err_msg:
                    err_msg = "无法连接 DeepSeek API，请检查网络或 API Key 是否有效"
                yield f"data: {json.dumps({'type': 'error', 'text': f'生成回答失败: {err_msg}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.post("/api/notebooks/{notebook_id}/summarize")
async def summarize_notebook(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """生成笔记本摘要（SSE 流式，Flash 模型）"""
    # 验证笔记本所有权
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    async def event_generator():
        try:
            async for sse_event in stream_notebook_summary(db, notebook_id):
                yield sse_event
        except Exception as e:
            err_msg = str(e)
            if "Connection" in err_msg or "ConnectError" in err_msg:
                err_msg = "无法连接 DeepSeek API，请检查网络或 API Key 是否有效"
            yield f"data: {json.dumps({'type': 'error', 'text': f'生成摘要失败: {err_msg}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/api/notebooks/{notebook_id}/chat/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取笔记下的所有对话会话"""
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    sessions_result = await db.execute(
        select(ChatSession)
        .where(ChatSession.notebook_id == notebook_id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = sessions_result.scalars().all()

    outs = []
    for s in sessions:
        msg_count = await db.execute(
            select(func.count(ChatMessage.id)).where(ChatMessage.session_id == s.id)
        )
        mc = msg_count.scalar() or 0
        outs.append(ChatSessionOut(
            id=s.id,
            notebook_id=s.notebook_id,
            title=s.title,
            message_count=mc,
            created_at=s.created_at,
            updated_at=s.updated_at,
        ))
    return outs


@router.get("/api/notebooks/{notebook_id}/chat/sessions/{session_id}", response_model=list[ChatMessageOut])
async def get_session_messages(
    notebook_id: str,
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取会话的所有消息"""
    # 验证权限
    result = await db.execute(
        select(ChatSession).join(Notebook).where(
            ChatSession.id == session_id,
            ChatSession.notebook_id == notebook_id,
            Notebook.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="会话不存在")

    msgs_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = msgs_result.scalars().all()
    return [ChatMessageOut.model_validate(m) for m in messages]


@router.delete("/api/notebooks/{notebook_id}/chat/sessions/{session_id}", status_code=204)
async def delete_session(
    notebook_id: str,
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除会话"""
    result = await db.execute(
        select(ChatSession).join(Notebook).where(
            ChatSession.id == session_id,
            ChatSession.notebook_id == notebook_id,
            Notebook.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    await db.delete(session)
    await db.flush()
