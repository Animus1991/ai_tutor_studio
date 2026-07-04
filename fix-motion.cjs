const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Replace all </motion.div> with </div> just in case
code = code.replace(/<\/motion\.div>/g, '</div>');

// Now, replace the outermost <div className="flex-1 overflow-y-auto relative">
code = code.replace(
  '<div className="flex-1 overflow-y-auto relative">',
  '<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex-1 overflow-y-auto relative">'
);

// We need to match the very last </div> in the file (before the closing `); }`)
const lastDivIndex = code.lastIndexOf('</div>');
if (lastDivIndex !== -1) {
  code = code.substring(0, lastDivIndex) + '</motion.div>' + code.substring(lastDivIndex + 6);
}

fs.writeFileSync('src/pages/Dashboard.tsx', code);
