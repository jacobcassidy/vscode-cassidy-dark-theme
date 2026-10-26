// C++20 highlighting sample for Cassidy Dark Dev; inspect as source.
// Standard-library-only translation unit; no execution required.
// Check with: clang++ -std=c++20 -fsyntax-only docs/grammar-samples/cpp.cpp
#include <algorithm>
#include <array>
#include <atomic>
#include <compare>
#include <concepts>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <span>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <utility>
#include <variant>
#include <vector>

#define SAMPLE_NAME "Cassidy Dark"
#define SAMPLE_STRINGIFY(value) #value
#define SAMPLE_JOIN(left, right) left##right

namespace theme::samples {

using namespace std::string_literals;
using namespace std::string_view_literals;
using Color = std::uint32_t;
using Callback = std::function<void(std::string_view)>;

inline constexpr Color accent = 0x92'c1'fdu;
inline std::atomic<unsigned> created{0};
thread_local int thread_status = 0;

enum class Status : std::uint8_t { pending, active, done };

template <typename T>
concept Number = std::integral<T> || std::floating_point<T>;

template <typename T>
concept Labelled = requires(const T& value) {
    { value.label() } -> std::convertible_to<std::string>;
};

struct Point {
    double x{};
    double y{};
    auto operator<=>(const Point&) const = default;
};

class Record {
public:
    virtual ~Record() = default;
    virtual std::string label() const = 0;
};

class Swatch final : public Record {
public:
    static constexpr std::string_view kind = "swatch";

    explicit Swatch(std::string name, Color color = accent)
        : name_{std::move(name)}, color_{color} {
        ++created;
    }

    Swatch(const Swatch&) = default;
    Swatch(Swatch&&) noexcept = default;
    Swatch& operator=(const Swatch&) = default;
    Swatch& operator=(Swatch&&) noexcept = default;
    ~Swatch() override = default;

    [[nodiscard]] std::string label() const override {
        return name_;
    }

    explicit operator bool() const noexcept {
        return !name_.empty();
    }

    Color& operator[](std::size_t index) {
        if (index != 0) {
            throw std::out_of_range{"Only one color"};
        }

        return color_;
    }

    friend bool operator==(const Swatch& left, const Swatch& right) {
        return left.name_ == right.name_ && left.color_ == right.color_;
    }

private:
    std::string name_;
    Color color_;
    mutable unsigned reads_{};
};

template <Number T, std::size_t N>
constexpr T sum(const std::array<T, N>& values) noexcept {
    T total{};

    for (const auto& value : values) {
        total += value;
    }

    return total;
}

template <typename... Values>
constexpr auto sum_all(Values... values) {
    return (values + ... + 0);
}

template <typename T>
std::string describe(const T& value) requires Labelled<T> {
    if constexpr (std::is_polymorphic_v<T>) {
        return "record:" + value.label();
    } else {
        return value.label();
    }
}

consteval std::size_t capacity() {
    return 256;
}

constexpr long double operator""_pct(long double value) {
    return value / 100.0L;
}

void literals() {
    constexpr auto decimal = 1'000'000LL;
    constexpr auto binary = 0b1010'0101u;
    constexpr auto octal = 0755;
    constexpr auto hexadecimal = 0xFFAA00UL;
    constexpr auto fraction = 3.14159;
    constexpr auto exponent = 6.022e23;
    constexpr auto hex_float = 0x1.fp+2;
    constexpr auto opacity = 75.0_pct;
    constexpr auto character = '\'';
    constexpr auto wide = L'\u2603';
    constexpr auto unicode = U'\U0001F680';
    constexpr const char* escaped = "Quotes \"text\", slash \\, newline\n tab\t hex\x41 octal\101";
    constexpr auto raw = R"tag(<tag key="value"> ${literal} \n )tag";
    constexpr auto utf8 = u8"Café 日本語 🚀";
    constexpr auto utf16 = u"UTF-16 \u2603";
    const auto owned = "owned string"s;
    constexpr auto view = "string view"sv;
    const auto tuple = std::tuple{"accent", accent, true};
    const auto [name, color, enabled] = tuple;
    const Point point{.x = 1.5, .y = 2.5};
    constexpr std::array values{1, 2, 3};
    const std::span<const int> slice{values};
    const auto optional = std::optional<Color>{accent};
    const std::variant<int, std::string> choice{"accent"s};
    auto pointer = std::make_unique<Swatch>("accent");
    auto callback = [prefix = "theme:"s, &owned](const auto& value) mutable -> std::string {
        prefix += owned;

        return prefix + value.label();
    };
    const auto generic_lambda = []<typename T>(T value) requires Number<T> { return value * 2; };

    static_assert(sum(values) == 6);
    static_assert(capacity() == 256);
    (void)callback(*pointer);
    (void)generic_lambda(2);
}

int flow(std::span<const int> values) {
    int total = 0;

    for (auto value : values) {
        if (value < 0) {
            continue;
        } else if (value > 100) {
            break;
        } else {
            total += value;
        }
    }

    while (total > 20) {
        total -= 5;
    }

    do {
        ++total;
    } while (total < 3);

    switch (total) {
        case 0: return 0;
        case 1: [[fallthrough]];
        case 2: total += 2; break;
        default: total += 3;
    }

    try {
        const auto value = std::make_unique<Swatch>("accent");
        const Record* base = value.get();
        const auto derived = dynamic_cast<const Swatch*>(base);
        const auto numeric = static_cast<double>(total);

        if (derived == nullptr) {
            throw std::runtime_error{"Missing swatch"};
        }
    } catch (const std::exception& error) {
        return -1;
    } catch (...) {
        throw;
    }

    return total;
}

[[deprecated("Use Swatch instead")]] inline Color legacy_color() { return accent; }

} // namespace theme::samples

namespace examples = theme::samples;
