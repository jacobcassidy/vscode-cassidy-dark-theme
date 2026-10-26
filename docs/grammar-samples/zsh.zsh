#!/usr/bin/env zsh
# Zsh 5+ highlighting sample; inspect as source with Cassidy Dark Dev.
# Function definitions only; use zsh -n to check without execution.
# Some scopes depend on the installed shell grammar and its Zsh support.

sample_zsh_literals() {
  emulate -L zsh
  setopt extended_glob null_glob

  local name=accent
  local single='Literal $name and \n'
  local double="Expanded ${name}: \"quotes\""
  local ansi=$'Escapes \n \t \x41 \u2603'
  local -a colors=(red green 'light blue')
  local -A palette=(accent '#92c1fd' surface '#242424')
  local -i count=42
  local -F 3 opacity=0.875
  local command_output=$(print -r -- "$name")
  local prompt='%F{blue}%n@%m%f:%~ %# '

  print -r -- "${colors[1]}" "${colors[-1]}" "${colors[1,2]}" "${colors[@]}"
  print -r -- "${#colors}" "${(k)palette}" "${(v)palette}" "${(kv)palette}"
  print -r -- "${(U)name}" "${(L)name}" "${(C)name}" "${(q)name}"
  print -r -- "${(j:,:)colors}" "${(o)colors}" "${(u)colors}"
  print -r -- "${name:-default}" "${name:=assigned}" "${name:+present}" "${name:?Missing}"
  print -r -- "${name#*c}" "${name##*c}" "${name%t*}" "${name%%t*}" "${name//c/C}"

  local words='red,green,blue'
  local path='/srv/sample/themes/default.json'
  local indirect=name

  print -r -- "${(s:,:)words}" "${(P)indirect}" "${path:h}" "${path:t}" "${path:r}" "${path:e}"
  print -r -- "${colors[(i)green]}" "${colors[(r)g*]}" "${(z)words}"
  print -r -- "${(%)prompt}" {red,green,blue} {1..3}
  print -r -- "args=$# status=$? pid=$$ background=$!" "$@"
}

sample_zsh_patterns() {
  emulate -L zsh
  setopt extended_glob null_glob

  local file
  local -a files=(./**/*.zsh(N.))
  local -a directories=(./*(N/))
  local -a recent=(./*(Nom[1,3]))
  local -a excluded=(./^node_modules(N/))

  for file in "${files[@]}"; do
    if [[ $file == (#i)*.zsh && -r $file ]]; then
      print -r -- "${file:t}"
    fi
  done

  if [[ accent42 =~ '^([[:alpha:]_]+)([0-9]+)$' ]]; then
    print -r -- "$MATCH" "${match[1]}" "${match[2]}"
  fi

  case accent in
    (accent|surface) print -r -- 'known color' ;;
    (*) print -r -- 'unknown color' ;;
  esac
}

sample_zsh_flow() {
  emulate -L zsh

  local -i index=0 mask=10
  local value

  ((index += 2, index *= 3, index--))
  ((mask &= 15, mask |= 1, mask ^= 2, mask <<= 1, mask >>= 1))
  print -r -- "$((index ** 2))" "$((index > 0 ? index : 0))" "$((16#ff + 2#1010))"

  repeat 3; do
    ((index++))
  done

  for ((index = 0; index < 3; index++)); do
    ((index == 1)) && continue
    print -r -- "$index"
  done

  until ((index >= 5)); do
    ((index++))
  done

  while ((index > 0)); do
    ((index--))
  done

  # Zsh's always block runs cleanup after the preceding block.
  {
    print -r -- 'protected block'
  } always {
    print -r -- 'cleanup block'
  }

  select value in dark light quit; do
    [[ $value == quit ]] && break
    print -r -- "$REPLY: $value"
  done
}

sample_zsh_streams() {
  emulate -L zsh

  local line

  cat <<'LITERAL'
Literal ${name}, $(command), and \n.
LITERAL
  cat <<EXPANDED
User: ${USER:-sample}
Count: $((1 + 2))
EXPANDED
  read -r line <<< 'accent=#92c1fd'

  while IFS= read -r line; do
    print -r -- "$line"
  done < <(print -l -- red green blue)

  diff <(print red) <(print blue) || true
  print -r -- 'stderr' >&2
  print -r -- 'discard' >/dev/null 2>&1
  print -r -- 'append' >>/dev/null
  ( print -r -- 'subshell' )

  return 0
}
