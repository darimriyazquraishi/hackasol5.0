"""
Chat Manager.
Persistent storage and management of isolated conversation threads.
"""
import os
import json
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from config.settings import CHATS_DIR


class ChatManager:
    def __init__(self, chats_dir: Path = CHATS_DIR):
        self.chats_dir = chats_dir
        self.chats_dir.mkdir(parents=True, exist_ok=True)

    def _get_chat_path(self, chat_id: str) -> Path:
        return self.chats_dir / f"{chat_id}.json"

    def list_chats(self) -> List[Dict[str, Any]]:
        """Returns all saved chats, sorted with most recently updated first."""
        chats = []
        for file in self.chats_dir.glob("*.json"):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                chats.append({
                    "chat_id": data.get("chat_id", file.stem),
                    "title": data.get("title", "Untitled Chat"),
                    "created_at": data.get("created_at", ""),
                    "updated_at": data.get("updated_at", ""),
                    "message_count": len(data.get("messages", [])),
                    "project_id": data.get("project_id")
                })
            except Exception as e:
                print(f"[ChatManager] Error reading chat {file}: {e}")

        # Sort by updated_at descending
        chats.sort(key=lambda x: x.get("updated_at") or x.get("created_at") or "", reverse=True)
        return chats

    def create_chat(self, title: str = "New Conversation") -> Dict[str, Any]:
        """Creates a new, isolated chat with zero previous messages."""
        chat_id = f"chat_{int(time.time_ns())}_{uuid.uuid4().hex[:6]}"
        now = datetime.now().isoformat()
        chat_data = {
            "chat_id": chat_id,
            "title": title.strip() or "New Conversation",
            "created_at": now,
            "updated_at": now,
            "project_id": None,
            "messages": []
        }
        self._save_chat(chat_id, chat_data)
        return chat_data

    def get_chat(self, chat_id: str) -> Optional[Dict[str, Any]]:
        """Returns the complete chat document including its specific messages."""
        path = self._get_chat_path(chat_id)
        if not path.is_file():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[ChatManager] Error loading chat {chat_id}: {e}")
            return None

    def add_message(
        self,
        chat_id: str,
        role: str,
        text: str,
        project_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Adds a message specifically to the given chat_id, preserving conversation isolation."""
        chat = self.get_chat(chat_id)
        if not chat:
            # Auto-create if not found
            chat = self.create_chat()
            chat_id = chat["chat_id"]

        now = datetime.now().isoformat()
        msg_id = f"msg_{int(time.time_ns())}_{uuid.uuid4().hex[:6]}"
        msg = {
            "id": msg_id,
            "role": role,
            "text": text,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "iso_time": now
        }
        chat["messages"].append(msg)
        chat["updated_at"] = now

        # If it was the first user message, generate a meaningful title if title is default
        if role == "user" and chat.get("title") in ["New Conversation", "Untitled Chat", None, ""]:
            words = text.strip().split()
            meaningful_title = " ".join(words[:5])
            if len(words) > 5:
                meaningful_title += "..."
            chat["title"] = meaningful_title.capitalize()

        if project_id:
            chat["project_id"] = project_id

        self._save_chat(chat_id, chat)
        return msg

    def update_chat_project(self, chat_id: str, project_id: str):
        """Associates a 3D model project with the chat."""
        chat = self.get_chat(chat_id)
        if chat:
            chat["project_id"] = project_id
            chat["updated_at"] = datetime.now().isoformat()
            self._save_chat(chat_id, chat)

    def update_chat_title(self, chat_id: str, title: str) -> bool:
        """Renames a chat."""
        chat = self.get_chat(chat_id)
        if not chat:
            return False
        chat["title"] = title.strip() or "Untitled Chat"
        chat["updated_at"] = datetime.now().isoformat()
        self._save_chat(chat_id, chat)
        return True

    def delete_chat(self, chat_id: str) -> bool:
        """Permanently deletes a chat and its message history."""
        path = self._get_chat_path(chat_id)
        if path.is_file():
            try:
                os.remove(path)
                return True
            except Exception as e:
                print(f"[ChatManager] Failed to delete {chat_id}: {e}")
                return False
        return False

    def _save_chat(self, chat_id: str, data: Dict[str, Any]):
        path = self._get_chat_path(chat_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)


# Global Singleton
chat_manager = ChatManager()
