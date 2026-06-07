'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { assertExactZone, compareRecords, normalizeName } = require('../core/dns');
const { assertHeSupportedRecordType } = require('../core/record-types');
const { loginIfNeeded } = require('./auth');

const DEFAULT_PROFILE = path.resolve(process.cwd(), '.local/he-net-profile');
const DEFAULT_VIEWPORT = { width: 1440, height: 1000 };
const TTL_BY_VALUE = new Set(['300', '900', '1800', '3600', '7200', '14400', '28800', '38400', '43200', '86400']);

class HeNetClient {
  constructor(options = {}) {
    this.credsPath = options.credsPath;
    this.headless = options.headless !== false;
    this.profileDir = options.profileDir || DEFAULT_PROFILE;
    this.context = null;
    this.page = null;
  }

  async open() {
    this.context = await chromium.launchPersistentContext(this.profileDir, {
      headless: this.headless,
      viewport: DEFAULT_VIEWPORT,
    });
    this.page = this.context.pages()[0] || await this.context.newPage();
    await loginIfNeeded(this.page, { credsPath: this.credsPath });
    return this;
  }

  async close() {
    if (this.context) await this.context.close();
    this.context = null;
    this.page = null;
  }

  async listZones() {
    await this.page.goto('https://dns.he.net/', { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    return this.page.evaluate(() => {
      function rows(selector, kind) {
        return [...document.querySelectorAll(`${selector} tbody tr`)].map((row) => {
          const edit = row.querySelector('img[alt="edit"], img[alt="information"]');
          const del = row.querySelector('img[alt="delete"]');
          const zone = [...row.querySelectorAll('span,td')]
            .map((cell) => cell.textContent.trim())
            .find((text) => /^[A-Za-z0-9_.-]+\.[A-Za-z]{2,}\.?$/.test(text)) || '';
          const onclick = edit?.getAttribute('onclick') || '';
          const domid = (onclick.match(/domid=([0-9]+)/) || [])[1] || '';
          const zoneid = (onclick.match(/hosted_dns_zoneid=([0-9]+)/) || [])[1] || '';
          return {
            deleteName: del?.getAttribute('name') || '',
            domid,
            editName: edit?.getAttribute('name') || '',
            editOnclick: onclick,
            kind,
            text: row.innerText.trim(),
            zone,
            zoneid,
          };
        }).filter((row) => row.zone);
      }
      return {
        active: rows('#domains_table', 'active'),
        slave: rows('#secondariess_table', 'slave'),
        title: document.title,
      };
    });
  }

  async findExactZone(zone, kind = 'active') {
    const zones = await this.listZones();
    const rows = kind === 'slave' ? zones.slave : zones.active;
    const matches = rows.filter((row) => normalizeName(row.zone) === normalizeName(zone));
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one ${kind} zone ${zone}; found ${matches.length}.`);
    }
    assertExactZone(matches[0].zone, zone);
    return matches[0];
  }

  async openActiveZone(zone) {
    const row = await this.findExactZone(zone, 'active');
    if (row.editName !== zone || row.deleteName !== zone) {
      throw new Error(`Active row control mismatch for ${zone}.`);
    }
    const match = row.editOnclick.match(/document\.location\.href='([^']+)'/);
    if (!match) throw new Error(`Could not parse active edit URL for ${zone}.`);
    const editUrl = new URL(match[1], 'https://dns.he.net/').toString();
    await this.page.goto(editUrl, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const caption = await this.caption();
    if (caption !== `Managing zone: ${zone}`) throw new Error(`Unexpected HE.net caption: ${caption}`);
    return { editUrl, row, zoneId: await this.zoneId() };
  }

  async caption() {
    return this.page.evaluate(() => [...document.querySelectorAll('.caption')]
      .map((node) => node.textContent.trim())
      .find((text) => text.startsWith('Managing zone:')) || '');
  }

  async zoneId() {
    return this.page.locator('#domain_id').getAttribute('value').catch(() => '');
  }

  async inspectZone(zone) {
    const opened = await this.openActiveZone(zone);
    return {
      ...opened,
      records: await this.readRecords(),
    };
  }

  async readRecords() {
    return this.page.evaluate(() => {
      const rows = [...document.querySelectorAll('#dns_main_content tr.dns_tr, #dns_main_content tr.dns_tr_locked')];
      return rows.map((row) => {
        const cells = row.querySelectorAll('td');
        return {
          content: cells[6]?.getAttribute('data') || cells[6]?.textContent?.trim() || '',
          locked: row.classList.contains('dns_tr_locked'),
          name: cells[2]?.textContent?.trim() || '',
          priority: cells[5]?.textContent?.trim() || '-',
          recordId: row.id || cells[1]?.textContent?.trim() || '',
          ttl: cells[4]?.textContent?.trim() || '',
          type: row.querySelector('.rrlabel')?.textContent?.trim() || '',
        };
      }).filter((record) => record.type);
    });
  }

  async planRecords(zone, desiredRecords) {
    const inspected = await this.inspectZone(zone);
    return {
      actual: inspected.records,
      comparison: compareRecords(desiredRecords, inspected.records),
      zone,
      zoneId: inspected.zoneId,
    };
  }

  async inspectSlaveConversion(zone) {
    const row = await this.findExactZone(zone, 'slave');
    const domid = row.domid;
    if (!domid) throw new Error(`Could not discover slave domid for ${zone}.`);
    await this.page.goto(`https://dns.he.net/?domid=${domid}&menu=edit_slave&action=edit`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const result = await this.page.evaluate(({ zone, domid }) => {
      const convert = [...document.querySelectorAll('input,button,a')]
        .map((control) => ({
          onclick: control.getAttribute('onclick') || '',
          text: control.textContent.trim(),
          type: control.getAttribute('type') || '',
          value: control.getAttribute('value') || '',
        }))
        .find((control) =>
          control.value === 'Convert!' &&
          control.onclick === `location.href='?domid=${domid}&menu=edit_slave&action=convert'`
        );
      return {
        bodyIncludesZone: document.body.innerText.includes(zone),
        convertFound: Boolean(convert),
        domid,
        title: document.title,
        url: location.href,
      };
    }, { domid, zone });
    if (!result.bodyIncludesZone) throw new Error(`Slave edit page did not include exact zone ${zone}.`);
    return result;
  }

