#!/usr/bin/env ruby
# encoding: UTF-8
# frozen_string_literal: true

# Ruby 3.2+ highlighting sample; inspect as source with Cassidy Dark Preview.
# No execution required. Semantic scopes depend on installed Ruby tooling.
# Covers literals, interpolation, regexes, classes, patterns, blocks, and flow.

require "json"
require "set"
require "date"

=begin
A column-zero block comment with def, class, "strings", and :symbols.
TODO: compare comment delimiters and comment text.
=end

module ThemeSamples
  VERSION = "1.0.0"
  LIMIT = 1_000
  @registry = {}
  $sample_global = :ready

  LITERALS = {
    integer: 42,
    separated: 1_000_000,
    hexadecimal: 0xFF_AA_00,
    binary: 0b1010_0101,
    octal: 0o755,
    decimal: 0d42,
    float: 3.14159,
    exponent: 6.022e23,
    rational: 2r,
    imaginary: 3i,
    negative: -12.5,
    enabled: true,
    disabled: false,
    missing: nil,
    character: ?a,
    escaped_character: ?\n,
    symbol: :accent,
    quoted_symbol: :"token-name",
    string_key: { "accent" => "#92c1fd" },
    keyword_key: { if: "keyword-looking key", class: "another key" }
  }.freeze

  name = "accent"
  single = 'Single quotes: \'quoted\' and literal \n'
  double = "Double quotes: \"quoted\", \n, \t, \x41, \u0042, \u{1F680}"
  interpolated = "Color #{name.upcase}: #{1 + 2}; global #$sample_global"
  unicode = "café 日本語 العربية 🚀"
  percent_literal = %q{Literal #{name} and nested {braces}}
  percent_interpolated = %Q(Color #{name}: #{LITERALS[:integer]})
  words = %w[red green blue escaped\ space]
  expanded_words = %W[#{name} surface #{1 + 2}]
  symbols = %i[accent surface keyword]
  expanded_symbols = %I[#{name} token_#{2}]
  dynamic_symbol = :"theme_#{name}"
  command_literal = -> { %x(printf 'sample') } # Source probe; never invoked.
  backtick_literal = -> { `printf 'sample'` } # Source probe; never invoked.

  literal_heredoc = <<'LITERAL'
Literal heredoc: #{name} \n \t
<tag key="value">Text & entities</tag>
LITERAL
  indented_heredoc = <<-TEXT
    Interpolated heredoc: #{name}
    Escaped newline: \n
  TEXT
  squiggly_heredoc = <<~TEXT
    Common indentation is removed.
    Interpolation: #{name}, Unicode: #{unicode}
  TEXT

  # Regex: anchors, groups, lookarounds, classes, quantifiers, flags, references.
  token_pattern = /\A(?<name>[A-Za-z_]\w*)\s*[:=]\s*(?<value>.*?)\z/im
  repeated_word = /\b(?<word>\w+)\s+\k<word>\b/i
  lookarounds = /(?<=\s)(?!skip)[a-z]+(?=:)(?<!_)/
  percent_regex = %r{https?://(?<host>[^/]+)/#{name}(?:/\d{1,3})?}i
  verbose_regex = %r{
    ^ [A-Z]+       # Prefix
    [-_] \d{2,4}  # Separator and digits
    $              # End anchor
  }x
  matched = "accent=blue" =~ token_pattern
  captures = [$~, $&, $`, $', $1, $+, Regexp.last_match(:name)]
  no_match = "sample" !~ /\d+/

  arrays = [1, "two", :three, nil, *words]
  hash = { accent: "#92c1fd", **{ surface: "#242424" } }
  first, *middle, last = [1, 2, 3, 4]
  parallel_left, parallel_right = 10, 20
  inclusive = (1..10)
  exclusive = (1...10)
  beginless = (..10)
  endless = (1..)
  sliced = arrays[1..2], arrays[-1], arrays[0, 2]

  module Labelled
    def label
      "#{self.class.name}:#{@name}"
    end
  end

  module TraceCalls
    def describe
      "traced(#{super})"
    end
  end

  class BaseRecord
    def describe
      "base"
    end
  end

  class Swatch < BaseRecord
    include Labelled
    prepend TraceCalls
    extend Enumerable

    DEFAULT_COLOR = "#92c1fd"
    @@created = 0

    attr_reader :name
    attr_accessor :enabled
    attr_writer :metadata

    def initialize(name, color = DEFAULT_COLOR, enabled: true, **metadata)
      super()
      @name, @color = name, color
      @enabled = enabled
      @metadata = metadata
      @@created += 1
    end

    def self.created
      @@created
    end

    class << self
      def category
        :syntax
      end
    end

    def color=(value)
      raise ArgumentError, "Expected a color" unless value.start_with?("#")

      @color = value
    end

    def [](key)
      @metadata[key]
    end

    def []=(key, value)
      @metadata[key] = value
    end

    def <=>(other)
      name <=> other.name
    end

    def +(other)
      [self, other]
    end

    def describe
      "#{super}: #{@name}=#{@color}"
    end

    def each_label(prefix = "", *suffixes, separator: ":", **options, &block)
      return enum_for(__method__, prefix, *suffixes, separator: separator, **options) unless block

      [name, *suffixes].each do |value|
        yield [prefix, value].join(separator)
      end
    end

    def deconstruct
      [@name, @color]
    end

    def deconstruct_keys(keys)
      { name: @name, color: @color, enabled: @enabled }
    end

    def normalized_name = @name.to_s.downcase

    alias label_text normalized_name
    undef label_text

    alias_method :to_s, :describe

    protected

    def metadata
      @metadata
    end

    private

    def normalize(value)
      value.strip.downcase
    end
  end

  module StringRefinement
    refine String do
      def theme_label
        "theme:#{self}"
      end
    end
  end

  using StringRefinement

  def self.forward(*args, **kwargs, &block)
    Swatch.new(*args, **kwargs, &block)
  end

  def self.forward_all(...)
    forward(...)
  end

  def self.operators(input, other = 2)
    count = input || 0
    mask = 0b1010
    count += 1
    count -= 1
    count *= 2
    count /= 2
    count %= 7
    count **= 2
    mask &= 0xf
    mask |= 1
    mask ^= 2
    mask <<= 1
    mask >>= 1
    cached = nil
    cached ||= :default
    cached &&= :ready

    {
      arithmetic: (count + other - 1) * 2**3 / 4 % 5,
      bitwise: (~mask & 0xff) | (mask ^ other),
      comparison: count >= 0 && count <= 100 && count != other,
      equality: count == other || count.eql?(other),
      case_equality: Integer === count,
      ordering: count <=> other,
      negation: !input,
      keyword_logic: (not input) || (input and other) || (input or other),
      safe_navigation: input&.to_s&.upcase,
      defined: defined?(Swatch),
      conditional: count > 0 ? :positive : :zero
    }
  end

  def self.control_flow(values)
    total = 0

    for value in values
      next if value.nil?

      break if value == :stop

      if value < 0
        total -= value
      elsif value > 100
        total += 100
      else
        total += value
      end
    end

    unless values.empty?
      total += 1
    end

    while total > 20
      total -= 5
    end

    until total >= 3
      total += 1
    end

    total += 1 while total < 5
    total -= 1 until total <= 10

    case total
    when 0 then :zero
    when 1..5, 8 then :small
    else :large
    end
  end

  def self.patterns(value)
    case value
    in { name: String => name, color:, **rest } if color.start_with?("#")
      [name, color, rest]
    in Swatch[name, color]
      "#{name}:#{color}"
    in [Integer => first, *rest]
      [first, rest]
    in :ready | :done
      :idle
    in nil
      :missing
    else
      :other
    end
  end

  def self.rightward_assignment(value)
    value => { name:, color: }

    return name, color if value in { enabled: true }

    [name, color]
  end

  def self.parse(text)
    result = nil

    begin
      result = JSON.parse(text)
    rescue JSON::ParserError, TypeError => error
      warn "Parse failed: #{error.message}"
      raise ArgumentError, "Invalid sample", cause: error
    else
      result.freeze
    ensure
      text = nil
    end

    result
  end

  def self.blocks
    doubled = [1, 2, 3].map { |value| value * 2 }
    indexed = %w[red green blue].each_with_index.map do |color, index|
      "#{index}:#{color}"
    end
    shorthand = %w[red green].map(&:upcase)
    numbered = [1, 2, 3].map { _1**2 }
    lambda_literal = ->(left, right = 2) { left + right }
    proc_literal = proc { |first, *rest| [first, rest] }
    explicit_lambda = lambda { |value| value.to_s }
    destructured = { accent: 1, surface: 2 }.map { |(key, value)| "#{key}=#{value}" }
    isolated_local = [1].map { |value; temporary| temporary = value + 1 }
    caught = catch(:done) do
      throw :done, :complete
    end

    [doubled, indexed, shorthand, numbered, lambda_literal.call(1), proc_literal,
     explicit_lambda, destructured, isolated_local, caught]
  end

  def self.retry_probe
    attempts = 0

    begin
      attempts += 1

      raise "Synthetic retry" if attempts < 2
    rescue RuntimeError
      retry if attempts < 2
    end
  end

  def self.redo_probe
    repeated = false

    1.times do
      unless repeated
        repeated = true

        redo
      end
    end
  end

  SOURCE_LOCATION = [__FILE__, __LINE__, __ENCODING__].freeze
end

__END__
This section is data rather than Ruby source.
<swatch name="accent">#92c1fd</swatch>
def class end "literal text after the data marker"
