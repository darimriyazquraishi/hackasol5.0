"""
Ollama API Client.
Dynamic model detection and local inference.
"""
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

from config.settings import OLLAMA_BASE_URL


class OllamaClient:
    def __init__(self, base_url: str = OLLAMA_BASE_URL):
        self.base_url = base_url.rstrip("/")

    def check_connection(self) -> bool:
        """Checks if local Ollama daemon is active and responding."""
        try:
            req = urllib.request.Request(f"{self.base_url}/api/tags", headers={"User-Agent": "BlenderAI"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                return resp.status == 200
        except Exception:
            return False

    def get_installed_models(self) -> List[Dict[str, Any]]:
        """Retrieves list of installed Ollama models dynamically."""
        try:
            req = urllib.request.Request(f"{self.base_url}/api/tags", headers={"User-Agent": "BlenderAI"})
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = []
                    for m in data.get("models", []):
                        models.append({
                            "name": m.get("name"),
                            "model": m.get("model"),
                            "size": m.get("size", 0),
                            "parameter_size": m.get("details", {}).get("parameter_size", "unknown"),
                            "quantization": m.get("details", {}).get("quantization_level", "unknown")
                        })
                    return models
        except Exception as e:
            print(f"[OllamaClient] Error fetching models: {e}")
        return []

    def generate(
        self,
        prompt: str,
        model: str,
        system: Optional[str] = None,
        json_format: bool = True,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Sends generation request to Ollama and returns response dictionary.
        No artificial time limit by default (timeout=None) to allow complex models to finish.
        """
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system
        if json_format:
            payload["format"] = "json"

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}/api/generate",
            data=data_bytes,
            headers={"Content-Type": "application/json", "User-Agent": "BlenderAI"}
        )

        try:
            open_kw = {"timeout": timeout} if (timeout is not None and timeout > 0) else {}
            with urllib.request.urlopen(req, **open_kw) as resp:
                if resp.status == 200:
                    result = json.loads(resp.read().decode("utf-8"))
                    return {
                        "success": True,
                        "response": result.get("response", ""),
                        "total_duration": result.get("total_duration", 0),
                        "eval_count": result.get("eval_count", 0)
                    }
                return {"success": False, "error": f"HTTP {resp.status}"}
        except urllib.error.URLError as e:
            return {"success": False, "error": f"Connection error: {e.reason}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
