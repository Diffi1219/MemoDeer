"""SQLite 数据库连接 & 会话管理"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI 依赖注入：获取数据库会话"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """初始化数据库表 + 迁移"""
    async with engine.begin() as conn:
        # 创建新表
        await conn.run_sync(Base.metadata.create_all)
        # 迁移：为已有 documents 表添加新列
        await _migrate(conn)


async def _migrate(conn):
    """SQLite 迁移：为已有表添加缺失列"""

    def do_migrate(sync_conn):
        from sqlalchemy import text
        # 获取现有列
        existing_cols = set()
        for table in ["documents", "knowledge_points"]:
            try:
                result = sync_conn.execute(text(f"PRAGMA table_info({table})"))
                for row in result.fetchall():
                    existing_cols.add(f"{table}.{row[1]}")
            except Exception:
                pass

        migrations = [
            ("documents", "folder_id", "TEXT"),
            ("documents", "needs_revectorize", "INTEGER DEFAULT 0"),
            ("documents", "content_updated_at", "TIMESTAMP"),
            ("knowledge_points", "chunk_id", "TEXT"),
        ]
        for table, column, col_type in migrations:
            key = f"{table}.{column}"
            if key not in existing_cols:
                try:
                    sync_conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                    print(f"[Migrate] Added {table}.{column}")
                except Exception as e:
                    print(f"[Migrate] Failed to add {table}.{column}: {e}")

    await conn.run_sync(do_migrate)
