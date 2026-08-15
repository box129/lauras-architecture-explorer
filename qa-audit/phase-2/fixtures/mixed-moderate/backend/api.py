from backend.domain.task import Task
from backend.services.repository import TaskRepository
from backend.services.task_service import TaskService


def create_task(title: str, owner: str) -> Task:
    repository = TaskRepository()
    service = TaskService(repository)
    return service.create(title, owner)

