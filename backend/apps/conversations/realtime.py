"""Broadcast events to WebSocket groups from synchronous code (after commit)."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction


def group_name(conversation_id) -> str:
    return f"conversation_{conversation_id}"


def broadcast(conversation_id, event: str, payload: dict) -> None:
    def _send() -> None:
        layer = get_channel_layer()
        if layer is None:
            return
        async_to_sync(layer.group_send)(
            group_name(conversation_id), {"type": "broadcast", "event": event, "payload": payload}
        )

    transaction.on_commit(_send)
