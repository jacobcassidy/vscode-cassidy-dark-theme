//! Rust 1.77+ (edition 2021) highlighting sample for Cassidy Dark Dev.
//!
//! Inspect declarations and usages with Developer: Inspect Editor Tokens and Scopes.
//! Compare semantic highlighting enabled and disabled with rust-analyzer installed.
//! This standalone library uses only `std`; no execution or Cargo project is required.
//!
//! # Embedded documentation
//! ```rust
//! let accent = "#92c1fd";
//! assert!(accent.starts_with('#'));
//! ```

#![allow(dead_code, unused_imports, unused_variables)]
#![forbid(unsafe_op_in_unsafe_fn)]

use std::{
    collections::{BTreeMap, HashMap},
    error::Error,
    fmt::{self, Display, Formatter},
    future::Future,
    marker::PhantomData,
    ops::{Add, RangeInclusive},
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
};
use std::io::Result as IoResult;

// TODO: inspect fn, let, return, "strings", and 'lifetimes inside comments.
/* Block comment with /* a nested block */ and Unicode café 日本語 🚀. */

pub const MAX_COLORS: usize = 1_000_000;
pub const ACCENT: &str = "#92c1fd";
pub static CREATED: AtomicUsize = AtomicUsize::new(0);
pub type Registry<T> = BTreeMap<String, T>;
pub type Callback = fn(&str) -> usize;

/// A tuple struct with derive attributes and a representation hint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(transparent)]
pub struct Color(pub u32);

/// A generic record with a lifetime, visibility modifiers, and field attributes.
#[derive(Debug, Clone, PartialEq)]
pub struct Swatch<'a, T = Color> {
    pub name: &'a str,
    pub color: T,
    pub(crate) enabled: bool,
    #[doc = "Optional labels stored as owned strings."]
    labels: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Token<'a> {
    Empty,
    Text(&'a str),
    Number(i64),
    Color { name: &'a str, value: Color },
}

pub struct Ready;

pub trait Render {
    type Output;
    const KIND: &'static str;

    fn render(&self) -> Self::Output;

    fn category(&self) -> &'static str {
        Self::KIND
    }
}

impl<'a> Swatch<'a> {
    pub const fn new(name: &'a str, color: Color) -> Self {
        Self {
            name,
            color,
            enabled: true,
            labels: Vec::new(),
        }
    }

    pub fn with_label(mut self, label: impl Into<String>) -> Self {
        self.labels.push(label.into());

        self
    }

    pub fn labels(&self) -> impl Iterator<Item = &str> + '_ {
        self.labels.iter().map(String::as_str)
    }
}

impl Display for Color {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        write!(formatter, "#{:06x}", self.0)
    }
}

impl Add for Color {
    type Output = Self;

    fn add(self, other: Self) -> Self::Output {
        Self(self.0.saturating_add(other.0))
    }
}

impl Render for Swatch<'_> {
    type Output = String;
    const KIND: &'static str = "swatch";

    fn render(&self) -> Self::Output {
        format!("{}={}", self.name, self.color)
    }
}

/// Generic bounds, a where clause, a lifetime, and a possibly unsized type.
pub fn describe<'a, T>(value: &'a T) -> String
where
    T: Display + Send + Sync + ?Sized,
{
    format!("{value}")
}

pub fn borrowed<'a>(left: &'a str, right: &'a str) -> &'a str {
    if left.len() >= right.len() {
        left
    } else {
        right
    }
}

// Const generics, arrays, references, slices, and compile-time expressions.
pub struct Buffer<T, const N: usize> {
    values: [T; N],
}

impl<T, const N: usize> Buffer<T, N> {
    pub fn as_array(&self) -> &[T; N] {
        &self.values
    }
}

pub fn higher_ranked<F>(callback: F) -> usize
where
    F: for<'a> Fn(&'a str) -> usize,
{
    callback("sample")
}

/// Macro metavariables, fragments, repetitions, separators, and expansion.
macro_rules! palette {
    ($( $name:expr => $color:expr ),* $(,)?) => {{
        let mut result = BTreeMap::new();

        $( result.insert($name, Color($color)); )*

        result
    }};
}

pub fn literals() {
    let decimal: i32 = 42;
    let separated = 1_000_000u64;
    let hexadecimal = 0xff_aa_00u32;
    let binary = 0b1010_0101u8;
    let octal = 0o755u16;
    let negative = -42isize;
    let fraction = 3.14159f64;
    let exponent = 6.022e23_f64;
    let signed_exponent = -2.5E-4f32;
    let flags = (true, false);
    let unit: () = ();
    let character = '界';
    let escaped_character = '\'';
    let unicode_character = '\u{1F680}';
    let byte = b'A';
    let escaped_byte = b'\x7f';
    let string = "Quotes \"text\", slash \\, newline\n return\r tab\t null\0 hex\x41 unicode\u{2603}";
    let unicode = "Café 日本語 العربية 🚀";
    let continued = "First part \
        second part without indentation";
    let raw = r"C:\themes\sample.json\n";
    let delimited_raw = r##"Quotes "text" and a "# sequence remain literal"##;
    let bytes = b"Bytes: \x00\xff\r\n";
    let raw_bytes = br#"^[A-Za-z_]\w*\s*[:=]\s*(.*)$"#;
    let c_string = c"Native string: \x41";
    let raw_c_string = cr#"C:\themes\sample.json"#;
    let r#type = "raw identifier for a reserved keyword";
    let café = "Unicode identifier";
    let tuple = ("accent", 42u8, Some(Color(0x92c1fd)));
    let array = [Color(0x92c1fd); 3];
    let slice = &array[..2];
    let ranges = (0..3, 0..=3, ..3, 1.., ..=3, ..);
    let registry = palette!["accent" => 0x92c1fd, "surface" => 0x242424,];
    let qualified = <Color as Default>::default();
    let explicit_generic = std::iter::empty::<Color>().collect::<Vec<_>>();
    let source = include_str!("rust-grammar-sample.rs");
    let location = (file!(), line!(), column!(), module_path!());
    let platform = cfg!(target_pointer_width = "64");
}

