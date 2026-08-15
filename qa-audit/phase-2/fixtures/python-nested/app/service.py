from .models import RepositoryRecord
from .parser import parse_repository


class RepositoryService:
    """Coordinates repository parsing and display."""

    def register(self, name: str, path: str) -> RepositoryRecord:
        return parse_repository(name, path)

    def describe(self, record: RepositoryRecord) -> str:
        return record.label()

