const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const provider = String(process.env.DB_PROVIDER || "sqlite").toLowerCase();
const schemaDir = path.join(__dirname, "..", "prisma");
const schemaFile = path.join(schemaDir, "schema.prisma");
const sqliteSchemaFile = path.join(schemaDir, "schema.sqlite.prisma");
const pgSchemaFile = path.join(schemaDir, "schema.postgresql.prisma");

const templateFile = provider === "postgresql" ? pgSchemaFile : sqliteSchemaFile;
const label = provider === "postgresql" ? "PostgreSQL" : "SQLite";

if (!fs.existsSync(templateFile)) {
  console.error(`ERROR: ${path.relative(path.join(__dirname, ".."), templateFile)} not found`);
  process.exit(1);
}

fs.copyFileSync(templateFile, schemaFile);
console.log(`OK: Prisma schema set to ${label}`);

try {
  execSync("npx prisma generate", { cwd: path.join(__dirname, ".."), stdio: "inherit" });
  console.log("OK: Prisma client generated");
} catch (e) {
  console.error("Prisma generate failed:", e.message);
  process.exit(1);
}
