"""
Authentication Middleware and Utilities
Provides JWT token generation, verification, and endpoint protection
"""
from fastapi import HTTPException, Header, Depends
from typing import Optional
import jwt
import os
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token
    
    Args:
        data: Dictionary containing claims (athlete_id, email, role, etc.)
        expires_delta: Optional custom expiration time
    
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """
    Verify and decode a JWT token
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token payload
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Dependency to get current authenticated user from JWT token
    
    Args:
        authorization: Authorization header containing "Bearer <token>"
    
    Returns:
        User data from token payload
    
    Raises:
        HTTPException: If no token or invalid token
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Extract token from "Bearer <token>" format
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format. Use: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = parts[1]
    payload = verify_token(token)
    
    return payload


async def require_auth(authorization: Optional[str] = Header(None)) -> dict:
    """
    Dependency that requires authentication (alias for get_current_user)
    Use in route: async def my_route(user: dict = Depends(require_auth))
    """
    return await get_current_user(authorization)


async def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    """
    Dependency that requires admin/super admin privileges
    """
    user = await get_current_user(authorization)
    
    role = user.get("role", "user")
    is_admin = user.get("is_super_admin", False) or role in ["admin", "super_admin"]
    
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin privileges required"
        )
    
    return user


def optional_auth(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """
    Optional authentication - returns user data if token provided, None otherwise
    Useful for endpoints that work with or without auth
    """
    if not authorization:
        return None
    
    try:
        return verify_token(authorization.split()[1])
    except Exception:
        return None
