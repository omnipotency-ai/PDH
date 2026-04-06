/**
 * Log CRUD hooks and data management (export, delete).
 */

import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useMemo } from "react";
import type { LogType } from "@/types/domain";
import { api } from "../../convex/_generated/api";
import {
  asConvexId,
  type LogPayloadData,
  type SyncedLog,
  sanitizeLogData,
  toSyncedLogs,
} from "./syncCore";

export function useSyncedLogs(limit = 300): SyncedLog[] {
  const logs = useQuery(api.logs.list, { limit });
  return useMemo(() => toSyncedLogs(logs), [logs]);
}

export function useAllSyncedLogs(): SyncedLog[] {
  const logs = useQuery(api.logs.listAll, {});
  return useMemo(() => toSyncedLogs(logs), [logs]);
}

export function useSyncedLogCount(): number | undefined {
  return useQuery(api.logs.count);
}

export function useSyncedLogsByRange(startMs: number, endMs: number, limit = 5000): SyncedLog[] {
  const logs = useQuery(api.logs.listByRange, {
    startMs,
    endMs,
    limit,
  });
  return useMemo(() => toSyncedLogs(logs), [logs]);
}

export function useAddSyncedLog() {
  const add = useMutation(api.logs.add);
  return (payload: { timestamp: number; type: SyncedLog["type"]; data: LogPayloadData }) =>
    add({
      timestamp: payload.timestamp,
      type: payload.type,
      data: sanitizeLogData(payload.type, payload.data),
    });
}

export function useRemoveSyncedLog() {
  const remove = useMutation(api.logs.remove);
  return (id: string) =>
    remove({
      id: asConvexId<"logs">(id),
    });
}

export function useUpdateSyncedLog() {
  const update = useMutation(api.logs.update);
  return (payload: { id: string; timestamp: number; type: LogType; data: LogPayloadData }) =>
    update({
      id: asConvexId<"logs">(payload.id),
      timestamp: payload.timestamp,
      data: sanitizeLogData(payload.type, payload.data),
    });
}

export function useDeleteAllSyncedData() {
  const deleteAll = useMutation(api.logs.deleteAll);
  return () => deleteAll({});
}

export type AppBackupPayload = NonNullable<FunctionReturnType<typeof api.logs.exportBackup>>;

export function useExportBackup() {
  const convex = useConvex();
  return useCallback(() => convex.query(api.logs.exportBackup, {}), [convex]);
}
