import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walk(dirPath, callback);
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
        callback(dirPath);
      }
    }
  });
}

walk('./src', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('alert(')) {
    let newContent = content;
    
    if (!newContent.includes("import { toast } from 'sonner';") && !newContent.includes('import { toast } from "sonner";')) {
      newContent = "import { toast } from 'sonner';\n" + newContent;
    }

    newContent = newContent.replace(/alert\((['"`])(.*?)Failed(.*?)\1\)/gi, 'toast.error($1$2Failed$3$1)');
    newContent = newContent.replace(/alert\((['"`])(.*?)Error(.*?)\1\)/gi, 'toast.error($1$2Error$3$1)');
    newContent = newContent.replace(/alert\((['"`])(.*?)Please(.*?)\1\)/gi, 'toast.info($1$2Please$3$1)');
    newContent = newContent.replace(/alert\(/g, 'toast.success(');
    
    fs.writeFileSync(filePath, newContent);
    console.log('Updated', filePath);
  }
});
