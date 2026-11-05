#!/usr/bin/env bash
# Attach the directory-index rewrite to a CloudFront distribution.
#
# WHY THIS EXISTS
# ---------------
# The S3 buckets are REST origins behind OAC, so CloudFront does no directory-index
# lookup: "Default Root Object" maps only "/". next.config.js sets trailingSlash:true,
# so the export writes out/management/index.html, and a browser asking for
# /management/ requests the S3 key "management/", which does not exist. With Block
# Public Access on, S3 answers AccessDenied and the viewer sees:
#
#   GET /                       -> 200
#   GET /management/            -> 403   <-- every route except "/" is dead
#   GET /management/index.html  -> 200   (the object is there; only the mapping is missing)
#
# cloudfront-rewrite-index.js fixes the mapping. This script creates that function,
# publishes it, and associates it with the distribution's default behaviour as
# viewer-request. It also points the 403/404 error responses at /404.html so a
# genuinely missing page reports 404 instead of rendering the home page with 200.
#
# USAGE
#   ./apply-cloudfront-rewrite.sh E1E6CMW5CEO8Z5                  # plan only, changes nothing
#   ./apply-cloudfront-rewrite.sh E1E6CMW5CEO8Z5 --apply          # actually apply
#   ./apply-cloudfront-rewrite.sh E1 E2 E3 --apply                # several distributions
#
# Credentials must belong to the account owning the distributions — the FRONTEND
# account, which is not the account hosting api.neargfix.com. Required permissions:
# cloudfront:CreateFunction, UpdateFunction, DescribeFunction, PublishFunction,
# GetDistributionConfig, UpdateDistribution, CreateInvalidation.
#
# Re-running is safe: the function is updated rather than duplicated, and the config
# patch is idempotent (it also preserves any viewer-response association already set).

set -euo pipefail

FUNCTION_NAME="${FUNCTION_NAME:-ggfix-rewrite-index}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE_FILE="$SCRIPT_DIR/cloudfront-rewrite-index.js"
PATCH_SCRIPT="$SCRIPT_DIR/cloudfront-patch-config.mjs"

APPLY=false
DISTRIBUTIONS=()
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) DISTRIBUTIONS+=("$arg") ;;
  esac
done

if [ ${#DISTRIBUTIONS[@]} -eq 0 ]; then
  echo "usage: $(basename "$0") <distribution-id>... [--apply]" >&2
  exit 2
fi
for dep in aws node; do
  command -v "$dep" >/dev/null || { echo "error: $dep is required but not installed." >&2; exit 1; }
done
for f in "$CODE_FILE" "$PATCH_SCRIPT"; do
  [ -f "$f" ] || { echo "error: missing $f" >&2; exit 1; }
done

json_field() { node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))[process.argv[2]]))" "$1" "$2"; }

$APPLY || echo "== PLAN ONLY == nothing will be changed. Re-run with --apply to commit."
echo "account: $(aws sts get-caller-identity --query Arn --output text)"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------- the function --
# CloudFront Functions are global and live in us-east-1, whatever the bucket region.
CF=(aws cloudfront --region us-east-1)
FN_CONFIG="Comment=Rewrite directory URIs to index.html,Runtime=cloudfront-js-2.0"

if "${CF[@]}" describe-function --name "$FUNCTION_NAME" >/dev/null 2>&1; then
  echo "function '$FUNCTION_NAME': exists"
  if $APPLY; then
    etag=$("${CF[@]}" describe-function --name "$FUNCTION_NAME" --query ETag --output text)
    "${CF[@]}" update-function --name "$FUNCTION_NAME" --if-match "$etag" \
      --function-config "$FN_CONFIG" --function-code "fileb://$CODE_FILE" >/dev/null
    echo "  code updated from cloudfront-rewrite-index.js"
  fi
else
  echo "function '$FUNCTION_NAME': does not exist -> create"
  if $APPLY; then
    "${CF[@]}" create-function --name "$FUNCTION_NAME" \
      --function-config "$FN_CONFIG" --function-code "fileb://$CODE_FILE" >/dev/null
    echo "  created"
  fi
fi

if $APPLY; then
  etag=$("${CF[@]}" describe-function --name "$FUNCTION_NAME" --query ETag --output text)
  "${CF[@]}" publish-function --name "$FUNCTION_NAME" --if-match "$etag" >/dev/null
  FUNCTION_ARN=$("${CF[@]}" describe-function --name "$FUNCTION_NAME" \
    --query FunctionSummary.FunctionMetadata.FunctionARN --output text)
  echo "  published: $FUNCTION_ARN"
else
  FUNCTION_ARN="arn:aws:cloudfront::<account>:function/$FUNCTION_NAME"
fi

# ----------------------------------------------------------- the distributions --
for dist in "${DISTRIBUTIONS[@]}"; do
  echo
  echo "distribution $dist"

  "${CF[@]}" get-distribution-config --id "$dist" > "$TMP/raw.json"
  etag=$(json_field "$TMP/raw.json" ETag)

  # update-distribution replaces the WHOLE config, so the patch passes every other
  # key through untouched — anything dropped would be reset on the live distribution.
  node "$PATCH_SCRIPT" "$FUNCTION_ARN" < "$TMP/raw.json" > "$TMP/next.json"

  if ! $APPLY; then
    echo "  (plan only — not applied)"
    continue
  fi

  "${CF[@]}" update-distribution --id "$dist" \
    --distribution-config "file://$TMP/next.json" --if-match "$etag" >/dev/null
  echo "  updated; CloudFront redeploys in ~5 min"
  "${CF[@]}" create-invalidation --distribution-id "$dist" --paths '/*' >/dev/null
  echo "  invalidated"
done

echo
echo "verify once the distribution leaves 'Deploying':"
echo "  curl -o /dev/null -w '%{http_code}\\n' https://preview.ggfix.in/management/   # expect 200"
echo "  curl -o /dev/null -w '%{http_code}\\n' https://preview.ggfix.in/nope-xyz/     # expect 404"
