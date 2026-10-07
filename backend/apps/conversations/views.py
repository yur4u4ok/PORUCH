from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.conversations.models import Message
from apps.conversations.serializers import (
    ConversationSerializer,
    MessageCreateSerializer,
    MessageSerializer,
    ReactionSerializer,
    ReadSerializer,
)
from apps.conversations.services import conversations as svc
from common.pagination import CreatedAtCursorPagination
from common.throttling import MessagesThrottle


class ConversationListView(ListAPIView):
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return svc.conversations_for(self.request.user)

    def paginate_queryset(self, queryset):
        page = super().paginate_queryset(queryset)
        svc.attach_last_messages(page if page is not None else list(queryset))
        return page


class ConversationDetailView(APIView):
    @extend_schema(responses=ConversationSerializer)
    def get(self, request, conversation_id):
        conversation = svc.conversations_for(request.user).filter(id=conversation_id).first()
        if conversation is None:
            svc.get_conversation_for(request.user, conversation_id)  # raises NotFound
        svc.attach_last_messages([conversation])
        return Response(ConversationSerializer(conversation, context={"request": request}).data)


class MessageListCreateView(ListAPIView):
    serializer_class = MessageSerializer
    pagination_class = CreatedAtCursorPagination

    def get_throttles(self):
        if self.request.method == "POST":
            return [MessagesThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        conversation = svc.get_conversation_for(self.request.user, self.kwargs["conversation_id"])
        return (
            Message.objects.filter(conversation=conversation)
            .select_related("attachment", "reply_to")
            .prefetch_related("reactions")
        )

    @extend_schema(request=MessageCreateSerializer, responses={201: MessageSerializer})
    def post(self, request, conversation_id):
        ser = MessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message, created = svc.send_message(request.user, conversation_id, **ser.validated_data)
        return Response(
            MessageSerializer(message).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class MessageReactionView(APIView):
    @extend_schema(request=ReactionSerializer, responses=MessageSerializer)
    def post(self, request, conversation_id, message_id):
        ser = ReactionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message = svc.react(request.user, conversation_id, message_id, ser.validated_data["emoji"])
        return Response(MessageSerializer(message).data)


class ConversationReadView(APIView):
    @extend_schema(request=ReadSerializer, responses={200: None})
    def post(self, request, conversation_id):
        ser = ReadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        count = svc.mark_read(request.user, conversation_id, ser.validated_data.get("up_to"))
        return Response({"marked": count})
