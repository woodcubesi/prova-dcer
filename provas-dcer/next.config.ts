import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.WINDOWS_STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingIncludes: { "/*": ["./node_modules/pdfkit/js/data/**/*"] },
  serverExternalPackages: ["pdfkit", "nodemailer"],
};

export default nextConfig;
