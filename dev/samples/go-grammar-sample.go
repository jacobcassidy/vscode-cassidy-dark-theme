// Package grammarsamples contains Go 1.23+ source probes for Cassidy Dark Dev.
// Inspect declarations and usages with Developer: Inspect Editor Tokens and Scopes.
// Compare semantic highlighting enabled and disabled with Go language tooling.
// This standalone file uses only the standard library; execution is unnecessary.
package grammarsamples

import (
	"context"
	"errors"
	format "fmt"
	_ "image/png" // Blank import and initialization-only dependency.
	"io"
	"iter"
	"regexp"
	"strings"
	"sync"
	"time"
	"unsafe"
)

// TODO: inspect comments containing func, return, "strings", and /* delimiters */.
/* A block comment with Unicode café 日本語 and punctuation: []{}<> := <- ... */

type Status uint8

const (
	Pending Status = iota
	Active
	Done
	flagRead = 1 << iota
	flagWrite
)

const ThemeName = "Cassidy Dark"
const MaxColors = 1_000_000

// Untyped constants, bases, separators, decimal and hexadecimal floats, complex.
var Literals = map[string]any{
	"integer":         42,
	"negative":        -42,
	"binary":          0b1010_0101,
	"octal":           0o755,
	"legacyOctal":     0755,
	"hexadecimal":     0xFF_AA_00,
	"fraction":        3.14159,
	"leadingFraction": .125,
	"exponent":        6.022e23,
	"hexFloat":        0x1.fp+2,
	"imaginary":       3i,
	"complex":         2 + 3i,
	"true":            true,
	"false":           false,
	"nil":             nil,
	"rune":            '界',
	"escapedRune":     '\n',
	"unicodeRune":     '\u2603',
	"longUnicodeRune": '\U0001F680',
	"octalRune":       '\101',
	"hexRune":         '\x41',
	"string":          "Quotes \"text\", slash \\, bell\a backspace\b formfeed\f newline\n return\r tab\t vertical\v",
	"unicode":         "Café 日本語 🚀 \u2603 \U0001F680 \x41 \101",
	"raw": `Raw string: C:\themes\sample.json, "quotes", and literal \n
Second line with <tag key="value"> & entities.`,
}

var IdentifierPattern = regexp.MustCompile(`(?m)^(?P<name>[A-Za-z_]\w*)\s*[:=]\s*(.*?)$`)
var café = "Unicode identifier"

// Aliases, named types, generic constraints, approximation, unions, embedding.
type Label = string
type Labels []Label
type Lookup map[string]*Swatch
type Callback func(context.Context, ...string) (int, error)
type Direction chan<- *Swatch
type Matrix [2][3]float64

type Number interface {
	~int | ~int64 | ~float64
}

type Renderer interface {
	io.StringWriter
	Render(context.Context, *Swatch) error
}

type Pair[K comparable, V any] struct {
	Key   K
	Value V
}

type Swatch struct {
	sync.RWMutex
	Name    string  `json:"name" yaml:"name" validate:"required"`
	Color   string  `json:"color,omitempty"`
	Opacity float64 `json:"opacity"`
	enabled bool
}

// NewSwatch demonstrates a public function, named results, and keyed literals.
func NewSwatch(name string, options ...func(*Swatch)) (swatch *Swatch, err error) {
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("empty swatch name")
	}

	swatch = &Swatch{Name: name, Color: "#92c1fd", Opacity: 1, enabled: true}

	for _, option := range options {
		option(swatch)
	}

	return swatch, nil
}

func (swatch *Swatch) SetColor(color string) {
	swatch.Lock()

	defer swatch.Unlock()

	swatch.Color = color
}

func (swatch *Swatch) String() string {
	return format.Sprintf("%s=%s (%.2f%%)", swatch.Name, swatch.Color, swatch.Opacity*100)
}

func (status Status) String() string {
	switch status {
	case Pending:
		return "pending"
	case Active:
		return "active"
	case Done:
		return "done"
	default:
		return "unknown"
	}
}

// Generic functions, type inference, explicit instantiation, and zero values.
func Sum[T Number](values ...T) T {
	var total T

	for _, value := range values {
		total += value
	}

	return total
}

func Index[K comparable, V any](pairs []Pair[K, V]) map[K]V {
	result := make(map[K]V, len(pairs))

	for _, pair := range pairs {
		result[pair.Key] = pair.Value
	}

	return result
}

