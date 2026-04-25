import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.users.models import User
from common.jwt_utils import decode_token


class JWTAuthentication(BaseAuthentication):
    """
    Custom JWT authentication for DRF.
    Reads 'Authorization: Bearer <token>' header.
    Decodes JWT and returns (user, token_payload).
    """

    keyword = "Bearer"

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0] != self.keyword:
            return None

        token = parts[1]

        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Access token has expired.")
        except jwt.InvalidTokenError:
            raise AuthenticationFailed("Invalid access token.")

        if payload.get("type") != "access":
            raise AuthenticationFailed("Invalid token type. Expected access token.")

        user_id = payload.get("user_id")
        if not user_id:
            raise AuthenticationFailed("Token missing user_id.")

        try:
            user = User.objects.get(id=user_id, status=User.Status.ACTIVE)
        except User.DoesNotExist:
            raise AuthenticationFailed("User not found or inactive.")

        return (user, payload)