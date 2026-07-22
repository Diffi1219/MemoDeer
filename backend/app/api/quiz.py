"""出题 API — AI 生成练习题 + 错题统计（高级会员功能）"""
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.models import User, Notebook, KnowledgePoint, QuizAttempt
from app.core.schemas import QuizGenerateRequest, QuizGenerateResponse, QuizQuestion
from app.api.auth import get_current_user, require_premium

router = APIRouter(prefix="/api", tags=["智能出题"])


@router.post("/notebooks/{notebook_id}/quiz/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    notebook_id: str,
    data: QuizGenerateRequest,
    user: User = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    """使用 Flash LLM 真实生成练习题（需高级会员）"""
    # 验证笔记本所有权
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记本不存在")

    # 收集知识点内容
    knowledge_context = ""
    if data.knowledge_point_ids:
        kp_result = await db.execute(
            select(KnowledgePoint).where(
                KnowledgePoint.notebook_id == notebook_id,
                KnowledgePoint.id.in_(data.knowledge_point_ids)
            )
        )
        kps = kp_result.scalars().all()
    else:
        kp_result = await db.execute(
            select(KnowledgePoint).where(KnowledgePoint.notebook_id == notebook_id)
        )
        kps = kp_result.scalars().all()

    if kps:
        knowledge_context = "\n\n".join([f"知识点：{kp.title}\n内容：{kp.content}" for kp in kps])

    if not knowledge_context:
        # 回退：从文档 chunks 取内容
        from app.core.models import Document, Chunk
        docs_result = await db.execute(
            select(Document).where(Document.notebook_id == notebook_id, Document.status == "completed")
        )
        docs = docs_result.scalars().all()
        parts = []
        for doc in docs:
            chunks_result = await db.execute(
                select(Chunk).where(Chunk.document_id == doc.id).order_by(Chunk.chunk_index).limit(3)
            )
            for c in chunks_result.scalars().all():
                parts.append(c.content)
        knowledge_context = "\n\n".join(parts[:10])

    if not knowledge_context or len(knowledge_context.strip()) < 20:
        raise HTTPException(status_code=400, detail="笔记本没有足够的内容生成题目，请先添加文档或生成知识卡片")

    # 截断
    if len(knowledge_context) > 8000:
        knowledge_context = knowledge_context[:8000] + "\n...(截断)"

    question_type_desc = {"choice": "全部选择题", "fill": "全部填空题", "mixed": "选择题和填空题混合"}
    qtype = question_type_desc.get(data.question_type, "选择题和填空题混合")

    # 构建知识点 ID 映射，让 LLM 可以为每道题标注所属知识点
    kp_id_mapping = ""
    if kps:
        kp_lines = [f"- [{kp.id}] {kp.title}" for kp in kps]
        kp_id_mapping = "知识点列表（请为每道题选择最相关的知识点 ID）：\n" + "\n".join(kp_lines[:20])

    system_prompt = f"""你是一个教育领域的出题专家。根据提供的知识点/学习资料生成 {data.count} 道练习题，题型为{qtype}。

要求：
1. 题目必须基于提供的资料内容，不要编造
2. 选择题：4个选项（A/B/C/D），恰好一个正确答案
3. 填空题：答案简洁明确（1-10个字）
4. 每道题附带简短解析（40字以内）
5. 输出纯 JSON 数组，不要加 markdown 标记

{kp_id_mapping}

输出格式（每道题需包含 knowledge_point_id 字段）：
[
  {{"type":"choice","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","knowledge_point_id":"..."}},
  {{"type":"fill","question":"...是____。","options":null,"answer":"答案","explanation":"...","knowledge_point_id":"..."}}
]"""

    from app.services.llm_service import llm_service
    try:
        response = await llm_service.flash.chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"学习资料：\n\n{knowledge_context}"},
            ],
            stream=False, temperature=0.7, max_tokens=4096,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 调用失败: {str(e)}")

    # 解析 JSON
    try:
        jstr = response.strip()
        if "```" in jstr:
            jstr = jstr.split("```")[1]
            if jstr.startswith("json"):
                jstr = jstr[4:]
        questions_data = json.loads(jstr)
        if not isinstance(questions_data, list):
            raise ValueError("非数组")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 输出格式异常: {str(e)[:200]}")

    from datetime import datetime
    questions = []
    # 建立知识点 ID 集合用于校验 LLM 返回的 knowledge_point_id
    valid_kp_ids = {kp.id for kp in kps} if kps else set()
    for i, qd in enumerate(questions_data[:data.count]):
        kp_id = qd.get("knowledge_point_id", "")
        # 校验 knowledge_point_id 是否有效，无效则置空
        if kp_id not in valid_kp_ids:
            kp_id = ""
        questions.append(QuizQuestion(
            id=f"q{i+1}",
            type=qd.get("type", "choice"),
            question=qd.get("question", ""),
            options=qd.get("options"),
            answer=qd.get("answer", ""),
            explanation=qd.get("explanation", ""),
            knowledge_point_id=kp_id or None,
        ))

    return QuizGenerateResponse(
        notebook_id=notebook_id,
        questions=questions,
        generated_at=datetime.utcnow().isoformat(),
    )


