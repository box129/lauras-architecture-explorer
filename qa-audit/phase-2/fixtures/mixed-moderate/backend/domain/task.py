from dataclasses import dataclass


@dataclass
class Task:
    """A unit of work owned by one user."""

    title: str
    owner: str
    completed: bool = False

    def complete(self) -> None:
        self.completed = True

