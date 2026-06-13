const fs = require('fs');
const path = require('path');

// Replicating parseCSVLine and parseCSVString from imports.service.js
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSVString(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    row._rowNumber = i + 1; // 1-indexed, accounting for header
    rows.push(row);
  }

  return rows;
}

function runTrace() {
  const uploadsDir = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.csv'));
  
  if (files.length === 0) {
    console.log("No CSV files found in uploads directory!");
    return;
  }
  
  const targetFile = path.join(uploadsDir, files[0]);
  console.log("=== CSV Import Tracing ===");
  console.log("Target File Path:", targetFile);
  
  const stats = fs.statSync(targetFile);
  console.log("Raw File Size (bytes):", stats.size);
  
  const content = fs.readFileSync(targetFile, 'utf-8');
  console.log("First 200 chars of file content:", JSON.stringify(content.substring(0, 200)));
  
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  console.log("Number of non-empty lines split by \\n:", lines.length);
  
  if (lines.length > 0) {
    console.log("Header line (lines[0]):", JSON.stringify(lines[0]));
    const headers = parseCSVLine(lines[0]);
    console.log("Detected Headers:", headers);
    console.log("Detected Headers (mapped with char codes):", headers.map(h => {
      return {
        header: h,
        trimmed: h.trim(),
        charCodes: Array.from(h).map(c => c.charCodeAt(0))
      };
    }));
  }
  
  const csvRows = parseCSVString(content);
  console.log("Parsed row count:", csvRows.length);
  
  if (csvRows.length > 0) {
    console.log("First parsed row object structure:", JSON.stringify(csvRows[0], null, 2));
  }
}

runTrace();
