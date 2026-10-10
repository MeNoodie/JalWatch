import json
from typing import List, Dict, Any, Optional
from app.core.config import settings

def get_llm():
    """Initializes and returns the configured LangChain chat model (Groq or Google Gemini)."""
    provider = settings.LLM_PROVIDER.lower().strip()

    if provider == "groq" and settings.GROQ_API_KEY:
        try:
            from langchain_groq import ChatGroq
            return ChatGroq(
                groq_api_key=settings.GROQ_API_KEY,
                model_name=settings.GROQ_MODEL,
                temperature=0.1,
            )
        except Exception as e:
            print(f"[LLM] Error initializing ChatGroq: {e}")
            return None

    elif provider == "google" and settings.GOOGLE_API_KEY:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                google_api_key=settings.GOOGLE_API_KEY,
                model=settings.GOOGLE_MODEL,
                temperature=0.1,
            )
        except Exception as e:
            print(f"[LLM] Error initializing ChatGoogleGenerativeAI: {e}")
            return None

    return None

def analyze_cluster_with_llm(
    cluster_name: str,
    radius_meters: float,
    center_coords: tuple,
    complaints_data: List[Dict[str, Any]]
) -> Dict[str, str]:
    """
    Invokes Groq/Google model via LangChain to produce 5 actionable investigation points.
    If LLM is unavailable or unconfigured, falls back gracefully to deterministic synthesis.
    """
    total = len(complaints_data)
    issue_counts = {}
    for c in complaints_data:
        cat = c.get("issue_category", "other")
        issue_counts[cat] = issue_counts.get(cat, 0) + 1
    
    sorted_issues = sorted(issue_counts.items(), key=lambda x: x[1], reverse=True)
    top_issue, top_count = sorted_issues[0] if sorted_issues else ("water_issue", 1)
    pct = int((top_count / max(total, 1)) * 100)
    sample_descriptions = [c.get("description", "") for c in complaints_data[:6]]

    llm = get_llm()
    if llm:
        try:
            prompt = f"""You are the senior water engineering intelligence assistant for JalWatch Delhi.
A cluster of citizen complaints has reached {total} reports in {cluster_name} (approx coords {center_coords[0]:.4f}, {center_coords[1]:.4f}, radius ~{int(radius_meters)}m).

Summary of reports:
- Dominant issue: {top_issue} ({pct}% of reports, {top_count}/{total})
- Issue breakdown: {issue_counts}
- Sample citizen report descriptions:
{chr(10).join(f"- {d}" for d in sample_descriptions if d)}

Generate an objective operational triage assessment strictly as a JSON object with EXACTLY these 5 keys:
1. "most_common_issues": Concise statement of primary and secondary symptoms.
2. "spots_to_check": Specific physical pipe junctions, valves, or drain intersections in this pocket to inspect.
3. "quick_action": Immediate emergency relief measure (e.g. mobile tanker dispatch, line flushing).
4. "root_cause_hypothesis": Plausible engineering hypothesis (e.g. negative pressure suction, joint seal failure). State it clearly as a hypothesis, not proven fact.
5. "verification_recommendation": Verification steps (e.g. grab sampling for chlorine/turbidity, pressure logger).

Return ONLY valid raw JSON with no markdown formatting or extra text."""

            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)
            
            # Extract JSON block if wrapped
            clean_content = content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.startswith("```"):
                clean_content = clean_content[3:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
            clean_content = clean_content.strip()

            parsed = json.loads(clean_content)
            if all(k in parsed for k in ["most_common_issues", "spots_to_check", "quick_action", "root_cause_hypothesis", "verification_recommendation"]):
                return parsed
        except Exception as e:
            print(f"[LLM Agent] Failed to generate points with LLM: {e}. Using deterministic fallback.")

    # Graceful Deterministic Fallback:
    return {
        "most_common_issues": f"{top_issue.replace('_', ' ').title()} accounts for {pct}% of complaints ({top_count}/{total} logged reports in this pocket).",
        "spots_to_check": f"Inspect distribution pipeline junction and local valve chambers within ~{int(radius_meters)}m radius of {cluster_name}.",
        "quick_action": f"Dispatch emergency potable water tanker to {cluster_name}; initiate low-pressure flushing on tail-end line.",
        "root_cause_hypothesis": f"Suspected negative-pressure suction leading to back-siphonage or pipe joint breach during supply cycle shutoff.",
        "verification_recommendation": f"Collect 3 grab samples for turbidity & residual chlorine testing; inspect physical supply line before next morning distribution."
    }
