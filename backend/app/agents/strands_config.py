import os
from typing import Optional
from app.core.config import settings

def get_strands_model():
    """
    Constructs and returns an AWS Strands Model provider instance based on environment configuration.
    Supports Google Gemini, Groq (via OpenAI-compatible adapter), and Amazon Bedrock.
    Returns None if no API keys are configured, signaling deterministic fallback.
    """
    provider = os.getenv("LLM_PROVIDER", settings.LLM_PROVIDER).lower().strip()
    
    # 1. Google Gemini via Strands GeminiModel
    gemini_key = os.getenv("GEMINI_API_KEY") or settings.GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY")
    gemini_model_id = os.getenv("GEMINI_MODEL_ID") or settings.GOOGLE_MODEL or "gemini-1.5-flash"
    
    if provider in ["google", "gemini"] and gemini_key:
        try:
            from strands.models.gemini import GeminiModel
            return GeminiModel(
                api_key=gemini_key.strip(),
                model=gemini_model_id.strip()
            )
        except Exception as e:
            print(f"[Strands Config] Warning: Failed to initialize GeminiModel: {e}")
            return None

    # 2. Groq via Strands OpenAIModel (Groq exposes OpenAI-compatible /chat/completions)
    groq_key = os.getenv("GROQ_API_KEY") or settings.GROQ_API_KEY
    groq_model_id = os.getenv("GROQ_MODEL_ID") or settings.GROQ_MODEL or "llama-3.3-70b-versatile"

    if provider in ["groq"] and groq_key:
        try:
            from strands.models.openai import OpenAIModel
            return OpenAIModel(
                api_key=groq_key.strip(),
                base_url="https://api.groq.com/openai/v1",
                model=groq_model_id.strip()
            )
        except Exception as e:
            print(f"[Strands Config] Warning: Failed to initialize Groq via OpenAIModel: {e}")
            return None

    # 3. Optional Amazon Bedrock via Strands BedrockModel
    bedrock_model_id = os.getenv("BEDROCK_MODEL_ID")
    if provider in ["bedrock", "aws"] and bedrock_model_id:
        try:
            from strands.models.bedrock import BedrockModel
            return BedrockModel(model_id=bedrock_model_id.strip())
        except Exception as e:
            print(f"[Strands Config] Warning: Failed to initialize BedrockModel: {e}")
            return None

    return None

def get_active_provider_metadata() -> dict:
    """Returns metadata about the active provider for persistence with analysis."""
    provider = os.getenv("LLM_PROVIDER", settings.LLM_PROVIDER).lower().strip()
    model = get_strands_model()
    return {
        "framework": "aws-strands-agents-1.59.0",
        "configured_provider": provider,
        "is_active": model is not None,
        "fallback_provider": "deterministic-evidence-synthesis",
        "analysis_version": "1.0",
        "session_manager": "strands.session.FileSessionManager"
    }

from pathlib import Path
from strands.session import FileSessionManager

STRANDS_SESSIONS_DIR = Path(__file__).resolve().parent.parent.parent / ".strands_sessions"
STRANDS_SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

def get_cluster_session_manager(cluster_id: str, agent_prefix: str = "cluster") -> FileSessionManager:
    """
    Returns an AWS Strands FileSessionManager configured for the given cluster and agent role.
    Persists conversational state, tool calls, and execution context on the local filesystem.
    """
    safe_session_id = f"{agent_prefix}_{cluster_id}".replace("/", "_").replace("\\", "_")
    return FileSessionManager(
        session_id=safe_session_id,
        storage_dir=str(STRANDS_SESSIONS_DIR)
    )

