from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from users.api.serializers import UserCreateSerializer


class UserCreateView(APIView):
    @extend_schema(
        request=UserCreateSerializer,
        responses={201: UserCreateSerializer},
        summary="Create a new user",
        tags=["Users"],
    )
    def post(self, request):
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserCreateSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
