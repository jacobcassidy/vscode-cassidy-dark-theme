#!/usr/bin/env python3
# -*- coding: utf-8 -*-

r"""Python 3.12+ highlighting sample; no execution required.

Open in VS Code with language mode Python and a Cassidy Dark Dev theme.
Use Developer: Inspect Editor Tokens and Scopes on declarations and usages.
Compare semantic highlighting enabled and disabled; Python semantic tokens
depend on the installed Python language tooling.

Sections cover literals, annotations, decorators, classes, pattern matching,
comprehensions, generators, context managers, exceptions, and async syntax.

:param example: Docstring markup, ``inline code``, and :class:`Palette`.
:returns: Nothing; inspect this file as source.

>>> "syntax".upper()
'SYNTAX'
"""

from __future__ import annotations

import asyncio as aio
import math
import re
from collections.abc import AsyncIterator, Callable, Generator, Iterable, Iterator
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from enum import Enum, auto
from functools import cached_property, singledispatch, wraps
from io import StringIO
from pathlib import Path
from typing import (
    Annotated,
    Any,
    ClassVar,
    Final,
    Literal,
    NamedTuple,
    NotRequired,
    Protocol,
    Self,
    TypedDict,
    overload,
    runtime_checkable,
)

# A line comment: TODO inspect def, class, return, "strings", and # colors here.
# Python has comments and string literals; triple-quoted text is a string.

MAX_COLORS: Final[int] = 256
GLOBAL_COUNT = 0
café = "Unicode identifiers and text: 日本語 🚀"

LITERALS = {
    "integer": 42,
    "separated": 1_000_000,
    "hexadecimal": 0xFF_AA_00,
    "binary": 0b1010_0101,
    "octal": 0o755,
    "decimal": 3.14159,
    "exponent": 6.022e23,
    "complex": 2 + 3j,
    "negative": -12.5,
    "boolean": True,
    "false": False,
    "missing": None,
    "ellipsis": ...,
    "not_implemented": NotImplemented,
    "infinity": math.inf,
    "not_a_number": math.nan,
}

single_quoted = 'Single quotes: \'escaped\', newline\n, tab\t, slash\\'
double_quoted = "Double quotes: \"escaped\", \x41, \u0042, \U0001F680, \N{SNOWMAN}"
adjacent_strings = "Implicit " "concatenation"
raw_string = r"C:\themes\sample.json\n\u0041"
byte_string = b"Bytes: \x00\xff\r\n"
raw_bytes = br"\w+\s+\d+"
triple_single = '''Triple single quotes
with "double quotes" inside.'''
triple_double = """Triple double quotes
with 'single quotes' inside."""

name, number, width, precision = "accent", 3.14159, 10, 3
palette = {"accent": "#92c1fd"}
interpolated = f"{name}: {number:{width}.{precision}f} {{literal braces}}"
conversions = f"{name!s} | {name!r} | {café!a} | {number=}"
nested_quotes = f"Python 3.12 allows matching quotes: {palette["accent"]}"
raw_formatted = rf"\b{name}\b"
multiline_formatted = f"""Theme: {name}
Color: {palette['accent']}
Expression: {sum(value ** 2 for value in range(3))}
"""

# Regex scopes: named groups, references, assertions, classes, flags, and comments.
TOKEN_PATTERN = re.compile(
    r"""
    ^(?P<name>[A-Za-z_]\w*)    # Named capture and a character class.
    (?:\.(?P<index>\d{1,3}))?  # Optional noncapturing group and quantifier.
    (?=[:=])                  # Positive lookahead.
    (?!::)                    # Negative lookahead.
    [:=](?P<value>.*?)$        # Alternation class, lazy match, and end anchor.
    """,
    re.VERBOSE | re.MULTILINE,
)
repeated_word = re.compile(r"\b(?P<word>\w+)\s+(?P=word)\b", re.IGNORECASE)
lookbehind = re.compile(r"(?<=\s)[a-z]+(?<!_)(?=:)")