  async convertSlave(zone, options = {}) {
    const confirmZone = options.confirmZone || '';
    const confirmConvert = options.confirmConvert || '';
    assertExactZone(confirmZone, zone);
    if (confirmConvert !== 'CONVERT') throw new Error('Missing required confirmConvert=CONVERT.');
    const conversion = await this.inspectSlaveConversion(zone);
    if (!conversion.convertFound) throw new Error(`Convert control was not found for ${zone}.`);
    await this.page.goto(`https://dns.he.net/?domid=${conversion.domid}&menu=edit_slave&action=convert`, {
      waitUntil: 'domcontentloaded',
    });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    return {
      bodyText: await this.page.locator('body').innerText().catch(() => ''),
      domid: conversion.domid,
      title: await this.page.title(),
      url: this.page.url(),
    };
  }

  async addRecord(zoneId, record) {
    if (!/^[0-9]+$/.test(String(zoneId))) throw new Error(`Unexpected zone id: ${zoneId}`);
    const ttl = String(record.ttl || '300');
    if (!TTL_BY_VALUE.has(ttl)) throw new Error(`TTL ${ttl} is not in the known HE.net dropdown values.`);
    const type = assertHeSupportedRecordType(record.type);
    const parts = require('../core/dns').recordParts(record);
    return this.page.evaluate(async ({ parts, record, ttl, type, zoneId }) => {
      const params = new URLSearchParams();
      params.set('hosted_dns_zoneid', zoneId);
      params.set('menu', 'edit_zone');
      params.set('hosted_dns_editzone', '1');
      params.set('hosted_dns_editrecord', 'Submit');
      params.set('Name', record.owner);
      params.set('Type', type);
      params.set('TTL', ttl);
      params.set('Priority', parts.priority === '-' ? '' : parts.priority);
      params.set('Content', parts.content);
      const response = await fetch('/index.cgi', {
        body: params.toString(),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      });
      return { status: response.status, textLength: (await response.text()).length, url: response.url };
    }, { parts, record, ttl, type, zoneId });
  }

  async deleteRecord(zoneId, record, options = {}) {
    if (!/^[0-9]+$/.test(String(zoneId))) throw new Error(`Unexpected zone id: ${zoneId}`);
    if (!/^[0-9]+$/.test(String(record.recordId))) throw new Error(`Unexpected record id: ${record.recordId}`);
    if (record.locked) throw new Error(`Refusing to delete locked ${record.name} ${record.type} record.`);
    if (options.confirmDelete !== 'DELETE_RECORD') throw new Error('Missing confirmDelete=DELETE_RECORD.');
    return this.page.evaluate(async ({ recordId, zoneId }) => {
      const params = new URLSearchParams();
      params.set('hosted_dns_zoneid', zoneId);
      params.set('hosted_dns_recordid', recordId);
      params.set('menu', 'edit_zone');
      params.set('hosted_dns_delconfirm', 'delete');
      params.set('hosted_dns_editzone', '1');
      params.set('hosted_dns_delrecord', '1');
      const response = await fetch('/index.cgi', {
        body: params.toString(),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      });
      return { status: response.status, textLength: (await response.text()).length, url: response.url };
    }, { recordId: record.recordId, zoneId });
  }
}

module.exports = {
  DEFAULT_PROFILE,
  HeNetClient,
};
