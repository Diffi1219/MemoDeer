"""Embedding 服务 — 文本向量化

加载顺序（懒加载，仅在首次调用 .model 时执行）：
  1. EMBEDDING_LOCAL_DIR（如果存在且非空）→ 纯本地加载，零网络
  2. HuggingFace 全局缓存 ~/.cache/huggingface/hub/ → 纯本地加载
  3. 都没有 → 从 HF_ENDPOINT 镜像下载到全局缓存
切模型请用 scripts/download_embedding.py。
"""
import os
from pathlib import Path
from typing import List
from sentence_transformers import SentenceTransformer
from app.config import settings, BASE_DIR


def _safe_name(model_id: str) -> str:
    """`BAAI/bge-small-zh-v1.5` → `bge-small-zh-v1.5`"""
    return model_id.split("/")[-1] if "/" in model_id else model_id


def _resolve_local_dir() -> Path:
    """解析 EMBEDDING_LOCAL_DIR：留空则自动派生到 backend/models/<safe-name>/"""
    raw = settings.EMBEDDING_LOCAL_DIR.strip()
    if raw:
        p = Path(raw)
    else:
        p = BASE_DIR / "models" / _safe_name(settings.EMBEDDING_MODEL)
    if not p.is_absolute():
        p = BASE_DIR / p
    return p


class EmbeddingService:
    """文本向量化服务（本地 CPU 运行，无需 GPU）"""

    def __init__(self):
        self._model: SentenceTransformer = None
        self._source: str = None  # 记录实际从哪加载的，便于排查

    @property
    def model(self) -> SentenceTransformer:
        if self._model is not None:
            return self._model

        # 确保 HF 镜像在首次联网前已设置
        if settings.HF_ENDPOINT and not os.environ.get("HF_ENDPOINT"):
            os.environ["HF_ENDPOINT"] = settings.HF_ENDPOINT

        # Tier 1: 显式本地目录
        local = _resolve_local_dir()
        if local.exists() and any(local.iterdir()):
            try:
                self._model = SentenceTransformer(str(local), local_files_only=True)
                self._source = f"local:{local}"
                print(f"[Embedding] loaded from local dir: {local}")
                return self._model
            except Exception as e:
                print(f"[Embedding] local dir {local} exists but load failed: {e}")
                # 继续往下走，不阻塞

        # Tier 2: HF 全局缓存
        try:
            self._model = SentenceTransformer(
                settings.EMBEDDING_MODEL, local_files_only=True
            )
            self._source = f"hf-cache:{settings.EMBEDDING_MODEL}"
            print(f"[Embedding] loaded from HF cache: {settings.EMBEDDING_MODEL}")
            return self._model
        except Exception:
            pass  # 全局缓存里也没有，进入下载

        # Tier 3: 下载到全局缓存
        self._model = SentenceTransformer(
            settings.EMBEDDING_MODEL, local_files_only=False
        )
        self._source = f"downloaded:{settings.EMBEDDING_MODEL}"
        print(f"[Embedding] downloaded from mirror to HF cache: {settings.EMBEDDING_MODEL}")
        return self._model

    @property
    def source(self) -> str:
        """加载来源（用于调试/诊断），首次访问 .model 后才有值"""
        return self._source

    def embed(self, texts: List[str]) -> List[List[float]]:
        """批量文本 → 向量"""
        if not texts:
            return []
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    def embed_query(self, text: str) -> List[float]:
        """单条查询文本 → 向量"""
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    @property
    def dimension(self) -> int:
        # sentence-transformers 5.x renamed this method; fall back for 4.x
        model = self.model
        if hasattr(model, "get_embedding_dimension"):
            return model.get_embedding_dimension()
        return model.get_sentence_embedding_dimension()


# 单例
embedding_service = EmbeddingService()
