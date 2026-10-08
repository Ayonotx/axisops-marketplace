import { NextResponse } from "next/server";

/**
 * Digital Asset Links — proves to Android that this website owns the AxisOps
 * TWA app. Served at /.well-known/assetlinks.json (rewrite in next.config.ts).
 *
 * TWA_PACKAGE_NAME + TWA_CERT_SHA256 come from .env.local; both were set when
 * android/axisops-upload.jks was generated. Until the TWA is rebuilt with a
 * real domain this returns an empty statement list, which is a valid DAL.
 */
export function GET() {
  const pkg = process.env.TWA_PACKAGE_NAME;
  const fingerprint = process.env.TWA_CERT_SHA256;
  if (!pkg || !fingerprint) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: pkg,
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
