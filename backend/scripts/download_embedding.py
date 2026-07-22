"""下载 / 切换 Embedding 模型到 backend/models/<safe-name>/

用法：
    python scripts/download_embedding.py                        # 下载 .env 中 EMBEDDING_MODEL 指定的模型
    python scripts/download_embedding.py BAAI/bge-large-zh-v1.5  # 下载并切换到新模型（自动改 .env）
    python scripts/download_embedding.py --target ./models/foo   # 下载到自定义目录（仍可指定模型 ID）

行为：
    1. 通过 HF_ENDPOINT（国内镜像）下载到 backend/models/<模型简称>/
    2. 如果传入了新模型 ID，自动更新 .env 的 EMBEDDING_MODEL 与 EMBEDDING_LOCAL_DIR
    3. 列出下载的文件及大小
"""
import argparse
import os
import re
import sys
from pathlib import Path

# 让脚本能 import app.config
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))


def safe_name(model_id: str) -> str:
    """`BAAI/bge-small-zh-v1.5` → `bge-small-zh-v1.5`"""
    return model_id.split("/")[-1] if "/" in model_id else model_id


def resolve_local_dir(model_id: str, override: str | None) -> Path:
    """把相对路径锚定到 backend/ 目录下"""
    if override:
        p = Path(override)
    else:
        p = BACKEND_DIR / "models" / safe_name(model_id)
    if not p.is_absolute():
        p = BACKEND_DIR / p
    return p


def update_env(model_id: str, local_dir: Path, env_path: Path) -> None:
    """替换 .env 中的 EMBEDDING_MODEL / EMBEDDING_LOCAL_DIR 两行（其他行原样保留）"""
    text = env_path.read_text(encoding="utf-8")

    # 相对路径便于跨机器迁移
    try:
        rel = local_dir.relative_to(BACKEND_DIR).as_posix()
    except ValueError:
        rel = str(local_dir)
    new_model_line = f"EMBEDDING_MODEL={model_id}"
    new_dir_line = f"EMBEDDING_LOCAL_DIR=./{rel}"

    def replace_or_append(text: str, key: str, new_line: str) -> str:
        pattern = re.compile(rf"^{key}=.*$", re.MULTILINE)
        if pattern.search(text):
            return pattern.sub(new_line, text)
        return text.rstrip() + "\n" + new_line + "\n"

    text = replace_or_append(text, "EMBEDDING_MODEL", new_model_line)
    text = replace_or_append(text, "EMBEDDING_LOCAL_DIR", new_dir_line)
    env_path.write_text(text, encoding="utf-8")
    print(f"[env] {new_model_line}")
    print(f"[env] {new_dir_line}")


def list_files(target: Path) -> None:
    print(f"[done] Files under {target}:")
    files = sorted(p for p in target.rglob("*") if p.is_file())
    total_mb = 0.0
    for f in files:
        mb = f.stat().st_size / 1024 / 1024
        total_mb += mb
        print(f"  {f.relative_to(target).as_posix():<40} {mb:>8.2f} MB")
    print(f"  {'─' * 50}")
    print(f"  {'TOTAL':<40} {total_mb:>8.2f} MB")


def is_complete(target: Path) -> bool:
    """判断本地是否已有完整模型（至少有 1 个权重 + config.json + tokenizer.json）"""
    has_weights = any(
        (target / name).exists()
        for name in ("pytorch_model.bin", "model.safetensors")
    )
    has_config = (target / "config.json").exists()
    has_tokenizer = (target / "tokenizer.json").exists()
    return has_weights and has_config and has_tokenizer


def main() -> int:
    parser = argparse.ArgumentParser(description="下载/切换 embedding 模型")
    parser.add_argument(
        "model",
        nargs="?",
        default=None,
        help="要下载的模型 ID（默认读 .env 里的 EMBEDDING_MODEL）",
    )
    parser.add_argument(
        "--target",
        default=None,
        help="本地缓存目录（默认 backend/models/<模型简称>/）",
    )
    args = parser.parse_args()

    # 必须在 import huggingface_hub 前设置环境变量
    from app.config import settings  # noqa: E402
    if settings.HF_ENDPOINT:
        os.environ.setdefault("HF_ENDPOINT", settings.HF_ENDPOINT)
    # xet 在国内经常很慢或失败，禁用
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

    model_id = args.model or settings.EMBEDDING_MODEL
    target = resolve_local_dir(model_id, args.target)
    target.mkdir(parents=True, exist_ok=True)

    print(f"[plan] model  = {model_id}")
    print(f"[plan] target = {target}")
    print(f"[plan] mirror = {os.environ.get('HF_ENDPOINT', '(default huggingface.co)')}")

    from huggingface_hub import snapshot_download  # noqa: E402
    if is_complete(target):
        print(f"[skip] model already complete at {target}, no download needed")
    else:
        snapshot_download(
            model_id,
            local_dir=str(target),
            allow_patterns=[
                "*.json",
                "*.txt",
                "*.md",
                "vocab.txt",
                "tokenizer.json",
                "*.bin",
                "*.safetensors",
                "1_Pooling/*",
            ],
        )

    list_files(target)

    # 只有当传入了新模型 ID（与 .env 不同）时才更新 .env
    if args.model and args.model != settings.EMBEDDING_MODEL:
        env_path = BACKEND_DIR / ".env"
        update_env(model_id, target, env_path)
    else:
        print(f"[env] EMBEDDING_MODEL already = {model_id}, no .env update needed")

    return 0


if __name__ == "__main__":
    sys.exit(main())