# Collections, unpacking, slices, starred expressions, and comprehensions.
colors = ["red", "green", "blue"]
coordinates = (10, 20)
unique = {"red", "green", "red"}
immutable = frozenset(unique)
merged = {**palette, "background": "#242424"}
first, *middle, last = [1, 2, 3, 4]
copied = [0, *middle, 5]
slice_sample = colors[1:3:1], colors[::-1], colors[:], colors[-1]
squares = [value ** 2 for value in range(10) if value % 2 == 0]
set_comprehension = {color.upper() for color in colors}
dict_comprehension = {index: color for index, color in enumerate(colors)}
generator_expression = (value for row in ((1, 2), (3, 4)) for value in row)
assignment_expression = [size for color in colors if (size := len(color)) > 3]

# Soft keyword "type", type parameters, unions, literals, and nested generics.
type Color = str | tuple[int, int, int]
type ThemeMode = Literal["dark", "light"]
type Registry[T] = dict[str, T]
type Number = Annotated[int | float, "nonnegative"]


class SwatchConfig(TypedDict):
    name: str
    color: Color
    opacity: NotRequired[float]


class Pair(NamedTuple):
    name: str
    value: Color


class Status(Enum):
    READY = auto()
    ACTIVE = auto()
    DONE = auto()


@runtime_checkable
class Renderer(Protocol):
    def render(self, value: object, /) -> str:
        ...


@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float
    label: str = field(default="origin", compare=False)

    def __matmul__(self, other: Self) -> float:
        return self.x * other.x + self.y * other.y


class BasePalette:
    def describe(self) -> str:
        return "base palette"


class Palette[T](BasePalette):
    """Generic class with public, protected, private, static, and magic names."""

    category: ClassVar[str] = "syntax"
    __slots__ = ("name", "_items", "__enabled")

    def __init__(self, name: str, items: Iterable[T] = ()) -> None:
        super().__init__()
        self.name = name
        self._items = list(items)
        self.__enabled = True

    @property
    def enabled(self) -> bool:
        return self.__enabled

    @enabled.setter
    def enabled(self, value: bool) -> None:
        self.__enabled = bool(value)

    @classmethod
    def empty(cls, name: str = "sample") -> Self:
        return cls(name)

    @staticmethod
    def normalize(name: str) -> str:
        return name.strip().lower()

    def describe(self) -> str:
        return f"{super().describe()}: {self.name}"

    def __repr__(self) -> str:
        return f"{type(self).__name__}({self.name!r}, {self._items!r})"

    def __len__(self) -> int:
        return len(self._items)

    def __iter__(self) -> Iterator[T]:
        yield from self._items

    def __getitem__(self, index: int) -> T:
        return self._items[index]

    def append(self, item: T) -> Self:
        self._items.append(item)
        return self


class CachedSample:
    @cached_property
    def total(self) -> int:
        return sum(range(10))


def identity[T](value: T) -> T:
    return value


def signature(
    value: Color,
    /,
    count: int = 2,
    *labels: str,
    enabled: bool = True,
    **metadata: Any,
) -> tuple[Color, int, tuple[str, ...], bool, dict[str, Any]]:
    """Positional-only, variadic, keyword-only, defaults, and return annotations."""
    return value, count, labels, enabled, metadata


@overload
def normalize(value: str) -> str:
    ...


@overload
def normalize(value: int) -> int:
    ...


def normalize(value: str | int) -> str | int:
    return value.strip() if isinstance(value, str) else abs(value)


def traced[**P, R](function: Callable[P, R]) -> Callable[P, R]:
    @wraps(function)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        return function(*args, **kwargs)

    return wrapper


@traced
def greet(name: str = "reader") -> str:
    return f"Hello, {name}!"


@singledispatch
def describe(value: object) -> str:
    return repr(value)


@describe.register
def _(value: int) -> str:
    return f"integer:{value}"


double = lambda value: value * 2


def make_counter(start: int = 0) -> Callable[[], int]:
    count = start

    def increment() -> int:
        nonlocal count
        global GLOBAL_COUNT
        count += 1
        GLOBAL_COUNT += 1
        return count

    return increment


