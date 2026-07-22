"""ChromaDB 向量存储 — 封装增删查操作"""
import os
import uuid
from typing import List, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.config import settings


class VectorStore:
    """ChromaDB 向量存储管理器

    每个笔记本一个 collection，便于隔离和删除。
    collection 命名: notebook_{notebook_id}
    """

    def __init__(self):
        os.makedirs(settings.CHROMA_DIR, exist_ok=True)
        self._client = chromadb.PersistentClient(
            path=settings.CHROMA_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    def _collection_name(self, notebook_id: str) -> str:
        """根据 notebook_id 生成 collection 名"""
        # ChromaDB collection 名只能包含字母、数字、_、-
        safe_id = notebook_id.replace("-", "_")
        return f"nb_{safe_id}"

    def get_or_create_collection(self, notebook_id: str):
        """获取或创建笔记本对应的 collection（使用余弦距离）"""
        name = self._collection_name(notebook_id)
        return self._client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def delete_collection(self, notebook_id: str):
        """删除笔记本对应的 collection"""
        name = self._collection_name(notebook_id)
        try:
            self._client.delete_collection(name)
        except Exception:
            pass  # collection 可能不存在

    def add_chunks(
        self,
        notebook_id: str,
        chunk_ids: List[str],
        texts: List[str],
        embeddings: List[List[float]],
        metadatas: List[dict],
    ):
        """批量添加文本块到向量库"""
        collection = self.get_or_create_collection(notebook_id)
        collection.add(
            ids=chunk_ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    def delete_chunks(self, notebook_id: str, chunk_ids: List[str]):
        """删除指定文本块"""
        collection = self.get_or_create_collection(notebook_id)
        try:
            collection.delete(ids=chunk_ids)
        except Exception:
            pass

    def search(
        self,
        notebook_id: str,
        query_embedding: List[float],
        top_k: int = 8,
    ) -> List[dict]:
        """语义搜索，返回 top_k 个最相似的文本块

        Returns:
            [{id, content, metadata, score}, ...]
        """
        collection = self.get_or_create_collection(notebook_id)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        output = []
        if results["ids"] and results["ids"][0]:
            for i, chunk_id in enumerate(results["ids"][0]):
                output.append({
                    "id": chunk_id,
                    "content": results["documents"][0][i] if results["documents"] else "",
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else 0,
                })

        return output

    def count(self, notebook_id: str) -> int:
        """获取 collection 中的文档数"""
        collection = self.get_or_create_collection(notebook_id)
        return collection.count()


# 单例
vector_store = VectorStore()
