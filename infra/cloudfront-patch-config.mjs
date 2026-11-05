// Patch a CloudFront DistributionConfig so the site works beyond "/".
//
// Reads the raw `aws cloudfront get-distribution-config` payload on stdin, writes
// the patched DistributionConfig on stdout (ready for `update-distribution
// --distribution-config file://...`), and prints a human summary on stderr.
//
//   node cloudfront-patch-config.mjs <function-arn> < raw.json > next.json
//
// Two changes, both required — see apply-cloudfront-rewrite.sh for the why:
//   1. default behaviour gets the rewrite function on viewer-request
//   2. 403 AND 404 map to /404.html with status 404
//
// Everything else in the config is passed through untouched: update-distribution
// replaces the whole config, so any key dropped here would be silently reset on the
// live distribution.

const arn = process.argv[2];
if (!arn) {
  console.error('usage: node cloudfront-patch-config.mjs <function-arn> < raw.json');
  process.exit(2);
}

const raw = await new Promise((resolve, reject) => {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (buf += c));
  process.stdin.on('end', () => resolve(buf));
  process.stdin.on('error', reject);
});

let payload;
try {
  payload = JSON.parse(raw);
} catch (err) {
  console.error(`error: stdin is not valid JSON (${err.message})`);
  process.exit(1);
}

// Accept either the full get-distribution-config payload or a bare DistributionConfig,
// so the script is usable against a hand-saved config too.
const config = payload.DistributionConfig || payload;
if (!config.DefaultCacheBehavior) {
  console.error('error: no DefaultCacheBehavior — is this a distribution config?');
  process.exit(1);
}

const behavior = config.DefaultCacheBehavior;
const before = (behavior.FunctionAssociations?.Items || []).find(
  (a) => a.EventType === 'viewer-request',
);

// Preserve any non-viewer-request association (e.g. a viewer-response security-header
// function); only the viewer-request slot is ours to own.
const others = (behavior.FunctionAssociations?.Items || []).filter(
  (a) => a.EventType !== 'viewer-request',
);
const items = [...others, { FunctionARN: arn, EventType: 'viewer-request' }];
behavior.FunctionAssociations = { Quantity: items.length, Items: items };

config.CustomErrorResponses = {
  Quantity: 2,
  Items: [
    { ErrorCode: 403, ResponsePagePath: '/404.html', ResponseCode: '404', ErrorCachingMinTTL: 10 },
    { ErrorCode: 404, ResponsePagePath: '/404.html', ResponseCode: '404', ErrorCachingMinTTL: 10 },
  ],
};

const aliases = config.Aliases?.Items || [];
console.error(`  aliases:              ${aliases.length ? aliases.join(', ') : '<none>'}`);
console.error(`  viewer-request was:   ${before ? before.FunctionARN : '<none>'}`);
console.error(`  viewer-request now:   ${arn}`);
console.error(`  kept associations:    ${others.length}`);
console.error('  error responses:      403 -> /404.html (404), 404 -> /404.html (404)');

process.stdout.write(JSON.stringify(config, null, 2));
