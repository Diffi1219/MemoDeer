"""应用配置"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # 应用
    APP_NAME: str = "MemoDeer API"
    DEBUG: bool = True

    # 数据库
    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR / 'data' / 'memo_deer.db'}"
    DATABASE_URL_SYNC: str = f"sqlite:///{BASE_DIR / 'data' / 'memo_deer.db'}"

    # 文件存储
    UPLOAD_DIR: str = str(BASE_DIR / "data" / "uploads")
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB

    # ChromaDB
    CHROMA_DIR: str = str(BASE_DIR / "data" / "chroma_db")

    # JWT
    JWT_SECRET: str = "memo-deer-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7天

    # DeepSeek / LLM API
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"

    # LLM 模型选择
    # Flash: 轻量任务（知识点提取、文本结构化），低成本，可切换为本地 8B 模型
    LLM_FLASH_MODEL: str = "deepseek-v4-flash"
    # Pro: 强推理任务（RAG 问答、复杂逻辑解答），需要最强模型
    LLM_PRO_MODEL: str = "deepseek-v4-pro"
    # 本地 8B 模型接口（Ollama），预留 — 部署后设为 http://localhost:11434/v1
    LLM_LOCAL_BASE_URL: str = ""
    LLM_LOCAL_MODEL: str = "qwen3:8b"

    # Embedding 模型
    # - EMBEDDING_MODEL: 模型身份（哪个模型），例如 "BAAI/bge-small-zh-v1.5"
    # - EMBEDDING_LOCAL_DIR: 离线缓存位置（可选）。留空 = 自动派生为
    #   backend/models/<模型简称>/（即 BASE_DIR/models/<safe_name>）。
    #   相对路径以 BASE_DIR (即 backend/) 为基准。
    # 加载顺序见 backend/app/services/embedding_service.py
    EMBEDDING_MODEL: str = "BAAI/bge-small-zh-v1.5"
    EMBEDDING_LOCAL_DIR: str = "./models/bge-small-zh-v1.5"

    # HuggingFace 镜像端点（国内加速，留空用官方）
    HF_ENDPOINT: str = "https://hf-mirror.com"

    # 分块参数
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # 检索参数
    RETRIEVAL_TOP_K: int = 8

    # 免费用户限制
    FREE_MAX_NOTEBOOKS: int = 3       # 最多笔记本数
    FREE_MAX_DOCUMENTS_PER_NOTEBOOK: int = 5  # 每笔记本最多文档数
    FREE_DAILY_CHAT_MESSAGES: int = 10  # 每日最多对话消息数

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
