"""Pydantic 请求/响应 Schema"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ─── 用户 ───────────────────────────────────────────

class UserRegister(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    display_name: str = ""


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    display_name: str
    is_premium: bool = False
    premium_type: str = "free"
    premium_expire_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── 笔记本 ─────────────────────────────────────────

class NotebookCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""


class NotebookUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class NotebookOut(BaseModel):
    id: str
    title: str
    description: str
    document_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotebookDetail(NotebookOut):
    documents: List["DocumentOut"] = []


# ─── 文档 ───────────────────────────────────────────

class DocumentOut(BaseModel):
    id: str
    notebook_id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    error_msg: Optional[str] = None
    chunk_count: int
    folder_id: Optional[str] = None
    needs_revectorize: int = 0
    content_updated_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentStatus(BaseModel):
    id: str
    status: str
    error_msg: Optional[str] = None


# ─── 对话 ───────────────────────────────────────────

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "新对话"


class ChatSessionOut(BaseModel):
    id: str
    notebook_id: str
    title: str
    message_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    session_id: Optional[str] = None  # None = 创建新会话
    message: str = Field(..., min_length=1)
    mode: Optional[str] = Field(default=None, pattern="^(rag|open)$")  # 已废弃，保留向后兼容


class ChatMessageOut(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    citations: str = "[]"
    source: str = "rag"
    created_at: datetime

    class Config:
        from_attributes = True


# ─── 检索 ───────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str = ""
    document_name: str
    content: str
    score: float


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]


# ─── 全局搜索 ────────────────────────────────────────

class GlobalSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)


class NotebookSearchResult(BaseModel):
    notebook_id: str
    notebook_title: str
    match_count: int
    chunks: List[SearchResult]


class GlobalSearchResponse(BaseModel):
    query: str
    notebooks: List[NotebookSearchResult]


# ─── 添加笔记 ─────────────────────────────────────────

class AddNoteRequest(BaseModel):
    content: str = Field(..., min_length=1)
    title: Optional[str] = None


class AddNoteResponse(BaseModel):
    document_id: str
    notebook_id: str
    filename: str
    status: str


# ─── 更新文档内容 ─────────────────────────────────────

class UpdateDocumentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=500000)


class UpdateDocumentResponse(BaseModel):
    document_id: str
    filename: str
    chunk_count: int
    file_size: int
    status: str


# ─── 会员 ───────────────────────────────────────────

class UpgradePremiumRequest(BaseModel):
    plan: str = Field(..., pattern="^(monthly|lifetime)$")  # 月购 / 终身


class UserUpgradeResponse(BaseModel):
    user: UserOut
    message: str = "升级成功"
    order_id: str = ""


# ─── 支付订单 ─────────────────────────────────────────

class PaymentOrderCreate(BaseModel):
    plan: str = Field(..., pattern="^(monthly|lifetime)$")


class PaymentOrderOut(BaseModel):
    id: str
    plan: str
    amount: str
    status: str
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentConfirmResponse(BaseModel):
    user: UserOut
    order: PaymentOrderOut
    message: str = "支付成功"


# ─── 出题 ───────────────────────────────────────────

class QuizGenerateRequest(BaseModel):
    question_type: str = Field(default="mixed", pattern="^(choice|fill|mixed)$")
    count: int = Field(default=5, ge=3, le=10)
    knowledge_point_ids: List[str] = []


class QuizQuestion(BaseModel):
    id: str
    type: str  # "choice" or "fill"
    question: str
    options: Optional[List[str]] = None  # 选择题选项
    answer: str
    explanation: str
    knowledge_point_id: Optional[str] = None  # 题目关联的知识点 ID，用于错题追踪


class QuizGenerateResponse(BaseModel):
    notebook_id: str
    questions: List[QuizQuestion]
    generated_at: str


# ─── 知识卡片 & 记忆口诀 ───────────────────────────

class KnowledgeCardItem(BaseModel):
    id: str
    title: str
    front: str
    back: str
    tags: List[str] = []
    knowledge_point_id: str = ""
    document_id: str = ""
    document_name: str = ""
    chunk_id: str = ""


class MnemonicItem(BaseModel):
    id: str
    title: str
    content: str
    source_doc: str = ""
    tip: str = ""


class PremiumGenerateRequest(BaseModel):
    document_ids: List[str] = []  # 空列表 = 使用全部文档


class PremiumGenerateResponse(BaseModel):
    notebook_id: str
    cards: List[KnowledgeCardItem] = []
    mnemonics: List[MnemonicItem] = []
    generated_at: str


class KnowledgeCardUpdateRequest(BaseModel):
    title: Optional[str] = None
    front: Optional[str] = None
    back: Optional[str] = None
    tags: Optional[str] = None  # JSON 字符串


class KnowledgeCardsResponse(BaseModel):
    notebook_id: str
    cards: List[KnowledgeCardItem] = []


# ─── 用户统计 ─────────────────────────────────────────

class UserStatsResponse(BaseModel):
    notebook_count: int = 0
    document_count: int = 0
    chat_count: int = 0
    created_at: datetime


# ─── 文件夹 ─────────────────────────────────────────

class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    parent_id: Optional[str] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None


class FolderOut(BaseModel):
    id: str
    notebook_id: str
    parent_id: Optional[str] = None
    name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── 文件树 ─────────────────────────────────────────

class FileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    content: str = ""
    folder_id: Optional[str] = None


class TreeNode(BaseModel):
    type: str  # "folder" | "document"
    id: str
    name: str
    parent_id: Optional[str] = None
    folder_id: Optional[str] = None
    file_type: Optional[str] = None  # only for documents
    status: Optional[str] = None  # only for documents
    needs_revectorize: Optional[int] = 0
    children: List["TreeNode"] = []


class NotebookTreeResponse(BaseModel):
    notebook_id: str
    tree: List[TreeNode]


# ─── 向量化队列 ─────────────────────────────────────

class PendingVectorizationItem(BaseModel):
    document_id: str
    filename: str
    content_updated_at: Optional[datetime] = None


class PendingVectorizationResponse(BaseModel):
    notebook_id: str
    items: List[PendingVectorizationItem]


# ─── 更新文档元数据 ─────────────────────────────────

class UpdateDocumentMetaRequest(BaseModel):
    filename: Optional[str] = None
    folder_id: Optional[str] = None


class UpdateDocumentMetaResponse(BaseModel):
    id: str
    filename: str
    folder_id: Optional[str] = None


# ─── 知识点 ─────────────────────────────────────────

class KnowledgePointOut(BaseModel):
    id: str
    notebook_id: str
    document_id: Optional[str] = None
    title: str
    content: str
    tags: str = "[]"
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgePointExtractResponse(BaseModel):
    notebook_id: str
    points_count: int
    points: List[KnowledgePointOut]


# ─── 批量提取知识点 ─────────────────────────────────

class BatchExtractRequest(BaseModel):
    notebook_ids: List[str] = Field(..., min_length=1, max_length=20)


class BatchExtractItem(BaseModel):
    notebook_id: str
    success: bool
    points_count: int = 0
    error: str = ""


class BatchExtractResponse(BaseModel):
    results: List[BatchExtractItem]
    total_points: int = 0


# ─── 选中文字问答 ─────────────────────────────────────

class AskSelectionRequest(BaseModel):
    selected_text: str = Field(..., min_length=1, max_length=5000)
    question: str = Field(..., min_length=1, max_length=500)


class AskSelectionResponse(BaseModel):
    answer: str
