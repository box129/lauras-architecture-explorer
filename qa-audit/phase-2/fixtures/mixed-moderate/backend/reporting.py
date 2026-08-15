from backend.domain.task import Task


def summarize_tasks(tasks: list[Task]) -> dict[str, int]:
    complete = sum(1 for task in tasks if task.completed)
    return {"total": len(tasks), "complete": complete}

