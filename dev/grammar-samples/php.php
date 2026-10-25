<?php

/**
 * PHP 8.2+ highlighting sample; no execution required.
 * Open in VS Code with language mode PHP and a Cassidy Dark Dev theme.
 * Use Developer: Inspect Editor Tokens and Scopes on declarations and usages.
 * Compare semantic highlighting enabled and disabled to inspect both layers.
 * Scope names depend on the installed PHP grammar and language tooling.
 *
 * The original property-type regression probes are retained below. Unqualified,
 * qualified, nullable, and promoted types can receive different grammar scopes.
 * Declaration-shaped text in comments and strings must stay comment/string text.
 *
 * @package CassidyThemePreview
 * @since 1.2.1
 */

declare(strict_types=1);

namespace CassidyThemePreview;

// Namespace imports: class, alias, grouped class, function, and constant forms.
use Attribute;
use Closure;
use DateTimeImmutable as Timestamp;
use Generator;
use JsonSerializable;
use RuntimeException;
use Stringable;
use CassidyThemePreview\{Widget as SampleWidget, Alternate as OtherWidget};
use function array_map;
use function strlen as textLength;
use const PHP_INT_MAX as MAX_INTEGER;

// Line comments: TODO inspect class, return, "$variables", and #colors here.
# Hash-style comments are also part of the PHP grammar.
/* Block comment: public Widget $notAProperty; and <?= "not embedded PHP" ?> */

const DEFAULT_COLOR = '#92c1fd';
const COLOR_MAP = ['accent' => DEFAULT_COLOR, 'background' => '#242424'];

interface Readable {}

interface Writable {}

class Widget {}

class Alternate {}

class BaseRecord {}

class GrammarPreview extends BaseRecord
{
    // Class types: compare plain, nullable, qualified, and built-in names.
    public Widget $plain;
    protected ?Widget $nullable;
    private \CassidyThemePreview\Widget $qualified;
    public ?\CassidyThemePreview\Widget $nullableQualified;
    public \DateTimeImmutable $builtinQualified;
    public self $sameClass;
    protected parent $parentClass;

    // Modifiers and variable punctuation ($).
    public static Widget $shared;
    private readonly Widget $immutable;
    public $untyped;

    // Primitive types should use keyword.other.type.php.
    public int $count;
    public float $ratio;
    public bool $enabled;
    public string $title;
    public array $items;
    public object $payload;
    public iterable $sequence;
    public mixed $anything;
    public null $nothing;
    public true $always;
    public false $never;

    // Union, intersection, and DNF: inspect every type and | & ( ).
    public Widget|Alternate $union;
    public Widget|null $explicitNullable;
    public string|false $primitiveUnion;
    public Readable&Writable $intersection;
    public (Readable&Writable)|Widget $dnf;
    public Widget | Alternate | null $spacedUnion;

    // Whitespace and case probes: compare with the simple declaration.
    public
        Widget
        $multiline;
    PUBLIC Widget $uppercaseModifier;

    // Promoted parameters include visibility modifiers; compare their type scopes.
    public function __construct(
        public Widget $promoted,
        protected ?Widget $promotedNullable,
        private readonly Widget $promotedReadonly,
    ) {}

    // Controls: ordinary parameters and return types have no property modifier.
    // Compare their scopes with $plain; the base PHP grammar handles them.
    public function compare(Widget $parameter, ?Widget $optional): Widget
    {
        $local = new Widget();

        return $local;
    }

    // Regression probes: declaration-shaped text must remain comment/string.
    // public Widget $commentProbe;
    /* private Widget $blockCommentProbe; */
    public string $stringProbe = 'public Widget $notAProperty;';
}

// Attributes, named arguments, promoted properties, and bitwise flags.
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD | Attribute::IS_REPEATABLE)]
final class Highlight
{
    public function __construct(
        public readonly string $name,
        public array $options = [],
    ) {}
}

enum ThemeMode: string
{
    case DARK = 'dark';
    case LIGHT = 'light';

    public function label(): string
    {
        return match ($this) {
            self::DARK => 'Dark',
            self::LIGHT => 'Light',
        };
    }
}

enum Priority
{
    case LOW;
    case NORMAL;
    case HIGH;
}

// Trait composition, abstract methods, conflict resolution, and method aliases.
trait NamedDescription
{
    public function describe(): string
    {
        return 'named';
    }
}

trait ColoredDescription
{
    abstract protected function formatName(string $name): string;