pub fn operators(input: i32, other: i32) -> (i32, bool) {
    let mut count = input;
    let mut mask = 0b1010u32;

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

    let arithmetic = (count + other - 1) * 2 / 4 % 5;
    let bits = (!mask & 0xff) | (mask ^ 3);
    let shifted = (mask << 1, mask >> 1);
    let comparison = count >= 0 && count <= 100 && count != other;
    let logical = !(count == other) || count > other || count < other;
    let cast = mask as usize;
    let reference = &mut count;

    *reference += 1;

    (arithmetic, comparison && logical)
}

pub fn control_flow(values: &[i32]) -> i32 {
    let mut total = 0;

    'outer: for (index, value) in values.iter().enumerate() {
        for multiplier in 1..=3 {
            if *value < 0 {
                continue 'outer;
            } else if *value > 100 {
                break 'outer;
            } else {
                total += *value * multiplier;
            }
        }
    }

    while total > 20 {
        total -= 5;
    }

    let result = loop {
        total += 1;

        if total >= 3 {
            break total * 2;
        }
    };

    let mut pending = Some(result);

    while let Some(value) = pending.take() {
        total += value;
    }

    if let Some(first) = values.first() {
        total += first;
    }

    total
}

pub fn patterns(token: Token<'_>, expected: &str) -> String {
    match token {
        Token::Color { name, value: Color(rgb @ 0x000000..=0xffffff) } if name == expected => {
            format!("{name}: {rgb:#08x}")
        }
        Token::Color { name, .. } => name.to_owned(),
        Token::Text("ready" | "done") => "idle".into(),
        Token::Text(text) => text.into(),
        Token::Number(number @ 1..=10) => format!("small: {number}"),
        Token::Number(-1 | 0) => "nonpositive marker".into(),
        Token::Number(_) | Token::Empty => "other".into(),
    }
}

pub fn destructuring(values: &[i32]) -> Option<i32> {
    let [first, middle @ .., last] = values else {
        return None;
    };

    let tuple = (Some(*first), *last);

    if let (Some(start), end) = tuple {
        return Some(start + end + middle.len() as i32);
    }

    None
}

#[derive(Debug)]
pub struct ParseColorError(String);

impl Display for ParseColorError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        write!(formatter, "Invalid color: {}", self.0)
    }
}

impl Error for ParseColorError {}

pub fn parse_color(text: &str) -> Result<Color, Box<dyn Error + Send + Sync>> {
    let Some(digits) = text.strip_prefix('#') else {
        return Err(Box::new(ParseColorError(text.to_owned())));
    };

    let value = u32::from_str_radix(digits, 16)?;

    Ok(Color(value))
}

pub fn closures(values: Vec<i32>) -> impl Iterator<Item = String> {
    let prefix = String::from("value");
    let double = |value: i32| -> i32 { value * 2 };

    values.into_iter()
        .filter(|value| matches!(*value, 0..=100))
        .map(double)
        .enumerate()
        .map(move |(index, value)| format!("{prefix}[{index}]={value}"))
}

// Async functions, futures, async move blocks, and the await operator.
pub async fn load_color(text: &str) -> Result<Color, Box<dyn Error + Send + Sync>> {
    let pending = async move { parse_color(text) };
    let color = pending.await?;

    Ok(color)
}

pub fn make_future(value: String) -> impl Future<Output = usize> {
    async move { value.len() }
}

// Raw pointers, unsafe blocks, unions, C ABI function pointers, and cfg attributes.
#[repr(C)]
pub union Channels {
    pub packed: u32,
    pub bytes: [u8; 4],
}

pub fn raw_pointer() -> u32 {
    let value = 42u32;
    let pointer: *const u32 = &value;
    let channels = Channels { packed: value };

    // SAFETY: pointer refers to value; the union's initialized field is packed.
    unsafe { *pointer + channels.packed }
}

pub extern "C" fn callback(value: i32) -> i32 {
    value
}

pub type NativeCallback = extern "C" fn(i32) -> i32;

#[cfg(target_pointer_width = "64")]
pub const PLATFORM: &str = "64-bit";

#[deprecated(since = "1.0.0", note = "Use Color instead")]
pub fn legacy_color() -> u32 {
    0x92c1fd
}

pub mod nested {
    use super::{Color, Swatch};

    pub(super) fn accent() -> Swatch<'static> {
        Swatch::new("accent", Color(0x92c1fd))
    }
}

pub use nested as examples;