def operators(value: int, other: int = 2) -> dict[str, object]:
    value += 1
    value -= 1
    value *= 2
    value /= 2
    value //= 1
    value %= 7
    value **= 2
    mask = 0b1010
    mask &= 0b1111
    mask |= 0b0001
    mask ^= 0b0010
    mask <<= 1
    mask >>= 1
    temporary = {"remove": True}
    del temporary["remove"]

    return {
        "arithmetic": (value + other - 1) * 2 ** 3 / 4 // 2 % 5,
        "bitwise": (~mask & 0xFF) | (mask ^ other),
        "shift": (mask << 1, mask >> 1),
        "comparison": 0 <= value < 100 and value != other,
        "identity": value is not None and temporary is not palette,
        "membership": "accent" in palette and "missing" not in palette,
        "logical": not temporary or bool(value),
        "conditional": "large" if value > other else "small",
        "matrix": Point(1, 2) @ Point(3, 4),
    }


def control_flow(values: Iterable[int]) -> int:
    total = 0

    for value in values:
        if value < 0:
            continue
        elif value > 100:
            break
        else:
            total += value
    else:
        total += 1

    while total > 20:
        total -= 5
    else:
        total += 1

    assert total >= 0, "Expected a nonnegative total"
    return total


def classify(value: object) -> str:
    match value:
        case {"kind": "color", "value": str(color), **metadata} if color.startswith("#"):
            return f"color:{color}, extra:{metadata!r}"
        case [first, *rest] as sequence:
            return f"sequence:{first!r}, rest:{rest!r}, size:{len(sequence)}"
        case Point(x=0, y=y):
            return f"vertical:{y}"
        case Status.READY | Status.DONE:
            return "idle"
        case None | False:
            return "empty"
        case int(number) if number > 0:
            return "positive integer"
        case _:
            return "other"


class SampleError(ValueError):
    pass


def parse_number(text: str) -> int:
    try:
        result = int(text, base=0)
    except (ValueError, TypeError) as error:
        raise SampleError(f"Invalid number: {text!r}") from error
    else:
        return result
    finally:
        text = text.strip()


def exception_groups(errors: list[Exception]) -> list[str]:
    messages = []

    try:
        if errors:
            raise ExceptionGroup("Sample failures", errors)
    except* ValueError as group:
        messages.extend(str(error) for error in group.exceptions)
    except* TypeError as group:
        messages.extend(repr(error) for error in group.exceptions)

    return messages


def sequence(limit: int = 3) -> Generator[int, str | None, str]:
    for index in range(limit):
        command = yield index
        if command == "stop":
            return "stopped"

    yield from range(limit, limit + 2)
    return "finished"


@contextmanager
def sample_buffer(text: str = "sample") -> Iterator[StringIO]:
    buffer = StringIO(text)
    try:
        yield buffer
    finally:
        buffer.close()


def context_usage() -> tuple[str, str]:
    with sample_buffer("red") as first, sample_buffer("blue") as second:
        return first.read(), second.read()


@asynccontextmanager
async def async_buffer(text: str) -> AsyncIterator[StringIO]:
    with sample_buffer(text) as buffer:
        await aio.sleep(0)
        yield buffer


async def async_sequence(limit: int = 3) -> AsyncIterator[int]:
    for index in range(limit):
        await aio.sleep(0)
        yield index


async def collect_async(stream: AsyncIterator[int]) -> list[int]:
    async with async_buffer("syntax") as buffer:
        heading = buffer.read()
        values = [value async for value in stream if value >= 0]

    async for value in async_sequence():
        values.append(value)

    return values if heading else []


# Built-in functions, attributes, keywords, and ordinary calls at usage sites.
builtins_sample = {
    "types": (str, int, float, complex, bool, bytes, bytearray, memoryview, object),
    "numeric": (abs(-3), round(math.pi, 2), divmod(7, 3), pow(2, 8)),
    "iterables": list(zip(range(3), reversed(colors), strict=True)),
    "sorted": sorted(colors, key=lambda color: (len(color), color)),
    "predicates": (all(colors), any(colors), callable(greet), isinstance(1, int)),
    "attributes": (getattr(Palette, "category"), hasattr(Palette, "enabled")),
    "encoding": (ord("A"), chr(0x41), hex(255), bin(10), oct(8)),
    "module": (__name__, __doc__, __debug__),
    "path": Path("samples") / "python-grammar-sample.py",
}

if __name__ == "__main__":
    print("Highlighting sample: inspect the source in VS Code; execution is optional.")
