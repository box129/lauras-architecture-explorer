from backend.domain.errors import TaskValidationError


def validate_title(title: str) -> str:
    cleaned = title.strip()
    if not cleaned:
        raise TaskValidationError("title is required")
    return cleaned

