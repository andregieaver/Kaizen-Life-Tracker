"""Utility functions for the application"""
from datetime import datetime, date, time, timezone
from typing import Any, Dict


def prepare_for_mongo(data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare data for MongoDB storage by converting datetime objects to ISO strings"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, date):
                data[key] = value.isoformat()
            elif isinstance(value, time):
                data[key] = value.strftime('%H:%M:%S')
    return data


def parse_from_mongo(item: Dict[str, Any]) -> Dict[str, Any]:
    """Parse data from MongoDB"""
    # Keep date fields as strings for JSON serialization
    if isinstance(item.get('time'), str):
        item['time'] = datetime.strptime(item['time'], '%H:%M:%S').time()
    # Handle date_of_birth conversion - keep as string for API serialization
    if isinstance(item.get('date_of_birth'), str):
        # Validate the date format but keep as string
        try:
            datetime.fromisoformat(item['date_of_birth']).date()
        except ValueError:
            # If invalid date format, remove it
            item.pop('date_of_birth', None)
    return item


def calculate_age(date_of_birth: Any) -> int | None:
    """Calculate age from date of birth (accepts string or date object)"""
    if not date_of_birth:
        return None
    
    # Convert string to date object if needed
    if isinstance(date_of_birth, str):
        try:
            date_of_birth = datetime.fromisoformat(date_of_birth).date()
        except ValueError:
            return None
    
    today = date.today()
    age = today.year - date_of_birth.year
    
    # Check if birthday has occurred this year
    # Handle leap year edge case (Feb 29 birthday in non-leap year)
    try:
        birthday_this_year = date(today.year, date_of_birth.month, date_of_birth.day)
        if today < birthday_this_year:
            age -= 1
    except ValueError:
        # This handles Feb 29 birthday in non-leap years
        # For Feb 29 birthdays, consider the birthday as Feb 28 in non-leap years
        if date_of_birth.month == 2 and date_of_birth.day == 29:
            birthday_this_year = date(today.year, 2, 28)
            if today < birthday_this_year:
                age -= 1
        else:
            # For other invalid dates, just return the calculated age
            pass
        
    return age


def apply_query_limit(limit: int | None = None, max_limit: int = 1000) -> int:
    """
    Apply safe query limits to prevent unbounded queries.
    
    Args:
        limit: Requested limit (None means use default)
        max_limit: Maximum allowed limit
    
    Returns:
        Safe limit value between 100 and max_limit
    """
    DEFAULT_QUERY_LIMIT = 100
    if limit is None:
        return DEFAULT_QUERY_LIMIT
    return min(max(1, limit), max_limit)
