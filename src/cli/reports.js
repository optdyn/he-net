'use strict';

const fs = require('fs/promises');
const path = require('path');

async function writeReport(reportPath, title, sections) {
  const lines = [`# ${title}`, ''];
  for (const section of sections) {
    if (section.title) lines.push(`## ${section.title}`, '');
    for (const line of section.lines || []) lines.push(line);
    lines.push('');
  }
  if (reportPath) {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, lines.join('\n').replace(/\n{3,}/g, '\n\n'));
  }
  return lines.join('\n');
}

function recordLine(record) {
  return `- ${record.owner || record.name} ${record.type} ${record.rdata || record.content} ttl=${record.ttl || ''}`.trim();
}

module.exports = { recordLine, writeReport };
