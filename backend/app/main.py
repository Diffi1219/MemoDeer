"""FastAPI 应用入口"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.core.database import init_db
from app.utils.exceptions import AppException


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化数据库 + 配置 HF 镜像"""
    # HuggingFace 镜像：必须在 sentence_transformers / huggingface_hub 加载模型前设置
    if hasattr(settings, "HF_ENDPOINT") and settings.HF_ENDPOINT:
        os.environ["HF_ENDPOINT"] = settings.HF_ENDPOINT
        print(f"[Startup] HuggingFace 镜像: {settings.HF_ENDPOINT}")
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — 允许多设备（PC/手机）跨域访问
# 注意：使用 JWT Bearer Token 鉴权，不需要 cookie 凭证，
# 因此 allow_credentials=False，与 allow_origins=["*"] 兼容
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全局异常处理
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "error": str(exc.detail) if exc.detail else None},
    )


# 注册路由
from app.api.auth import router as auth_router
from app.api.notebooks import router as notebooks_router
from app.api.documents import router as documents_router
from app.api.folders import router as folders_router
from app.api.chat import router as chat_router
from app.api.search import router as search_router
from app.api.quiz import router as quiz_router
from app.api.premium import router as premium_router
from app.api.payment import router as payment_router

app.include_router(auth_router)
app.include_router(notebooks_router)
app.include_router(documents_router)
app.include_router(folders_router)
app.include_router(chat_router)
app.include_router(search_router)
app.include_router(quiz_router)
app.include_router(premium_router)
app.include_router(payment_router)


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
