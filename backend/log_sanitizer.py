"""
Log Sanitizer
Utilities for safely logging sensitive data without exposing secrets
"""
import re
from typing import Any, Dict

# Patterns that should never be logged in full
SENSITIVE_KEYS = [
    "password",
    "token",
    "secret",
    "api_key",
    "apiKey",
    "access_token",
    "refresh_token",
    "client_secret",
    "authorization",
    "bearer"
]

def sanitize_dict(data: Dict[str, Any], show_length: bool = True) -> Dict[str, Any]:
    """
    Sanitize a dictionary by redacting sensitive fields
    
    Args:
        data: Dictionary that may contain sensitive data
        show_length: Whether to show the length of redacted values
    
    Returns:
        Sanitized dictionary safe for logging
    
    Example:
        >>> sanitize_dict({"username": "john", "password": "secret123"})
        {"username": "john", "password": "***REDACTED*** (9 chars)"}
    """
    if not isinstance(data, dict):
        return data
    
    sanitized = {}
    for key, value in data.items():
        key_lower = key.lower()
        
        # Check if key contains sensitive information
        is_sensitive = any(sensitive_key in key_lower for sensitive_key in SENSITIVE_KEYS)
        
        if is_sensitive:
            if value and show_length:
                sanitized[key] = f"***REDACTED*** ({len(str(value))} chars)"
            else:
                sanitized[key] = "***REDACTED***"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_dict(value, show_length)
        elif isinstance(value, list):
            sanitized[key] = [sanitize_dict(item, show_length) if isinstance(item, dict) else item for item in value]
        else:
            sanitized[key] = value
    
    return sanitized


def sanitize_token(token: str, show_chars: int = 8) -> str:
    """
    Sanitize a token/secret by showing only first N characters
    
    Args:
        token: Token or secret string
        show_chars: Number of characters to show (default 8)
    
    Returns:
        Sanitized string safe for logging
    
    Example:
        >>> sanitize_token("sk-1234567890abcdefghij")
        "sk-12345...***"
    """
    if not token or len(token) <= show_chars:
        return "***"
    
    return f"{token[:show_chars]}...***"


def sanitize_email(email: str) -> str:
    """
    Sanitize email for logging (show first 3 chars + domain)
    
    Args:
        email: Email address
    
    Returns:
        Sanitized email
    
    Example:
        >>> sanitize_email("john.doe@example.com")
        "joh***@example.com"
    """
    if not email or "@" not in email:
        return "***"
    
    local, domain = email.split("@", 1)
    if len(local) <= 3:
        return f"***@{domain}"
    
    return f"{local[:3]}***@{domain}"


def sanitize_log_message(message: str) -> str:
    """
    Sanitize a log message by replacing common secret patterns
    
    Args:
        message: Log message string
    
    Returns:
        Sanitized message
    
    Example:
        >>> sanitize_log_message("Token: sk-1234567890abcdefghij")
        "Token: sk-12***REDACTED***"
    """
    # Replace bearer tokens
    message = re.sub(r'Bearer\s+[A-Za-z0-9\-._~+/]+=*', 'Bearer ***REDACTED***', message)
    
    # Replace JWT tokens
    message = re.sub(r'eyJ[A-Za-z0-9\-._~+/]+\.eyJ[A-Za-z0-9\-._~+/]+\.[A-Za-z0-9\-._~+/]*', '***JWT_TOKEN***', message)
    
    # Replace API keys (sk-, pk_)
    message = re.sub(r'(sk|pk)[-_][a-zA-Z0-9]{20,}', r'\1-***REDACTED***', message)
    
    # Replace password=value patterns
    message = re.sub(r'password\s*=\s*["\']?[^"\'&\s]+', 'password=***REDACTED***', message, flags=re.IGNORECASE)
    
    return message


# Best Practices for Logging:
# 
# ❌ BAD:
#   logger.info(f"User password: {user_password}")
#   logger.info(f"API key: {api_key}")
#   logger.info(f"Token: {token}")
#
# ✅ GOOD:
#   logger.info(f"Password length: {len(user_password)}")
#   logger.info(f"API key: {sanitize_token(api_key)}")
#   logger.info(f"User data: {sanitize_dict(user_data)}")
#
# NEVER log:
#   - Full passwords
#   - Full API keys or tokens
#   - Credit card numbers
#   - Social security numbers
#   - Full email addresses (use sanitize_email)
