"""WebSocket consumer: /ws/conversations/{conversation_id}/

Server → client events: message.created, message.read, typing.started, typing.stopped,
user.online, user.offline. Client → server: typing.started, typing.stopped, ping.
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.conversations import presence
from apps.conversations.realtime import group_name

CLIENT_EVENTS = {"typing.started", "typing.stopped"}


class ConversationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        if not user or not user.is_authenticated or not await self._can_access(user):
            await self.close(code=4403)
            return
        self.user = user
        self.group = group_name(self.conversation_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await database_sync_to_async(presence.connect)(self.conversation_id, user.pk)
        await self.channel_layer.group_send(
            self.group,
            {
                "type": "broadcast",
                "event": "user.online",
                "payload": {"user_id": str(user.pk)},
                "sender_channel": self.channel_name,
            },
        )
        other_id = await self._other_participant_id()
        if other_id and await database_sync_to_async(presence.is_online)(self.conversation_id, other_id):
            await self.send_json({"event": "user.online", "payload": {"user_id": str(other_id)}})

    async def disconnect(self, code):
        if not hasattr(self, "group"):
            return
        await self.channel_layer.group_discard(self.group, self.channel_name)
        gone = await database_sync_to_async(presence.disconnect)(self.conversation_id, self.user.pk)
        if gone:
            await self.channel_layer.group_send(
                self.group, {"type": "broadcast", "event": "user.offline", "payload": {"user_id": str(self.user.pk)}}
            )

    async def receive_json(self, content, **kwargs):
        event = content.get("type") or content.get("event")
        if event == "ping":
            await database_sync_to_async(presence.heartbeat)(self.conversation_id, self.user.pk)
            await self.send_json({"event": "pong"})
        elif event in CLIENT_EVENTS:
            await self.channel_layer.group_send(
                self.group,
                {
                    "type": "broadcast",
                    "event": event,
                    "payload": {"user_id": str(self.user.pk)},
                    "sender_channel": self.channel_name,
                },
            )

    async def broadcast(self, message):
        if message.get("sender_channel") == self.channel_name:
            return  # do not echo own typing/presence events
        await self.send_json({"event": message["event"], "payload": message["payload"]})

    @database_sync_to_async
    def _can_access(self, user) -> bool:
        from apps.conversations.services.conversations import can_access

        return can_access(user, self.conversation_id)

    @database_sync_to_async
    def _other_participant_id(self):
        from apps.conversations.models import ConversationParticipant

        return (
            ConversationParticipant.objects.filter(conversation_id=self.conversation_id)
            .exclude(user=self.user)
            .values_list("user_id", flat=True)
            .first()
        )
