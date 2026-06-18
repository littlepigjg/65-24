import fs from 'fs-extra';
import path from 'path';
import { SyncConfig, SyncState, SyncRecord, ConflictFile } from '../types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'sync-config.json');
const STATE_FILE = path.join(DATA_DIR, 'sync-state.json');
const RECORDS_FILE = path.join(DATA_DIR, 'sync-records.json');
const CONFLICTS_FILE = path.join(DATA_DIR, 'conflicts.json');

function getDefaultConfig(): SyncConfig {
  const sourceDir = process.env.SOURCE_DIR || path.join(process.cwd(), 'sync-source');
  const targetDir = process.env.TARGET_DIR || path.join(process.cwd(), 'sync-target');
  
  return {
    sourceDir,
    targetDir,
    syncInterval: parseInt(process.env.SYNC_INTERVAL || '5000', 10),
    ignoredPatterns: ['node_modules', '.git', '*.tmp', '*.log'],
    autoResolve: process.env.AUTO_RESOLVE === 'true',
    conflictStrategy: (process.env.CONFLICT_STRATEGY as 'manual' | 'source' | 'target') || 'manual'
  };
}

export async function initStorage(): Promise<void> {
  await fs.ensureDir(DATA_DIR);
  
  const defaultConfig = getDefaultConfig();
  
  if (!await fs.pathExists(CONFIG_FILE)) {
    await fs.writeJson(CONFIG_FILE, defaultConfig, { spaces: 2 });
  } else {
    const existingConfig = await getConfig();
    let updated = false;
    
    if (process.env.SOURCE_DIR && existingConfig.sourceDir !== defaultConfig.sourceDir) {
      existingConfig.sourceDir = defaultConfig.sourceDir;
      updated = true;
    }
    if (process.env.TARGET_DIR && existingConfig.targetDir !== defaultConfig.targetDir) {
      existingConfig.targetDir = defaultConfig.targetDir;
      updated = true;
    }
    if (process.env.SYNC_INTERVAL && existingConfig.syncInterval !== defaultConfig.syncInterval) {
      existingConfig.syncInterval = defaultConfig.syncInterval;
      updated = true;
    }
    
    if (updated) {
      await saveConfig(existingConfig);
    }
  }

  if (!await fs.pathExists(STATE_FILE)) {
    const defaultState: SyncState = {
      lastSyncTime: 0,
      files: {}
    };
    await fs.writeJson(STATE_FILE, defaultState, { spaces: 2 });
  }

  if (!await fs.pathExists(RECORDS_FILE)) {
    await fs.writeJson(RECORDS_FILE, [], { spaces: 2 });
  }

  if (!await fs.pathExists(CONFLICTS_FILE)) {
    await fs.writeJson(CONFLICTS_FILE, [], { spaces: 2 });
  }

  const config = await getConfig();
  await fs.ensureDir(config.sourceDir);
  await fs.ensureDir(config.targetDir);
}

export async function getConfig(): Promise<SyncConfig> {
  return fs.readJson(CONFIG_FILE);
}

export async function saveConfig(config: SyncConfig): Promise<void> {
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

export async function getSyncState(): Promise<SyncState> {
  return fs.readJson(STATE_FILE);
}

export async function saveSyncState(state: SyncState): Promise<void> {
  await fs.writeJson(STATE_FILE, state, { spaces: 2 });
}

export async function getSyncRecords(): Promise<SyncRecord[]> {
  return fs.readJson(RECORDS_FILE);
}

export async function addSyncRecord(record: SyncRecord): Promise<void> {
  const records = await getSyncRecords();
  records.unshift(record);
  const recentRecords = records.slice(0, 100);
  await fs.writeJson(RECORDS_FILE, recentRecords, { spaces: 2 });
}

export async function getConflicts(): Promise<ConflictFile[]> {
  return fs.readJson(CONFLICTS_FILE);
}

export async function saveConflicts(conflicts: ConflictFile[]): Promise<void> {
  await fs.writeJson(CONFLICTS_FILE, conflicts, { spaces: 2 });
}

export async function addConflict(conflict: ConflictFile): Promise<void> {
  const conflicts = await getConflicts();
  const existingIndex = conflicts.findIndex(c => c.filePath === conflict.filePath && !c.resolved);
  if (existingIndex >= 0) {
    conflicts[existingIndex] = conflict;
  } else {
    conflicts.push(conflict);
  }
  await saveConflicts(conflicts);
}

export async function resolveConflict(conflictId: string, resolution: 'source' | 'target' | 'merge', mergedContent?: string): Promise<void> {
  const conflicts = await getConflicts();
  const index = conflicts.findIndex(c => c.id === conflictId);
  if (index >= 0) {
    conflicts[index].resolved = true;
    conflicts[index].resolution = resolution;
    conflicts[index].resolvedAt = Date.now();
    await saveConflicts(conflicts);
  }
}
