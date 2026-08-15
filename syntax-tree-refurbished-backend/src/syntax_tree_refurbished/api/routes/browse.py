"""Local directory browsing for the repository-path picker.

Participant 1 formative usability finding (non-scored dry run): "I would
love it if i didn't only have to copy the file path... you could make the
application open file exploerer and i could easily navigate to the folder I
want from there."

A real OS-native folder dialog cannot solve this for a browser-hosted local
app: the browser File System Access API (``window.showDirectoryPicker()``)
deliberately never exposes the absolute host filesystem path of a selected
folder, and this product needs that absolute path server-side to run static
analysis. This endpoint is the smallest server-side equivalent: a read-only,
directory-names-only listing a modal folder browser in the frontend can walk
through, so a user never has to manually copy/paste a path string.

Deliberately narrow, read-only surface:
  - never returns file contents, only directory names;
  - never lists files, only subdirectories;
  - a path is only ever handed back to the analyze flow when the user
    explicitly confirms a selection in the UI -- this endpoint only
    supports *browsing*, it never starts an analysis itself.
"""

from __future__ import annotations

import os
import platform
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


router = APIRouter(tags=["browse"])


class BrowseDirectoryEntry(BaseModel):
    name: str
    path: str


class BrowseDirectoriesResponse(BaseModel):
    path: str | None
    parent: str | None
    directories: list[BrowseDirectoryEntry]


@router.get("/fs/browse-directories", response_model=BrowseDirectoriesResponse)
def browse_directories(path: str | None = None) -> BrowseDirectoriesResponse:
    if path is None or path.strip() == "":
        return _roots_response()

    target = Path(path)
    if not target.is_absolute():
        raise HTTPException(status_code=400, detail="Path must be absolute.")
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Path does not exist: {path}")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {path}")

    try:
        directories = _list_subdirectories(target)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {path}") from exc

    resolved = str(target.resolve())
    parent = str(target.parent.resolve()) if target.parent != target else None
    return BrowseDirectoriesResponse(path=resolved, parent=parent, directories=directories)


def _roots_response() -> BrowseDirectoriesResponse:
    """Starting point when no path is given yet: OS drive roots on Windows,
    the filesystem root elsewhere -- plus the user's home directory, which
    is usually the more useful actual starting point for finding a repo."""
    directories: list[BrowseDirectoryEntry] = []
    if platform.system() == "Windows":
        import string

        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                directories.append(BrowseDirectoryEntry(name=drive, path=drive))
    else:
        directories.append(BrowseDirectoryEntry(name="/", path="/"))

    home = Path.home()
    home_str = str(home)
    if not any(entry.path == home_str for entry in directories):
        directories.insert(0, BrowseDirectoryEntry(name=f"Home ({home.name})", path=home_str))

    return BrowseDirectoriesResponse(path=None, parent=None, directories=directories)


def _list_subdirectories(target: Path) -> list[BrowseDirectoryEntry]:
    entries: list[BrowseDirectoryEntry] = []
    for child in sorted(target.iterdir(), key=lambda item: item.name.lower()):
        if child.name.startswith("."):
            continue
        try:
            if not child.is_dir():
                continue
        except OSError:
            continue
        entries.append(BrowseDirectoryEntry(name=child.name, path=str(child)))
    return entries
