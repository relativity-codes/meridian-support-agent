import logging
from typing import Any

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class OpenRouterClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None) -> None:
        api_key = api_key or settings.OPENROUTER_API_KEY
        base_url = base_url or settings.OPENROUTER_BASE_URL
        if not api_key:
            logger.warning("OPENROUTER_API_KEY is not set")
        self.client = AsyncOpenAI(
            api_key=api_key or "missing",
            base_url=base_url,
            default_headers={
                "HTTP-Referer": settings.HOST,
                "X-Title": settings.APP_NAME,
            },
        )

    async def complete(self, messages: list[dict[str, str]], **kwargs: Any) -> dict[str, Any]:
        response = await self.client.chat.completions.create(
            model=kwargs.get("model", settings.OPENROUTER_DEFAULT_MODEL),
            messages=messages,
            **{k: v for k, v in kwargs.items() if k != "model"},
        )
        return response.model_dump()