    public function describe(): string
    {
        return $this->formatName('colored');
    }

    public function traitLocation(): array
    {
        return [__TRAIT__, __METHOD__];
    }
}

/**
 * A class with PHPDoc types, attributes, trait adaptations, and magic methods.
 *
 * @template T of Widget
 * @property-read string $label
 * @method static self create(string $name)
 * @implements JsonSerializable
 * @see GrammarPreview::compare()
 */
#[Highlight(name: 'record', options: ['mode' => ThemeMode::DARK])]
final class HighlightRecord extends GrammarPreview implements Stringable, JsonSerializable
{
    use NamedDescription, ColoredDescription {
        NamedDescription::describe insteadof ColoredDescription;
        ColoredDescription::describe as protected colorDescription;
    }

    public const KIND = 'syntax';
    protected const LIMIT = 256;
    private const FLAGS = ['enabled' => true];
    public static int $created = 0;

    protected function formatName(string $name): string
    {
        return strtoupper($name);
    }

    #[Highlight('method')]
    final public function render(string $prefix = 'sample'): string
    {
        return $prefix . ':' . $this->describe() . ':' . parent::class;
    }

    public function __toString(): string
    {
        return $this->render();
    }

    public function __invoke(string $name): string
    {
        return $this->formatName($name);
    }

    public function __get(string $name): mixed
    {
        return $name === 'label' ? self::KIND : null;
    }

    public function jsonSerialize(): mixed
    {
        return ['kind' => self::KIND, 'flags' => self::FLAGS];
    }

    public function __serialize(): array
    {
        return ['created' => self::$created];
    }

    public function __unserialize(array $data): void
    {
        self::$created = (int) ($data['created'] ?? 0);
    }

    public function location(): array
    {
        return [__CLASS__, __METHOD__, static::class, self::class, $this::class];
    }
}

// Readonly classes are available from PHP 8.2; static return types preserve subtype.
readonly class ColorValue
{
    public function __construct(public string $color, public float $opacity = 1.0) {}

    public function withColor(string $color): static
    {
        return new static($color, $this->opacity);
    }
}

abstract class Formatter
{
    abstract public function format(string $value): string;

    final protected function normalize(string $value): string
    {
        return trim($value);
    }
}

function anonymousClass(): Formatter
{
    return new class('sample') extends Formatter {
        public function __construct(private string $prefix) {}

        public function format(string $value): string
        {
            return $this->prefix . ':' . $this->normalize($value);
        }
    };
}

// Integers, separators, bases, exponents, booleans, null, casts, and magic constants.
function literalSamples(): array
{
    return [
        'integer' => 42,
        'separated' => 1_000_000,
        'hexadecimal' => 0xFF_AA_00,
        'binary' => 0b1010_0101,
        'octal' => 0o755,
        'legacyOctal' => 0755,
        'float' => 3.14159,
        'exponent' => 6.022e23,
        'negative' => -12.5,
        'boolean' => true,
        'false' => false,
        'missing' => null,
        'maximum' => MAX_INTEGER,
        'magic' => [__FILE__, __DIR__, __LINE__, __FUNCTION__, __NAMESPACE__],
        'casts' => [(int) '42', (float) '3.5', (bool) 1, (string) 12, (array) null, (object) []],
    ];
}

function stringSamples(string $name, GrammarPreview $record, array $colors): array
{
    $single = 'Single quotes: \'escaped\', backslash\\, literal $variable and \n';
    $double = "Double quotes: \"escaped\", newline\n, tab\t, hex\x41, octal\101, Unicode\u{1F680}";
    $unicode = 'Café — 日本語 — 🚀';
    $interpolated = "Hello $name; title: {$record->title}; color: {$colors['accent']}";
    $offset = "First color: $colors[0]";
    $heredoc = <<<TEXT
        Heredoc interpolates $name and {$record->title}.
        Newlines, "quotes", braces, and escapes such as \n remain visible probes.
        TEXT;

    $nowdoc = <<<'RAW'
        Nowdoc preserves $name, {$record->title}, \n, and public Widget $notAProperty;.
        RAW;

    $pattern = '~^(?<name>[\p{L}_][\p{L}\p{N}_]*)(?:\.(\d{1,3}))?(?=[:=])[:=](.*?)$~imu';
    $quotedPattern = '/(?<quote>["\']).*?\k<quote>/s';

    return compact('single', 'double', 'unicode', 'interpolated', 'offset', 'heredoc', 'nowdoc', 'pattern', 'quotedPattern');
}