func Collections() any {
	array := [...]int{1, 2, 3, 4}
	slice := []int{0: 10, 2: 30}
	matrix := Matrix{{1, 2, 3}, {4, 5, 6}}
	fullSlice := array[1:3:4]
	palette := map[string]Swatch{"accent": {Name: "accent", Color: "#92c1fd"}}
	pair := Pair[string, int]{Key: "accent", Value: 42}
	pointer := &pair
	key, value := pointer.Key, (*pointer).Value
	first, rest := slice[0], slice[1:]
	cloned := append([]int(nil), slice...)
	buffer := make([]byte, 8, 16)
	allocated := new(Swatch)
	copied := copy(buffer, "sample")

	delete(palette, "missing")
	clear(cloned)
	allocated.Name = "allocated"
	_, exists := palette["accent"]

	return []any{array, matrix, fullSlice, pair, key, value, first, rest,
		len(buffer), cap(buffer), copied, exists, allocated, Sum(1, 2, 3), Sum[float64](1.5, 2.5)}
}

func Operators(input, other int) map[string]any {
	count, mask := input, 0b1010
	count += 1
	count -= 1
	count *= 2
	count /= 2
	count %= 7
	mask &= 0xff
	mask |= 1
	mask ^= 2
	mask &^= 4
	mask <<= 1
	mask >>= 1
	count++
	count--

	return map[string]any{
		"arithmetic": (count + other - 1) * 2 / 4 % 5,
		"bitwise":    (^mask & 0xff) | (mask^other)&^2,
		"shifts":     []int{mask << 1, mask >> 1},
		"comparison": count >= 0 && count <= 100 && count != other,
		"equality":   count == other || count > other || count < other,
		"negation":   !(count == 0),
		"conversion": float64(count),
		"complex":    complex(float64(count), 2),
		"components": []float64{real(2 + 3i), imag(2 + 3i)},
		"limits":     []int{min(input, other), max(input, other)},
		"layout":     []uintptr{unsafe.Sizeof(count), unsafe.Alignof(count), unsafe.Offsetof(Swatch{}.Color)},
	}
}

func ControlFlow(values []int) int {
	total := 0

outer:
	for index := 0; index < len(values); index++ {
		for _, value := range values {
			if value < 0 {
				continue outer
			} else if value > 100 {
				break outer
			} else {
				total += value
			}
		}
	}

	for total > 20 {
		total -= 5
	}

	for range 3 {
		total++
	}

	if doubled := total * 2; doubled < 10 {
		total = doubled
	}

	switch total {
	case 0:
		total++

		fallthrough
	case 1, 2:
		total += 2
	default:
		total += 3
	}

	switch {
	case total > 100:
		goto done
	case total < 0:
		return 0
	}

done:
	return total
}

func TypeSwitch(value any) string {
	if swatch, ok := value.(*Swatch); ok && swatch != nil {
		return swatch.Name
	}

	switch typed := value.(type) {
	case nil:
		return "nil"
	case string:
		return typed
	case int, float64:
		return format.Sprint(typed)
	case interface{ String() string }:
		return typed.String()
	default:
		return format.Sprintf("%T", typed)
	}
}

// Closures, returned functions, anonymous structs, and method expressions.
func Counter(start int) func() int {
	count := start

	return func() int {
		count++

		return count
	}
}

var MethodExpression = (*Swatch).SetColor
var Anonymous = struct {
	Name  string
	Ready bool
}{Name: ThemeName, Ready: true}

// Range-over-function iterators and the yield callback (Go 1.23+).
func Sequence(limit int) iter.Seq[int] {
	return func(yield func(int) bool) {
		for index := range limit {
			if !yield(index) {
				return
			}
		}
	}
}

func Collect() []int {
	var values []int

	for value := range Sequence(3) {
		values = append(values, value)
	}

	return values
}

// Channels, goroutines, directional types, send/receive, select, and cancellation.
func Pipeline(ctx context.Context, input <-chan *Swatch, output chan<- string) error {
	ticker := time.NewTicker(time.Second)

	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case swatch, open := <-input:
			if !open {
				return nil
			}

			if swatch == nil {
				continue
			}

			select {
			case output <- swatch.String():
			case <-ctx.Done():
				return ctx.Err()
			}
		case <-ticker.C:
			continue
		}
	}
}

func Launch() <-chan int {
	results := make(chan int, 1)

	go func() {
		defer close(results)

		results <- 42
	}()

	return results
}

func TryReceive(input <-chan int) (int, bool) {
	select {
	case value, open := <-input:
		return value, open
	default:
		return 0, false
	}
}

func RecoverSample(action func()) (err error) {
	defer func() {
		if value := recover(); value != nil {
			err = format.Errorf("recovered: %v", value)
		}
	}()

	action()

	return err
}

func PanicSample() {
	panic("Synthetic panic probe; this function is not called")
}
