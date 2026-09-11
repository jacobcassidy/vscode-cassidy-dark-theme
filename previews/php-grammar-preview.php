<?php

declare(strict_types=1);

namespace CassidyThemePreview;

/*
 * PHP 8.2+ highlighting fixture; no execution needed.
 * Open in VS Code with language mode PHP.
 * Inspect a type using Developer: Inspect Editor Tokens and Scopes,
 * switch color themes, then inspect the same token again.
 *
 * Primary probe: Widget in `public Widget $plain` below.
 * Your injection assigns unqualified class names:
 *   support.class.php keyword.other.type.cassidydark.php
 * Qualified class names use support.class.php without that custom suffix.
 * Switching themes should change styling, not the assigned grammar scopes.
 * Semantic highlighting can override visible colors; disable it temporarily
 * in workspace settings if you want to isolate TextMate theme rules.
 */

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

    // Promoted parameters have modifiers, so the injection should match.
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
