/**
 * Prisma setup script — swaps schema provider based on DB_PROVIDER env var.
 * Usage: node scripts/setup-prisma.js
 *   DB_PROVIDER=sqlite     → keeps schema.prisma as-is (default)
 *   DB_PROVIDER=postgresql → uses schema.postgresql.prisma template
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const provider = (process.env.DB_PROVIDER || "sqlite").toLowerCase();
const schemaDir = path.join(__dirname, "..", "prisma");
const schemaFile = path.join(schemaDir, "schema.prisma");
const pgSchemaFile = path.join(schemaDir, "schema.postgresql.prisma");

if (provider === "postgresql") {
  if (!fs.existsSync(pgSchemaFile)) {
    console.error("ERROR: prisma/schema.postgresql.prisma not found");
    process.exit(1);
  }
  fs.copyFileSync(pgSchemaFile, schemaFile);
  console.log("✓ Switched Prisma schema to PostgreSQL");
} else {
  // Ensure SQLite schema is in place
  // The default schema.prisma should already be SQLite
  console.log("✓ Using SQLite Prisma schema");
}

// Generate Prisma client
try {
  execSync("npx prisma generate", { cwd: path.join(__dirname, ".."), stdio: "inherit" });
  console.log("✓ Prisma client generated");
} catch (e) {
  console.error("Prisma generate failed:", e.message);
  process.exit(1);
}
