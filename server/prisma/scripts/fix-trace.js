const fs = require('fs');
const path = require('path');
const tracePath = path.join(__dirname, '..', '.next', 'trace');
try {
  let txt = fs.readFileSync(tracePath, 'utf8');
  const fixed = txt.replace(/\]\s*\r?\n\s*\[/g, ',\n');
  try {
    JSON.parse(fixed);
  } catch (err) {
    console.error('Parsed JSON failed after fix:', err.message);
    process.exit(2);
  }
  fs.writeFileSync(tracePath, fixed, 'utf8');
  console.log('Fixed trace file at', tracePath);
  process.exit(0);
} catch (err) {
  console.error('Error reading or writing trace file:', err.message);
  process.exit(1);
}
