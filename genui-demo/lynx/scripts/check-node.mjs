if (Number(process.versions.node.split(".")[0]) < 22) {
  console.error(
    "Lynx for Web requires Node.js 22 or later. Run `nvm use` in the app directory, then retry.",
  );
  process.exit(1);
}
