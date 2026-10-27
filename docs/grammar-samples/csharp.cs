// C# 12 / .NET 8 highlighting sample for Cassidy Dark Preview; inspect as source.
// Standard library only; source probes do not require execution.
#nullable enable
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using ColorValue = System.UInt32;
using static System.Math;

namespace Theme.Samples;

/// <summary>A status with flags, explicit values, and XML documentation.</summary>
/// <seealso cref="Swatch"/>
[Flags]
public enum Status : byte
{
    None = 0,
    Ready = 1 << 0,
    Active = 1 << 1,
    Complete = Ready | Active
}

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class TokenAttribute(string name) : Attribute
{
    public string Name { get; } = name;
    public int Priority { get; init; } = 1;
}

public interface IRenderer<out T>
{
    T Render();
}

public readonly record struct Point(double X, double Y)
{
    public double Length => Sqrt(X * X + Y * Y);
    public static Point operator +(Point left, Point right) => new(left.X + right.X, left.Y + right.Y);
}

public record Selection(string Name, ColorValue Color);

[Token("swatch", Priority = 2)]
public sealed partial class Swatch : IRenderer<string>, INotifyPropertyChanged, IDisposable
{
    public const string Kind = "syntax";
    private static int _created;
    private readonly Dictionary<string, string> _metadata = new();
    private string _name;

    public required string Label { get; init; }
    public ColorValue Color { get; set; } = 0x92_C1_FD;
    public bool Enabled { get; private set; } = true;
    public static int Created => _created;
    public event PropertyChangedEventHandler? PropertyChanged;

    public string Name
    {
        get => _name;
        set
        {
            _name = value ?? throw new ArgumentNullException(nameof(value));
            OnPropertyChanged();
        }
    }

    public string? this[string key]
    {
        get => _metadata.TryGetValue(key, out var value) ? value : null;
        set
        {
            if (value is not null)
            {
                _metadata[key] = value;
            }
        }
    }

    public Swatch(string name)
    {
        _name = name;
        Interlocked.Increment(ref _created);
    }

    public string Render() => $"{Name,-12}: #{Color:X6}";

    public void Deconstruct(out string name, out ColorValue color)
    {
        name = Name;
        color = Color;
    }

    private void OnPropertyChanged([CallerMemberName] string? name = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }

    public void Dispose()
    {
        Enabled = false;
    }
}

public static class Grammar
{
    private static readonly object Gate = new();

    public static void Literals()
    {
        int integer = 1_000_000;
        uint hexadecimal = 0xFF_AA_00u;
        byte binary = 0b1010_0101;
        long large = 42L;
        float fraction = 3.14f;
        double exponent = 6.022e23;
        decimal money = 12.50m;
        bool yes = true, no = false;
        object? missing = null;
        char character = '\'';
        char unicode = '\u2603';
        string escaped = "Quotes \"text\", slash \\, newline\n tab\t null\0 hex\x41 unicode\u0042";
        string verbatim = @"C:\themes\sample.json and ""quotes""";
        string interpolated = $"Count {integer:N0}; braces {{literal}}; value {fraction,8:F2}";
        string interpolatedVerbatim = $@"C:\themes\{integer}\sample.json";
        string raw = """
            <tag key="value">Literal \n and "quotes"</tag>
            """;
        string interpolatedRaw = $$"""
            { "count": {{integer}}, "literal": "{braces}" }
            """;
        ReadOnlySpan<byte> utf8 = "Café 日本語"u8;
        Span<int> stack = stackalloc int[] { 1, 2, 3 };
        int[] collection = [1, 2, 3, .. stack.ToArray()];
        var slice = collection[1..^1];
        var tuple = (Name: "accent", Color: 0x92c1fd);
        var (name, color) = tuple;
        var selection = new Selection(name, (uint)color);
        var changed = selection with { Name = "muted" };
        var @class = "escaped identifier";
        var defaultValue = default(Point);
        var type = typeof(Swatch);
    }

    public static string Classify(object? value) => value switch
    {
        null => "missing",
        int number and >= 0 and <= 10 => $"small: {number}",
        string { Length: > 0 } text => text,
        Swatch { Name: "accent", Enabled: true } => "active accent",
        Point(0, var y) => $"vertical: {y}",
        int[] and [var first, .. var rest] => $"first={first}, rest={rest.Length}",
        Status.Ready or Status.Complete => "ready",
        not string => "non-string",
        _ => "other"
    };

    public static IEnumerable<string> Query(IEnumerable<Swatch> swatches)
    {
        var query = from swatch in swatches
                    where swatch.Enabled && swatch.Name is not "hidden"
                    let label = swatch.Render()
                    orderby swatch.Name ascending
                    select new { swatch.Name, Label = label };

        foreach (var item in query)
        {
            yield return item.Label;
        }

        yield break;
    }

    public static T Create<T>() where T : class, new() => new T();

    public static async Task<string> LoadAsync(string name, CancellationToken token = default)
    {
        using var swatch = new Swatch(name) { Label = "Accent" };

        try
        {
            await Task.Delay(1, token).ConfigureAwait(false);

            return swatch.Render();
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            throw;
        }
        finally
        {
            lock (Gate)
            {
                _ = Swatch.Created;
            }
        }
    }

    public static int Operators(int input)
    {
        int count = input, mask = 0b1010;
        string? optional = null;

        count += 1;
        count -= 1;
        count *= 2;
        count /= 2;
        count %= 7;
        mask &= 15;
        mask |= 1;
        mask ^= 2;
        mask <<= 1;
        mask >>= 1;
        count++;
        --count;
        optional ??= "fallback";

        return checked(count + (~mask & 0xff)) + (optional?.Length ?? 0);
    }
}

#if DEBUG
#region Conditional compilation probe
internal static class DebugOnly { public const bool Enabled = true; }
#endregion
#endif
