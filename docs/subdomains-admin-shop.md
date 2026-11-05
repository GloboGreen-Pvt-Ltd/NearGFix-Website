# admin.neargfix.com and shop.neargfix.com

Both portals are built into the same static export as https://neargfix.com
(`/management/*` and `/shop-home/*`) and sit in the same bucket,
`neargfix-website-prod`. They return S3 `AccessDenied` today, even for
`/index.html`. That means their CloudFront distribution isn't allowed to read
the bucket. The bucket policy (OAC) only allows the neargfix.com distribution.

## Fix (AWS console, one time)

1. **Serve both subdomains from the neargfix.com distribution** (recommended)
   - ACM (us-east-1): use or reissue a certificate that covers
     `neargfix.com, *.neargfix.com` (or list `admin.` and `shop.` explicitly).
   - First remove `admin.neargfix.com` / `shop.neargfix.com` from the
     alternate domain names of whatever distribution holds them now.
   - neargfix.com distribution → General → Edit → add both alternate domain
     names → choose the certificate.
   - Route 53: point the `admin` and `shop` A/AAAA alias records at the
     neargfix.com distribution.
2. Publish the updated `infra/cloudfront-rewrite-index.js` and attach it as the
   Viewer Request function on that distribution (`infra/apply-cloudfront-rewrite.sh`).
   admin `/` serves the admin portal (`/management/*` 301s to the clean path); shop `/` serves Sell with Us (`/sell-with-us/` 301s to `/`).

To keep a separate distribution instead: give it the same OAC origin, attach
the same function, and add its ARN to the bucket policy's `AWS:SourceArn`.

## Verify

    curl -sI https://admin.neargfix.com/   # 200 (admin home)
    curl -sI https://shop.neargfix.com/    # 200 (Sell with Us)
    curl -sI https://shop.neargfix.com/shop-home/   # 200
