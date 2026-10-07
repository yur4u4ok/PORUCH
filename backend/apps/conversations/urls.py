from django.urls import path

from apps.conversations import views

urlpatterns = [
    path("conversations/", views.ConversationListView.as_view(), name="conversations"),
    path("conversations/<uuid:conversation_id>/", views.ConversationDetailView.as_view(), name="conversation-detail"),
    path(
        "conversations/<uuid:conversation_id>/messages/",
        views.MessageListCreateView.as_view(),
        name="conversation-messages",
    ),
    path(
        "conversations/<uuid:conversation_id>/messages/<uuid:message_id>/reactions/",
        views.MessageReactionView.as_view(),
        name="message-reactions",
    ),
    path("conversations/<uuid:conversation_id>/read/", views.ConversationReadView.as_view(), name="conversation-read"),
]
