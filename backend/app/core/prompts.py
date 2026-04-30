from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_PROMPTS_DIR = _BACKEND_ROOT / "system_prompts" / "react"


def _read_prompt(name: str) -> str:
    path = _PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


REACT_SYSTEM_PROMPT = _read_prompt("react_loop")
