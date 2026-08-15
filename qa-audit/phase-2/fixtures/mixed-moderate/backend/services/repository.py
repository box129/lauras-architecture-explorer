from backend.domain.task import Task


class TaskRepository:
    """In-memory task persistence for the audit fixture."""

    def __init__(self) -> None:
        self._tasks: list[Task] = []

    def save(self, task: Task) -> Task:
        self._tasks.append(task)
        return task

    def list_all(self) -> list[Task]:
        return list(self._tasks)