# ──────────────── 提交答题结果 ────────────────

@router.post("/notebooks/{notebook_id}/quiz/submit")
async def submit_quiz_results(
    notebook_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """提交答题结果，记录错题"""
    answers: list = body.get("answers", [])
    if not answers:
        raise HTTPException(status_code=400, detail="无答题数据")

    saved = 0
    for a in answers:
        q = QuizAttempt(
            id=uuid.uuid4().hex,
            user_id=user.id,
            notebook_id=notebook_id,
            knowledge_point_id=a.get("knowledge_point_id"),
            question=a.get("question", "")[:500],
            user_answer=a.get("user_answer", "")[:500],
            correct_answer=a.get("correct_answer", "")[:500],
            explanation=a.get("explanation", "")[:500],
            is_correct=bool(a.get("is_correct", False)),
        )
        db.add(q)
        saved += 1

    await db.flush()
    return {"saved": saved}


# ──────────────── 错题统计 ────────────────

@router.get("/notebooks/{notebook_id}/quiz/wrong-stats")
async def get_wrong_stats(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取笔记本中每个知识点的错题数量"""
    rows = await db.execute(
        select(
            QuizAttempt.knowledge_point_id,
            func.count(QuizAttempt.id).label("wrong_count"),
        )
        .where(
            QuizAttempt.user_id == user.id,
            QuizAttempt.notebook_id == notebook_id,
            QuizAttempt.is_correct == False,
            QuizAttempt.knowledge_point_id.isnot(None),
        )
        .group_by(QuizAttempt.knowledge_point_id)
    )
    stats = {row[0]: row[1] for row in rows.fetchall()}
    return {"wrong_counts": stats}


@router.get("/notebooks/{notebook_id}/quiz/wrong-answers")
async def get_wrong_answers(
    notebook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取笔记本所有错题列表"""
    result = await db.execute(
        select(QuizAttempt)
        .where(
            QuizAttempt.user_id == user.id,
            QuizAttempt.notebook_id == notebook_id,
            QuizAttempt.is_correct == False,
        )
        .order_by(QuizAttempt.created_at.desc())
        .limit(100)
    )
    attempts = result.scalars().all()
    return {
        "wrong_answers": [
            {
                "id": a.id,
                "question": a.question,
                "user_answer": a.user_answer,
                "correct_answer": a.correct_answer,
                "explanation": a.explanation,
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in attempts
        ]
    }


@router.get("/quiz/global-wrong-answers")
async def get_global_wrong_answers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户所有错题（跨笔记本）"""
    result = await db.execute(
        select(QuizAttempt)
        .where(
            QuizAttempt.user_id == user.id,
            QuizAttempt.is_correct == False,
        )
        .order_by(QuizAttempt.created_at.desc())
        .limit(200)
    )
    attempts = result.scalars().all()
    return {
        "wrong_answers": [
            {
                "id": a.id,
                "notebook_id": a.notebook_id,
                "question": a.question,
                "user_answer": a.user_answer,
                "correct_answer": a.correct_answer,
                "explanation": a.explanation,
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in attempts
        ]
    }


# ──────────────── 删除错题 ────────────────

@router.delete("/notebooks/{notebook_id}/quiz/wrong-answers/{attempt_id}")
async def delete_wrong_answer(
    notebook_id: str,
    attempt_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除单条错题记录（通过 notebook_id 和 attempt_id 定位）"""
    # 直接查询 quiz_attempts 表
    row = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.id == attempt_id,
            QuizAttempt.user_id == user.id,
        )
    )
    attempt = row.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="错题记录不存在")
    await db.delete(attempt)
    await db.flush()
    return {"deleted": True, "id": attempt_id}


@router.delete("/notebooks/{notebook_id}/quiz/wrong-answers")
async def delete_wrong_answers_batch(
    notebook_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """批量删除错题记录"""
    ids: list = body.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="请提供要删除的错题 ID 列表")
    result = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.id.in_(ids),
            QuizAttempt.user_id == user.id,
            QuizAttempt.notebook_id == notebook_id,
        )
    )
    attempts = result.scalars().all()
    for a in attempts:
        await db.delete(a)
    await db.flush()
    return {"deleted": len(attempts)}
