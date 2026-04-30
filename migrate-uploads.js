import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_PATH = path.join(__dirname, 'data', 'streamtube.db');

const CATEGORIES = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  audio: ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a'],
  videos: ['.mp4', '.webm', '.mkv', '.avi', '.mov']
};

function getCategory(ext) {
  const lowercaseExt = ext.toLowerCase();
  for (const [category, exts] of Object.entries(CATEGORIES)) {
    if (exts.includes(lowercaseExt)) return category;
  }
  return 'others';
}

function runMigration() {
  console.log(`[Migration] Starting uploads directory migration...`);

  // 1. Create category directories
  ['images', 'videos', 'audio', 'others'].forEach(dir => {
    const dirPath = path.join(UPLOAD_DIR, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });

  // 2. Scan UPLOAD_DIR (non-recursive)
  const files = fs.readdirSync(UPLOAD_DIR);
  const movedFilesMap = new Map(); // Old relative path -> New relative path

  for (const file of files) {
    const oldPath = path.join(UPLOAD_DIR, file);
    const stat = fs.statSync(oldPath);

    // Skip directories
    if (stat.isDirectory()) continue;

    const ext = path.extname(file);
    const category = getCategory(ext);
    const newPath = path.join(UPLOAD_DIR, category, file);

    try {
      fs.renameSync(oldPath, newPath);
      movedFilesMap.set(file, `${category}/${file}`);
      console.log(`[Migration] Moved: ${file} -> ${category}/${file}`);
    } catch (e) {
      console.error(`[Migration] Failed to move ${file}:`, e.message);
    }
  }

  console.log(`[Migration] File moving completed. Updating database...`);

  // 3. Update Database
  let db;
  try {
    db = new Database(DB_PATH);
  } catch (e) {
    console.error(`[Migration] Failed to connect to DB at ${DB_PATH}:`, e.message);
    return;
  }

  // Update media_files table
  const mediaRows = db.prepare('SELECT id, data FROM media_files').all();
  let updatedMediaCount = 0;
  
  for (const row of mediaRows) {
    try {
      const data = JSON.parse(row.data);
      let changed = false;

      // Ensure serverFilename gets mapped correctly
      if (data.serverFilename && !data.serverFilename.includes('/')) {
        const newRelPath = movedFilesMap.get(data.serverFilename);
        if (newRelPath) {
          data.serverFilename = newRelPath;
          data.url = `/uploads/${newRelPath}`;
          changed = true;
        }
      } else if (data.url && data.url.startsWith('/uploads/') && data.url.split('/').length === 3) {
         // E.g. /uploads/filename.jpg
         const filename = data.url.split('/').pop();
         const newRelPath = movedFilesMap.get(filename);
         if (newRelPath) {
           data.url = `/uploads/${newRelPath}`;
           changed = true;
         }
      }

      if (changed) {
        db.prepare('UPDATE media_files SET data = ? WHERE id = ?').run(JSON.stringify(data), row.id);
        updatedMediaCount++;
      }
    } catch (e) {
      console.error(`[Migration] Failed to update media ${row.id}:`, e.message);
    }
  }

  console.log(`[Migration] Updated ${updatedMediaCount} media records.`);

  // Update users table (avatar_url)
  try {
    const users = db.prepare('SELECT id, avatar_url FROM users').all();
    let updatedUserCount = 0;

    for (const user of users) {
      if (user.avatar_url && user.avatar_url.startsWith('/uploads/') && user.avatar_url.split('/').length === 3) {
        const filename = user.avatar_url.split('/').pop();
        const newRelPath = movedFilesMap.get(filename);
        if (newRelPath) {
          db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(`/uploads/${newRelPath}`, user.id);
          updatedUserCount++;
        }
      }
    }
    
    console.log(`[Migration] Updated ${updatedUserCount} user avatars.`);
  } catch (err) {
    console.log(`[Migration] Skipping user avatars update: avatar_url column may not exist yet.`);
  }
  
  // Close DB
  db.close();

  console.log(`[Migration] Migration completed successfully!`);
}

runMigration();
