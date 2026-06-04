#!/usr/bin/env bash
set -e

add_import() {
  local file="$1"
  if grep -q 'compactPx' "$file"; then return; fi
  if grep -q 'from "../responsive"' "$file"; then
    sed -i '' "s|from '../responsive'|from '../responsive'\nimport { compactPx } from '../responsive'|" "$file"
  elif grep -q 'from "../../responsive"' "$file"; then
    sed -i '' "s|from '../../responsive'|from '../../responsive'\nimport { compactPx } from '../../responsive'|" "$file"
  elif grep -q 'from "./responsive"' "$file"; then
    sed -i '' "s|from './responsive'|from './responsive'\nimport { compactPx } from './responsive'|" "$file"
  else
    sed -i '' '1s/^/import { compactPx } from "..\/responsive";\n/' "$file"
  fi
}

transform_file() {
  local file="$1"
  echo "$file"
  if ! grep -q 'style={{' "$file" 2>/dev/null; then echo "  skip"; return; fi
  add_import "$file"
  for prop in padding margin marginTop marginBottom marginLeft marginRight \
    paddingTop paddingBottom paddingLeft paddingRight \
    fontSize gap borderRadius minHeight maxWidth; do
    sed -i '' "s/$prop: \([0-9]\{2,\}\)/$prop: compactPx(\1)/g" "$file"
    sed -i '' "s/$prop: \([4-9]\)/$prop: compactPx(\1)/g" "$file"
  done
  local cnt=$(grep -c 'compactPx' "$file" || true)
  echo "  $cnt values"
}

for dir in src/influencer src/client src/admin src/components; do
  [ -d "$dir" ] && find "$dir" -name '*.tsx' | while read -r f; do transform_file "$f"; done
done
echo "Done"
