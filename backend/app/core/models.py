"""SQLAlchemy ORM 数据模型"""
import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, Text, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id = Column(Text, primary_key=True, default=_uuid)
    username = Column(Text, nullable=False, unique=True, index=True)
    password_hash = Column(Text, nullable=False)
    display_name = Column(Text, default="")
    is_premium = Column(Integer, default=0)  # 0=免费 1=会员
    premium_type = Column(Text, default="free")  # "free" | "monthly" | "lifetime"
    premium_expire_at = Column(DateTime, nullable=True)  # 月购到期时间，终身会员为 null
    created_at = Column(DateTime, default=_now)

    notebooks = relationship("Notebook", back_populates="user", cascade="all, delete-orphan")
    payment_orders = relationship("PaymentOrder", back_populates="user", cascade="all, delete-orphan")


class Notebook(Base):
    __tablename__ = "notebooks"

    id = Column(Text, primary_key=True, default=_uuid)
    user_id = Column(Text, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User", back_populates="notebooks")
    folders = relationship("Folder", back_populates="notebook", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="notebook", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="notebook", cascade="all, delete-orphan")
    knowledge_points = relationship("KnowledgePoint", back_populates="notebook", cascade="all, delete-orphan")


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Text, primary_key=True, default=_uuid)
    notebook_id = Column(Text, ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(Text, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    notebook = relationship("Notebook", back_populates="folders")
    parent = relationship("Folder", remote_side="Folder.id", back_populates="children")
    children = relationship(
        "Folder", back_populates="parent",
        cascade="all, delete-orphan", single_parent=True,
    )
    documents = relationship("Document", back_populates="folder")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Text, primary_key=True, default=_uuid)
    notebook_id = Column(Text, ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True)
    folder_id = Column(Text, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True)
    filename = Column(Text, nullable=False)
    filepath = Column(Text, nullable=False)
    file_type = Column(Text, nullable=False)  # pdf, txt, md, docx
    file_size = Column(Integer, nullable=False)
    status = Column(Text, default="pending")  # pending → processing → completed / error
    error_msg = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    needs_revectorize = Column(Integer, default=0)  # 0=无需向量化, 1=待向量化
    content_updated_at = Column(DateTime, nullable=True)  # 内容最后修改时间
    created_at = Column(DateTime, default=_now)

    notebook = relationship("Notebook", back_populates="documents")
    folder = relationship("Folder", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Text, primary_key=True, default=_uuid)
    document_id = Column(Text, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    token_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_now)

    document = relationship("Document", back_populates="chunks")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Text, primary_key=True, default=_uuid)
    notebook_id = Column(Text, ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, default="新对话")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    notebook = relationship("Notebook", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Text, primary_key=True, default=_uuid)
    session_id = Column(Text, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Text, nullable=False)  # user / assistant
    content = Column(Text, nullable=False)
    citations = Column(Text, default="[]")  # JSON
    source = Column(Text, default="rag")  # rag / open
    created_at = Column(DateTime, default=_now)

    session = relationship("ChatSession", back_populates="messages")


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(Text, primary_key=True, default=_uuid)
    user_id = Column(Text, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan = Column(Text, nullable=False)  # "monthly" | "lifetime"
    amount = Column(Text, nullable=False)  # 金额（字符串，保留精度）
    status = Column(Text, default="pending", index=True)  # pending | paid | cancelled
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    user = relationship("User", back_populates="payment_orders")


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"

    id = Column(Text, primary_key=True, default=_uuid)
    notebook_id = Column(Text, ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Text, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    chunk_id = Column(Text, nullable=True)
    title = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(Text, default="[]")  # JSON array of tag strings
    created_at = Column(DateTime, default=_now)

    notebook = relationship("Notebook", back_populates="knowledge_points")


class QuizAttempt(Base):
    """出题练习答题记录（错题本）"""
    __tablename__ = "quiz_attempts"

    id = Column(Text, primary_key=True, default=_uuid)
    user_id = Column(Text, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notebook_id = Column(Text, ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False, index=True)
    knowledge_point_id = Column(Text, ForeignKey("knowledge_points.id", ondelete="SET NULL"), nullable=True)
    question = Column(Text, nullable=False)
    user_answer = Column(Text, default="")
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, default="")
    is_correct = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=_now)

