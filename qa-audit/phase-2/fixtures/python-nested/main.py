from app.service import RepositoryService


def start_analysis(repository_path: str) -> str:
    service = RepositoryService()
    record = service.register("python-fixture", repository_path)
    return service.describe(record)

