'use strict';

function redactHtml(html) {
  return String(html || '')
    .replace(/<li class="heavy">Welcome<br\s*\/?>.*?<\/li>/gis, '<li class="heavy">Welcome<br>[REDACTED_ACCOUNT_NAME]</li>')
    .replace(/tb[0-9a-f]+\.[0-9]+/gi, '[REDACTED_ACCOUNT_ID]')
    .replace(/(account=)[^"&\s]+/gi, '$1[REDACTED_ACCOUNT_ID]')
    .replace(/(hosted_dns_zoneid=)[0-9]+/gi, '$1[REDACTED_ZONE_ID]')
    .replace(/(hosted_dns_recordid=)[0-9]+/gi, '$1[REDACTED_RECORD_ID]')
    .replace(/(delete_id" type="hidden" name="delete_id" value=")[^"]*/gi, '$1[REDACTED_DELETE_ID]')
    .replace(/(pass(word)?["']?\s*[:=]\s*["'])[^"']+/gi, '$1[REDACTED]');
}

module.exports = { redactHtml };