// Arrays: short/long forms, key/value arrows, unpacking, destructuring, and references.
function arraySamples(array $values): array
{
    $long = array('red', 'green', 'blue');
    $short = ['name' => 'accent', 'color' => DEFAULT_COLOR];

    /** @var array<string, string> $merged */
    $merged = [...COLOR_MAP, 'foreground' => '#f8f8f8'];
    [$first, , $third] = $long;
    ['name' => $alias, 'color' => $color] = $short;
    list($left, $right) = [10, 20];
    $reference = &$values;
    $reference[] = [$first, $third, $alias, $color, $left, $right];

    foreach ($reference as $key => &$value) {
        $value = ['key' => $key, 'value' => $value];
    }

    unset($value);

    return [$merged, $reference];
}

/**
 * Parameter and return annotations, PHPDoc generics, array shapes, and callables.
 *
 * @template T
 * @param iterable<T> $items
 * @param callable(T): string $formatter
 * @param array{mode?: ThemeMode, color?: string} $options
 * @param resource|null $stream Documentation-only type; not a native parameter type.
 * @return array<int, string>
 * @throws RuntimeException If an item cannot be formatted.
 * @deprecated Example annotation for semantic-token comparison.
 */
function formatItems(iterable $items, callable $formatter, array $options = [], $stream = null): array
{
    $result = [];

    foreach ($items as $item) {
        $result[] = $formatter($item);
    }

    return $result;
}

/**
 * @param ?array<string, string> $options Nullable PHPDoc and native type scopes.
 * @return ?ColorValue A nullable class name in a documentation type position.
 */
function optionalColor(?array $options = null): ?ColorValue
{
    return isset($options['color']) ? new ColorValue($options['color']) : null;
}

function &findReference(array &$items, string|int $key): mixed
{
    return $items[$key];
}

function callableSamples(string $prefix = 'theme', string ...$labels): array
{
    $count = 0;
    $closure = static function (string $label) use ($prefix, &$count): string {
        static $calls = 0;

        $calls++;
        $count++;

        return "{$prefix}:{$label}:{$calls}";
    };

    $arrow = static fn (int $number): int => $number * 2;
    $firstClass = textLength(...);
    $methodCallable = ThemeMode::DARK->label(...);
    $bound = Closure::fromCallable($closure);
    $date = new Timestamp(datetime: '2026-01-01T00:00:00Z');

    return [
        array_map($closure, $labels),
        $arrow(number: 3),
        $firstClass('syntax'),
        $methodCallable(),
        $bound('accent'),
        $date->format(format: 'c'),
    ];
}

function operatorSamples(int $input, ?GrammarPreview $record = null): array
{
    $value = $input;
    $value += 2;
    $value -= 1;
    $value *= 3;
    $value /= 2;
    $value %= 7;
    $value **= 2;
    $mask = 0b1010;
    $mask &= 0b1111;
    $mask |= 0b0001;
    $mask ^= 0b0010;
    $mask <<= 1;
    $mask >>= 1;
    $optional = null;
    $optional ??= DEFAULT_COLOR;
    $text = 'syntax';
    $text .= '-sample';
    $value++;
    --$value;
    $logical = (($input > 0 and $input < 100) xor ($input === 0 or $input === -1));
    $className = SampleWidget::class;
    $instance = new $className();
    $copy = clone $instance;
    $property = 'title';
    $variableName = 'color';
    $$variableName = $optional;

    return [
        'arithmetic' => (($value + 1 - 2) * 3 ** 2 / 4) % 5,
        'bitwise' => (~$mask & 0xFF) | ($mask ^ 3),
        'shifts' => [$mask << 1, $mask >> 1],
        'comparison' => $value >= 0 && $value <= 100 && $value !== INF,
        'equality' => [$input == 2, $input === 2, $input != 2, $input !== 2, $input <> 2],
        'spaceship' => $input <=> 0,
        'logical' => !$logical || ($input > 0 && $input < 10),
        'conditional' => $value > 0 ? 'positive' : 'other',
        'elvis' => $text ?: 'fallback',
        'coalesce' => $record?->title ?? $optional,
        'dynamicProperty' => $record?->{$property},
        'variableVariable' => $$variableName,
        'instance' => $copy instanceof Widget,
        'unionInstance' => $copy instanceof OtherWidget,
        'suppressed' => @textLength($text),
        'qualified' => \strlen($text),
        'relativeNamespace' => namespace\DEFAULT_COLOR,
    ];
}

