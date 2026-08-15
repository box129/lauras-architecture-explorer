class RepositoryRecord:
    """Stored repository metadata."""

    def __init__(self, name: str, path: str) -> None:
        self.name = name
        self.path = path

    def label(self) -> str:
        return f"{self.name}:{self.path}"

