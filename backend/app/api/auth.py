"""用户认证 API — 注册、登录、获取当前用户"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings
from app.core.database import get_db
from app.core.models import User
from app.core.schemas import UserRegister, UserLogin, UserOut, TokenOut, UpgradePremiumRequest, UserUpgradeResponse, UserStatsResponse, AskSelectionRequest, AskSelectionResponse

router = APIRouter(prefix="/api/auth", tags=["认证"])
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def check_premium_status(user: User) -> None:
    """检查并自动撤销过期会员（月购到期降级为 free）"""
    if user.is_premium and user.premium_type == "monthly" and user.premium_expire_at:
        if user.premium_expire_at < datetime.utcnow():
            user.is_premium = 0
            user.premium_type = "free"
            user.premium_expire_at = None


def create_token(user_id: str) -> str:
    """生成 JWT token"""
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> str:
    """验证 JWT token，返回 user_id"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token无效或已过期，请重新登录")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """获取当前登录用户（作为 FastAPI 依赖）"""
    user_id = verify_token(credentials.credentials)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


async def require_premium(user: User = Depends(get_current_user)) -> User:
    """依赖注入：要求用户为有效会员（月购未过期 or 终身）"""
    check_premium_status(user)
    if not user.is_premium:
        raise HTTPException(status_code=403, detail="此功能需要高级会员，请先升级")
    return user


@router.post("/register", response_model=TokenOut)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    # 检查用户名是否已存在
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 创建用户
    user = User(
        username=data.username,
        password_hash=pwd_context.hash(data.password),
        display_name=data.display_name or data.username,
        is_premium=0,
        premium_type="free",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 生成 token
    token = create_token(user.id)
    return TokenOut(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenOut)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_token(user.id)
    return TokenOut(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """获取当前用户信息（自动检查会员过期）"""
    check_premium_status(user)
    await db.flush()
    return UserOut.model_validate(user)


@router.post("/user/upgrade-premium", response_model=UserUpgradeResponse)
async def upgrade_premium(
    data: UpgradePremiumRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """模拟升级会员 — 直接设置 is_premium 标志"""
    user.is_premium = 1
    user.premium_type = data.plan  # "monthly" 或 "lifetime"

    if data.plan == "monthly":
        user.premium_expire_at = datetime.utcnow() + timedelta(days=30)
    else:  # lifetime
        user.premium_expire_at = None  # 永久有效

    await db.flush()

    msg = "月购会员已开通，有效期30天" if data.plan == "monthly" else "终身会员已开通，永久有效"
    return UserUpgradeResponse(
        user=UserOut.model_validate(user),
        message=msg,
    )


@router.get("/user/stats", response_model=UserStatsResponse)
async def get_user_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户统计信息"""
    from app.core.models import Notebook, Document, ChatSession

    # 笔记本数
    nb_result = await db.execute(
        select(func.count(Notebook.id)).where(Notebook.user_id == user.id)
    )
    notebook_count = nb_result.scalar() or 0

    # 文档数
    doc_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.notebook_id.in_(
                select(Notebook.id).where(Notebook.user_id == user.id)
            )
        )
    )
    document_count = doc_result.scalar() or 0

    # 对话数
    chat_result = await db.execute(
        select(func.count(ChatSession.id)).where(
            ChatSession.notebook_id.in_(
                select(Notebook.id).where(Notebook.user_id == user.id)
            )
        )
    )
    chat_count = chat_result.scalar() or 0

    return UserStatsResponse(
        notebook_count=notebook_count,
        document_count=document_count,
        chat_count=chat_count,
        created_at=user.created_at,
    )


@router.post("/ask", response_model=AskSelectionResponse)
async def ask_selection(
    data: AskSelectionRequest,
    user: User = Depends(get_current_user),
):
    """选中文字问答：将用户选中的文字和问题发给 Flash LLM 获取解答"""
    from app.services.llm_service import llm_service

    system_prompt = """你是一个 AI 学习助手。用户会提供一段学习资料中的文字和一个问题，请根据文字内容和你的通用知识来回答用户的问题。

要求：
1. 优先根据提供的文字内容回答
2. 如果文字中不包含足够信息来回答用户的具体问题，你可以结合通用知识补充
3. 如果用了通用知识，请明确告知用户（如\"资料中没有相关内容，以下回答基于通用知识\"）
4. 回答要简洁清晰，用中文"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"以下是我选中的学习资料内容：\n\n{data.selected_text}\n\n我的问题是：{data.question}"},
    ]

    try:
        response = await llm_service.flash.chat(
            messages, stream=False, temperature=0.4, max_tokens=1024
        )
        return AskSelectionResponse(answer=response.strip() if response else "AI 暂时无法回答，请稍后重试")
    except Exception as e:
        return AskSelectionResponse(answer=f"AI 请求失败: {str(e)[:200]}")
