from .models import RepositoryRecord


def parse_repository(name: str, path: str) -> RepositoryRecord:
    """Create a repository record after validating its path."""
    if not path:
        raise ValueError("path is required")
    return RepositoryRecord(name=name, path=path)

