#!/usr/bin/env bash
# Bash 4+ highlighting sample; inspect as source with Cassidy Dark Preview.
# Definitions only: no functions are called. Validate syntax with bash -n.
# Covers quoting, expansion, arrays, tests, arithmetic, flow, and redirections.

THEME_NAME='Cassidy Dark'
readonly SAMPLE_LIMIT=42

sample_literals() {
  local name="accent" count=1000000
  local single='Literal $name, `command`, and \n'
  local double="Expanded ${name}: \"quotes\", escaped \$dollar and \\slash"
  local ansi=$'ANSI escapes: \n \t \r \x41 \u2603'
  local localized=$"Localized string"
  local joined=prefix"${name}"'suffix'
  local -a colors=(red green "light blue")
  local -A palette=([accent]='#92c1fd' [surface]='#242424')
  local command_output=$(printf '%s' "$name")
  local legacy_output=`printf '%s' "$name"`
  local home_path=~/themes

  printf '%s\n' "${colors[0]}" "${colors[@]}" "${colors[*]}" "${#colors[@]}"
  printf '%s\n' "${!palette[@]}" "${palette[accent]}" "${#name}"
  printf '%s\n' "${name:-default}" "${name-default}" "${name:=assigned}" "${name:+present}"
  printf '%s\n' "${name:?Expected a name}" "${name:1:3}" "${name#*c}" "${name##*c}"
  printf '%s\n' "${name%t*}" "${name%%t*}" "${name/ac/AC}" "${name//c/C}"
  printf '%s\n' "${name^}" "${name^^}" "${name,}" "${name,,}"

  local indirect=name

  printf '%s\n' "${!indirect}" "${!THEME_*}"
  printf '%s\n' "args=$# status=$? pid=$$ background=$! flags=$- script=$0" "$@" "$*"
  printf '%s\n' {red,green,blue} {1..3} "literal * ? [abc]"
}

sample_operators() {
  local count=4 mask=10

  ((count += 1))
  ((count -= 1))
  ((count *= 2))
  ((count /= 2))
  ((count %= 7))
  ((count = count ** 2))
  ((mask &= 15, mask |= 1, mask ^= 2))
  ((mask <<= 1, mask >>= 1))
  ((count++, --count))

  printf '%d\n' "$(( (count + 2) * 3 / 4 % 5 ))" "$((~mask & 0xff))" "$((2#1010 + 16#ff))"
  printf '%d\n' "$((count > 0 ? count : 0))"

  if [[ $count -ge 0 && $count -le 100 ]] && ((mask != 0)); then
    printf '%s\n' "numeric comparison"
  fi

  if [[ -n ${THEME_NAME} && ! -z ${THEME_NAME} ]]; then
    printf '%s\n' "nonempty string"
  fi

  if [[ ${THEME_NAME} == Cassidy* || ${THEME_NAME} != light ]]; then
    printf '%s\n' "pattern comparison"
  fi

  if [[ accent42 =~ ^([[:alpha:]_]+)([0-9]+)$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
  fi

  if [ -r "$0" ] && [ ! -d "$0" ]; then
    printf '%s\n' "readable file"
  fi
}

function sample_flow() {
  local value index=0

  for value in red green blue; do
    case "$value" in
      red|green) printf '%s\n' "$value" ;;
      b*) continue ;;
      *) break ;;
    esac
  done

  for ((index = 0; index < 3; index++)); do
    printf 'index=%d\n' "$index"
  done

  while ((index > 0)); do
    ((index--))
  done

  until ((index >= 2)); do
    ((index++))
  done

  if ((index == 0)); then
    return 0
  elif ((index < 0)); then
    return 1
  else
    printf '%s\n' "positive"
  fi

  select value in dark light quit; do
    [[ $value == quit ]] && break
    printf '%s\n' "$REPLY: $value"
  done
}

sample_streams() {
  local line

  # Quoted and expanding heredocs, tab-stripped heredoc, and here-string.
  cat <<'LITERAL'
Literal ${name}, $(command), "quotes", and \n.
LITERAL
  cat <<EXPANDED
Theme: ${THEME_NAME}
Expression: $((1 + 2))
EXPANDED
  cat <<-TABBED
	The leading tab is stripped.
TABBED
  read -r line <<< "accent=#92c1fd"
  printf '%s\n' "$line" | sed -E 's/^([^=]+)=/name=\1 color=/' 2>/dev/null

  while IFS= read -r line; do
    printf '<%s>\n' "$line"
  done < <(printf '%s\n' red green blue)

  diff <(printf '%s\n' red) <(printf '%s\n' blue) || true
  printf '%s\n' "discard output" >/dev/null 2>&1
  printf '%s\n' "append syntax" >>/dev/null
  printf '%s\n' "stderr" >&2
  { printf '%s\n' "group"; } | cat
  ( printf '%s\n' "subshell" )

  # File descriptors, traps, background jobs, and wait are source probes.
  exec 3>/dev/null
  printf '%s\n' "descriptor" >&3
  exec 3>&-
  trap 'printf "leaving sample\n"' RETURN
  printf '%s\n' "background" &
  wait "$!"
}

sample_options() {
  local option

  while getopts ':n:v' option; do
    case "$option" in
      n) printf 'name=%s\n' "$OPTARG" ;;
      v) printf '%s\n' "verbose" ;;
      :) return 2 ;;
      \?) return 1 ;;
    esac
  done

  shift "$((OPTIND - 1))"

  return 0
}
