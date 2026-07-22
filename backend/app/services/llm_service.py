"""LLM 调用封装 — 统一接口，支持 DeepSeek API、本地 Ollama 8B 模型切换

三层模型架构：
  Flash   → 轻量 NLU 任务（文档摘要、文本总结），便宜/本地 8B
  Pro     → 强推理任务（RAG 问答、复杂逻辑），最强模型
  Local   → 本地 Ollama 接口（8B），可替代 Flash 节省 API 费用
"""
from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional
from openai import AsyncOpenAI
from app.config import settings


# ═══════════════════════════════════════════════════════════════
# Provider 抽象
# ═══════════════════════════════════════════════════════════════

class BaseLLMProvider(ABC):
    """LLM Provider 抽象基类 — 所有 provider 统一接口"""

    @abstractmethod
    async def chat(
        self,
        messages: list[dict],
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ):
        ...

    @abstractmethod
    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        ...


# ═══════════════════════════════════════════════════════════════
# OpenAI 兼容 Provider（DeepSeek / Ollama 通用）
# ═══════════════════════════════════════════════════════════════

class OpenAICompatibleProvider(BaseLLMProvider):
    """OpenAI API 兼容的 Provider — 同时支持 DeepSeek 和本地 Ollama"""

    def __init__(self, model: str, base_url: str, api_key: str, timeout: float = 60.0):
        self.model = model
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
        )

    async def chat(
        self,
        messages: list[dict],
        stream: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ):
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=stream,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if not stream:
            return response.choices[0].message.content
        return response

    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


# ═══════════════════════════════════════════════════════════════
# LLM 服务 — 统一入口
# ═══════════════════════════════════════════════════════════════

class LLMService:
    """LLM 服务 — 管理三层模型，支持运行时切换

    使用方式：
        llm_service.flash.chat(...)   # 文档摘要等 NLU 任务
        llm_service.pro.chat(...)     # RAG 问答等强推理任务
        llm_service.local.chat(...)   # 本地 8B 模型（预留）

    切换到本地 8B 处理 NLU：
        llm_service.use_local_for_flash()
    """

    def __init__(self):
        self._flash: Optional[BaseLLMProvider] = None
        self._pro: Optional[BaseLLMProvider] = None
        self._local: Optional[BaseLLMProvider] = None

    # ── Flash ──────────────────────────────────────────────

    @property
    def flash(self) -> BaseLLMProvider:
        """Flash — 轻量 NLU 任务：文档摘要、文本总结

        默认使用 settings.LLM_FLASH_MODEL（如 deepseek-v4-flash），
        可通过 use_local_for_flash() 切换到本地 8B。
        """
        if self._flash is None:
            if not settings.DEEPSEEK_API_KEY:
                raise RuntimeError("DEEPSEEK_API_KEY 未配置，无法初始化 Flash LLM")
            self._flash = OpenAICompatibleProvider(
                model=settings.LLM_FLASH_MODEL,
                base_url=settings.DEEPSEEK_BASE_URL,
                api_key=settings.DEEPSEEK_API_KEY,
            )
        return self._flash

    # ── Pro ────────────────────────────────────────────────

    @property
    def pro(self) -> BaseLLMProvider:
        """Pro — 强推理任务：RAG 问答、复杂逻辑解答

        使用 settings.LLM_PRO_MODEL，建议配置为最强推理模型。
        """
        if self._pro is None:
            if not settings.DEEPSEEK_API_KEY:
                raise RuntimeError("DEEPSEEK_API_KEY 未配置，无法初始化 Pro LLM")
            self._pro = OpenAICompatibleProvider(
                model=settings.LLM_PRO_MODEL,
                base_url=settings.DEEPSEEK_BASE_URL,
                api_key=settings.DEEPSEEK_API_KEY,
            )
        return self._pro

    # ── Local 8B ───────────────────────────────────────────

    @property
    def local(self) -> BaseLLMProvider:
        """Local — 本地 Ollama 8B 模型接口

        配置要求：
          1. 服务器安装 Ollama: https://ollama.com
          2. 拉取模型: ollama pull qwen3:8b
          3. 在 .env 中设置:
             LLM_LOCAL_BASE_URL=http://localhost:11434/v1
             LLM_LOCAL_MODEL=qwen3:8b
        """
        if self._local is None:
            if not settings.LLM_LOCAL_BASE_URL:
                raise RuntimeError(
                    "本地模型未配置。请在 .env 中设置 LLM_LOCAL_BASE_URL=http://localhost:11434/v1"
                )
            self._local = OpenAICompatibleProvider(
                model=settings.LLM_LOCAL_MODEL,
                base_url=settings.LLM_LOCAL_BASE_URL,
                api_key="ollama",  # Ollama 不需要真实 key，但 OpenAI SDK 需要非空值
            )
        return self._local

    # ── 运行时切换 ─────────────────────────────────────────

    def use_local_for_flash(self):
        """将 Flash 切换到本地 8B 模型（NLU 任务用本地模型省成本）

        调用后 flash 属性将使用本地 Ollama 模型，
        适用于文档摘要、文本总结等对推理要求不高的任务。
        """
        self._flash = self.local

    def use_remote_for_flash(self):
        """将 Flash 切换回远程 API（DeepSeek）"""
        self._flash = None  # 下次访问 flash 会重新初始化

    def set_flash_provider(self, provider: BaseLLMProvider):
        """手动注入 Flash provider（用于自定义/测试场景）"""
        self._flash = provider

    def set_pro_provider(self, provider: BaseLLMProvider):
        """手动注入 Pro provider"""
        self._pro = provider


# 单例
llm_service = LLMService()
