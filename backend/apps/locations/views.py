from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.locations.models import City
from apps.locations.serializers import AvailabilityInputSerializer, AvailabilitySerializer, CitySerializer
from apps.locations.services import availability as svc


class CityListView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    @extend_schema(responses=CitySerializer(many=True))
    def get(self, request):
        return Response(CitySerializer(City.objects.filter(is_active=True), many=True).data)


class AvailabilityView(APIView):
    @extend_schema(responses=AvailabilitySerializer)
    def get(self, request):
        availability = svc.get_availability(request.user)
        if availability is None:
            return Response({"active": False, "radius": None, "categories": [], "expires_at": None})
        return Response(AvailabilitySerializer(availability).data)

    @extend_schema(request=AvailabilityInputSerializer, responses=AvailabilitySerializer)
    def post(self, request):
        ser = AvailabilityInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        availability = svc.set_availability(request.user, **ser.validated_data)
        return Response(AvailabilitySerializer(availability).data)

    @extend_schema(responses={204: None})
    def delete(self, request):
        svc.deactivate_availability(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