function controlFlow(array $values): int
{
    $total = 0;

    for ($index = 0; $index < count($values); $index++) {
        if ($values[$index] < 0) {
            continue;
        } elseif ($values[$index] > 100) {
            break;
        } else {
            $total += $values[$index];
        }
    }

    while ($total > 20) {
        $total -= 5;
    }

    do {
        $total++;
    } while ($total < 3);

    switch ($total) {
        case 0:
            $total = 1;

            break;

        case 1:
        case 2:
            $total += 2;

            break;

        default:
            $total += 3;
    }

    $result = match (true) {
        $total < 10 => 10,
        $total < 20, $total === 20 => 20,
        default => $total,
    };

    return $result;
}

function exceptionSample(string $text): array
{
    try {
        $result = json_decode($text, associative: true, flags: JSON_THROW_ON_ERROR);

        return is_array($result) ? $result : throw new RuntimeException('Expected an object or array');
    } catch (\JsonException | \TypeError $error) {
        throw new RuntimeException('Invalid sample JSON', previous: $error);
    } finally {
        $text = trim($text);
    }
}

function optionalCatch(): bool
{
    try {
        throw new RuntimeException('Optional catch binding');
    } catch (RuntimeException) {
        return false;
    }
}

function neverReturns(string $reason): never
{
    throw new \LogicException($reason);
}

/** @return Generator<int, int|string, string|null, string> */
function sequence(int $limit = 3): Generator
{
    yield 'start';

    for ($index = 0; $index < $limit; $index++) {
        $command = yield $index => $index * 2;

        if ($command === 'stop') {
            return 'stopped';
        }
    }

    yield from ['red', 'green', 'blue'];

    return 'finished';
}

// Language constructs, variable scopes, superglobals, labels, and include forms.
function languageConstructs(array $input, bool $stop = false): void
{
    global $sampleGlobal;

    $sampleGlobal = $input['value'] ?? null;
    $request = $_GET['sample'] ?? $_POST['sample'] ?? $_SERVER['REQUEST_METHOD'] ?? 'sample';
    $exists = isset($input['value']);
    $blank = empty($input['value']);
    $evaluated = eval('return 1 + 2;');

    echo htmlspecialchars((string) $request, ENT_QUOTES), ':', (int) $exists;
    print $blank ? 'empty' : 'present';
    unset($input['value']);

    if ($stop) {
        exit('Sample exit keyword');
    }

    goto finished;

    finished:
    return;
}

function includeSyntax(string $file): void
{
    if (is_file($file)) {
        include $file;
        include_once $file;
        require $file;
        require_once $file;
    }
}

// Legacy backtick command strings are deprecated in PHP 8.5; retained as a grammar probe.
function commandString(): string
{
    return `printf '%s' syntax`;
}

function alternateDeclare(): void
{
    declare(ticks=1):
        $tick = true;
    enddeclare;
}

// Embedded HTML, short echo tags, alternative control syntax, and PHP boundaries.
function renderTemplate(string $title, array $items, bool $enabled = true): void
{
    $index = 0;
    ?>
    <!-- HTML comments, attributes, entities, and CSS coexist with PHP scopes. -->
    <section class="syntax-sample" data-mode="<?= ThemeMode::DARK->value ?>">
      <style>
        .syntax-sample { color: #92c1fd; background: #242424; }
      </style>
      <h2><?= htmlspecialchars($title, ENT_QUOTES) ?> &amp; syntax</h2>
      <?php if ($enabled): ?>
        <ul>
          <?php foreach ($items as $key => $item): ?>
            <li id="sample-<?= (int) $key ?>"><?= htmlspecialchars((string) $item) ?></li>
          <?php endforeach; ?>
        </ul>
      <?php elseif ($items): ?>
        <p>Disabled</p>
      <?php else: ?>
        <p>Empty</p>
      <?php endif; ?>
      <?php for ($count = 0; $count < 2; $count++): ?>
        <span><?= $count ?></span>
      <?php endfor; ?>
      <?php while ($index < 2): ?>
        <span><?= $index++ ?></span>
      <?php endwhile; ?>
      <?php switch ($title): case 'syntax': ?>
        <strong>Syntax</strong>
      <?php break; default: ?>
        <em>Sample</em>
      <?php endswitch; ?>
    </section>
    <?php
}
