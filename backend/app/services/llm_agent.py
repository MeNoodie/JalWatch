import json
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.prompts.prompts import get_cluster_analysis_llm_prompt

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
            prompt = get_cluster_analysis_llm_prompt(
                total=total,
                cluster_name=cluster_name,
                center_coords=center_coords,
                radius_meters=radius_meters,
                top_issue=top_issue,
                pct=pct,
                top_count=top_count,
                issue_counts=issue_counts,
                sample_descriptions=sample_descriptions,
            )

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
            # Ensure critical keys exist
            if "most_common_issues" in parsed and "spots_to_check" in parsed:
                # Add default mappings if any specific key was missed by LLM
                parsed.setdefault("issue_overview", parsed.get("most_common_issues", ""))
                parsed.setdefault("geographic_distribution", f"Complaints clustered within ~{int(radius_meters)}m radius of {cluster_name}.")
                parsed.setdefault("category_frequency_patterns", f"{top_issue}: {pct}%, total {total} reports across categories: {issue_counts}")
                parsed.setdefault("priority_indicators", "High priority triage due to complaint clustering." if "dirty_water" in issue_counts or "bad_smell" in issue_counts else "Standard operational supply triage.")
                parsed.setdefault("inspection_next_steps", parsed.get("spots_to_check", ""))
                return parsed
        except Exception as e:
            print(f"[LLM Agent] Failed to generate points with LLM: {e}. Using deterministic fallback.")

    # Graceful Deterministic Fallback:
    is_health_risk = "dirty_water" in issue_counts or "bad_smell" in issue_counts
    priority_note = "High Public Health Attention (Potential contamination reported)" if is_health_risk else "Medium Priority (Municipal flow & supply defect)"

    return {
        "issue_overview": f"{top_issue.replace('_', ' ').title()} represents {pct}% of logged citizen reports ({top_count}/{total}) in this monitoring pocket.",
        "geographic_distribution": f"Concentrated around {cluster_name} within a ~{int(radius_meters)}m operational radius ({center_coords[0]:.4f}°N, {center_coords[1]:.4f}°E).",
        "category_frequency_patterns": f"Dominant: {top_issue} ({top_count}). Full breakdown: {', '.join(f'{k}: {v}' for k, v in issue_counts.items())}.",
        "priority_indicators": f"{priority_note}. Based on {total} real complaints logged within 700m threshold.",
        "inspection_next_steps": f"Inspect distribution pipeline junction and local valve chambers within ~{int(radius_meters)}m; verify pressure before next supply cycle.",
        "most_common_issues": f"{top_issue.replace('_', ' ').title()} accounts for {pct}% of complaints ({top_count}/{total} logged reports in this pocket).",
        "spots_to_check": f"Inspect distribution pipeline junction and local valve chambers within ~{int(radius_meters)}m radius of {cluster_name}.",
        "quick_action": f"Dispatch emergency potable water tanker to {cluster_name}; initiate low-pressure flushing on tail-end line.",
        "root_cause_hypothesis": f"Hypothesis: Suspected negative-pressure suction leading to back-siphonage or pipe joint breach during supply cycle shutoff. Unconfirmed pending excavation.",
        "verification_recommendation": f"Collect 3 grab samples for turbidity & residual chlorine testing; inspect physical supply line before next morning distribution."
    }
