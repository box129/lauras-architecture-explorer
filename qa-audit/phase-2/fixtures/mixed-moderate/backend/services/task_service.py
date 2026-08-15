from backend.domain.task import Task
from backend.services.repository import TaskRepository
from backend.services.validator import validate_title


class TaskService:
    """Validates and stores tasks."""

    def __init__(self, repository: TaskRepository) -> None:
        self.repository = repository

    def create(self, title: str, owner: str) -> Task:
        task = Task(title=validate_title(title), owner=owner)
        return self.repository.save(task)

    def complete(self, task: Task) -> Task:
        task.complete()
        return task

