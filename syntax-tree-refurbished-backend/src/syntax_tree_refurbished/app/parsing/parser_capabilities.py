"""Parser capability registry."""

DEEP_PARSE_LANGUAGES = ("javascript", "python", "typescript")


def is_deep_parse_language(language: str) -> bool:
    return language in DEEP_PARSE_LANGUAGES

