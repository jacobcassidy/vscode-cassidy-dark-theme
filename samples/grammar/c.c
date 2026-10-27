/* C17 highlighting sample for Cassidy Dark Preview; inspect as source.
 * Standard-library-only translation unit; no main function or execution needed.
 * Check with: clang -std=c17 -fsyntax-only samples/grammar/c.c
 */
#include <assert.h>
#include <complex.h>
#include <inttypes.h>
#include <stdalign.h>
#include <stdarg.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define THEME_NAME "Cassidy Dark"
#define MAX_COLORS 1000000
#define SQUARE(value) ((value) * (value))
#define STRINGIFY_INNER(value) #value
#define STRINGIFY(value) STRINGIFY_INNER(value)
#define JOIN(left, right) left##right
#define SAMPLE_LOG(...) fprintf(stderr, __VA_ARGS__)
#define CLAMP(value, low, high) \
    ((value) < (low) ? (low) : ((value) > (high) ? (high) : (value)))

#if defined(__STDC_VERSION__) && __STDC_VERSION__ >= 201112L
_Static_assert(sizeof(uint32_t) == 4, "Expected a 32-bit integer");
#elif defined(SAMPLE_LEGACY)
#pragma message("Legacy syntax probe")
#else
#error "This sample requires C11 or later"
#endif

#if 0
// Inactive code probes and an intentionally inactive diagnostic.
#error "Inactive preprocessor branch"
#endif

typedef enum Status {
    STATUS_PENDING = 0,
    STATUS_ACTIVE = 1 << 0,
    STATUS_DONE = 1 << 1
} Status;

typedef union ColorValue {
    uint32_t packed;
    unsigned char channels[4];
} ColorValue;

typedef struct Swatch {
    const char *name;
    ColorValue color;
    double opacity;
    bool enabled;
    unsigned selected : 1;
    unsigned priority : 3;
    struct Swatch *next;
} Swatch;

typedef struct Buffer {
    size_t length;
    unsigned char bytes[];
} Buffer;

typedef int (*CompareSwatches)(const Swatch *, const Swatch *);
static _Atomic unsigned created = 0;
static _Thread_local int thread_status = 0;
alignas(16) static unsigned char aligned_bytes[32];

static const char *strings[] = {
    "Plain text and Unicode café 日本語",
    "Quotes \"text\", slash \\, bell\a backspace\b tab\t newline\n return\r formfeed\f vertical\v",
    "Hex \x41, octal \101, null \0, Unicode \u2603 \U0001F680",
    "Adjacent " "string literals",
    u8"UTF-8 string"
};

static const wchar_t *wide_string = L"Wide string \u2603";

void sample_literals(void) {
    int decimal = 42;
    unsigned long long separated_without_separators = 1000000ULL;
    int hexadecimal = 0xFFAA00;
    int octal = 0755;
    double fraction = 3.14159;
    float exponent = 6.022e23F;
    double hex_float = 0x1.fp+2;
    long double extended = 1.25L;
    double complex imaginary = 2.0 + 3.0 * I;
    char character = 'a';
    char escaped = '\'';
    wchar_t wide = L'\u2603';
    bool flags[] = {true, false};
    const void *missing = NULL;
    int matrix[2][3] = {{1, 2, 3}, {4, 5, 6}};
    int designated[5] = {[0] = 10, [4] = 50};
    Swatch accent = {.name = "accent", .color = {.packed = 0x92c1fd}, .opacity = 1, .enabled = true};
    Swatch *pointer = &accent;

    pointer->priority = 3;
    (*pointer).selected = 1;
    atomic_fetch_add_explicit(&created, 1, memory_order_relaxed);
    printf("%s: %#" PRIx32 " (%zu bytes)\n", pointer->name, pointer->color.packed, sizeof *pointer);
    (void)decimal; (void)separated_without_separators; (void)hexadecimal; (void)octal;
    (void)fraction; (void)exponent; (void)hex_float; (void)extended; (void)imaginary;
    (void)character; (void)escaped; (void)wide; (void)flags; (void)missing;
    (void)matrix; (void)designated;
}

static inline double sample_opacity(double value) {
    return CLAMP(value, 0.0, 1.0);
}

int sample_operators(int input, unsigned mask) {
    int count = input;

    count += 1;
    count -= 1;
    count *= 2;
    count /= 2;
    count %= 7;
    mask &= 0xff;
    mask |= 1;
    mask ^= 2;
    mask <<= 1;
    mask >>= 1;
    count++;
    --count;

    const bool comparison = count >= 0 && count <= 100 && count != 42;
    const unsigned bits = (~mask & 0xff) | (mask ^ 3);
    const int conditional = comparison ? count : -count;
    const size_t layout = sizeof(Swatch) + alignof(Swatch) + offsetof(Swatch, opacity);
    const char *type_name = _Generic(input, int: "int", double: "double", default: "other");

    return conditional + (int)bits + (int)layout + (int)strlen(type_name);
}

int sample_flow(const int *restrict values, size_t length) {
    int total = 0;

    for (size_t index = 0; index < length; index++) {
        if (values[index] < 0) {
            continue;
        } else if (values[index] > 100) {
            break;
        } else {
            total += values[index];
        }
    }

    while (total > 20) {
        total -= 5;
    }

    do {
        total++;
    } while (total < 3);

    switch (total) {
        case 0:
            goto done;
        case 1:
        case 2:
            total += 2;

            break;
        default:
            total += 3;
    }

done:
    return total;
}

double sample_variadic(size_t count, ...) {
    va_list arguments;
    double total = 0;

    va_start(arguments, count);

    for (size_t index = 0; index < count; index++) {
        total += va_arg(arguments, double);
    }

    va_end(arguments);

    return total;
}

int sample_compare(const Swatch *left, const Swatch *right) {
    return strcmp(left->name, right->name);
}

CompareSwatches sample_callback = &sample_compare;
static const char *macro_text = STRINGIFY(SQUARE(2));
static int JOIN(sample_, identifier) = 42;
#undef MAX_COLORS
